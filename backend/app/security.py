import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from threading import RLock
from fastapi import HTTPException, Request
from . import config

session_secret = config.SESSION_SECRET or secrets.token_hex(32)
if config.PRODUCTION and (
    len(config.SESSION_SECRET) < 32 or len(config.ADMIN_PASSWORD) < 16
):
    raise RuntimeError(
        "Production requires SESSION_SECRET of at least 32 characters and ADMIN_PASSWORD of at least 16 characters."
    )


def sign(value):
    return hmac.new(session_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def new_session():
    value = f"{int(time.time()) + 12 * 3600}.{secrets.token_hex(16)}"
    return f"{value}.{sign(value)}"


def valid_session(token):
    try:
        expiry, nonce, signature = token.split(".")
        return int(expiry) > time.time() and hmac.compare_digest(
            signature, sign(f"{expiry}.{nonce}")
        )
    except (ValueError, AttributeError):
        return False


def admin(request: Request):
    if not valid_session(request.cookies.get("blitz_admin", "")):
        raise HTTPException(401, "Sign in as an organiser to continue.")
    return "organiser"


attempts = defaultdict(deque)
attempt_lock = RLock()


def rate_limit(request, bucket, limit=10, window=600):
    key = (request.client.host if request.client else "unknown", bucket)
    current = time.monotonic()
    with attempt_lock:
        queue = attempts[key]
        while queue and queue[0] < current - window:
            queue.popleft()
        if len(queue) >= limit:
            raise HTTPException(
                429, "Too many attempts. Please wait a few minutes and try again."
            )
        queue.append(current)
        # Bound stale keys so public traffic cannot grow this process-local limiter forever.
        if len(attempts) > 10000:
            for old_key in list(attempts):
                if not attempts[old_key] or attempts[old_key][-1] < current - window:
                    del attempts[old_key]
