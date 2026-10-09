"""Persistent SMTP outbox worker. Run as a separate process: python -m app.worker."""

import logging
import os
import smtplib
import ssl
import time
from datetime import timedelta
from email.message import EmailMessage
from sqlalchemy import or_, select
from .database import Session, initialize
from .models import EmailJob, now

log = logging.getLogger("blitz.mail")


def claim():
    with Session.begin() as db:
        job = db.scalar(
            select(EmailJob)
            .where(
                or_(
                    (EmailJob.status == "pending") & (EmailJob.next_attempt <= now()),
                    (EmailJob.status == "sending") & (EmailJob.lease_until < now()),
                )
            )
            .order_by(EmailJob.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            return None
        job.status = "sending"
        job.lease_until = now() + timedelta(minutes=3)
        job.attempts += 1
        db.flush()
        return dict(
            id=job.id,
            recipient=job.recipient,
            subject=job.subject,
            body=job.body,
            attempts=job.attempts,
        )


def deliver(job):
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM", "BLITZ <blitz@tiss.edu>")
    message["To"] = job["recipient"]
    message["Subject"] = job["subject"]
    message["Message-ID"] = f'<blitz-job-{job["id"]}@blitz.tiss.edu>'
    message.set_content(job["body"])
    with smtplib.SMTP(
        os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587")), timeout=30
    ) as smtp:
        if os.getenv("SMTP_STARTTLS", "true").lower() == "true":
            smtp.starttls(context=ssl.create_default_context())
        if os.getenv("SMTP_USERNAME"):
            smtp.login(os.environ["SMTP_USERNAME"], os.environ.get("SMTP_PASSWORD", ""))
        smtp.send_message(message)


def run_once():
    if not os.getenv("SMTP_HOST"):
        return False
    job = claim()
    if not job:
        return False
    try:
        deliver(job)
    except Exception:
        # Do not log credentials, verification links, or message bodies.
        log.warning(
            "SMTP delivery failed for job %s; attempt %s", job["id"], job["attempts"]
        )
        with Session.begin() as db:
            saved = db.get(EmailJob, job["id"])
            saved.status = "failed" if saved.attempts >= 8 else "pending"
            saved.next_attempt = now() + timedelta(
                seconds=min(3600, 30 * 2**saved.attempts)
            )
            saved.lease_until = None
    else:
        with Session.begin() as db:
            saved = db.get(EmailJob, job["id"])
            saved.status, saved.lease_until = "sent", None
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    initialize()
    if not os.getenv("SMTP_HOST"):
        log.warning(
            "SMTP_HOST is unset; email jobs remain queued until SMTP is configured."
        )
    while True:
        if not run_once():
            time.sleep(3)
