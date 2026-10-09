from sqlalchemy import select
from app.database import Session
from app.models import EmailJob, now
from app import worker


def seed():
    with Session.begin() as db:
        db.add(
            EmailJob(
                key="test",
                recipient="student@tiss.edu",
                subject="Test",
                body="A message",
            )
        )


def test_unconfigured_smtp_keeps_mail_queued(monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    seed()
    assert worker.run_once() is False
    with Session() as db:
        assert db.scalar(select(EmailJob)).status == "pending"


def test_failure_retries_and_success_marks_sent(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "test.invalid")
    seed()

    def fail(job):
        raise ConnectionError()

    monkeypatch.setattr(worker, "deliver", fail)
    assert worker.run_once() is True
    with Session.begin() as db:
        job = db.scalar(select(EmailJob))
        assert job.status == "pending" and job.attempts == 1
        job.next_attempt = now()
    monkeypatch.setattr(worker, "deliver", lambda job: None)
    assert worker.run_once() is True
    with Session() as db:
        assert db.scalar(select(EmailJob)).status == "sent"
    assert worker.run_once() is False
