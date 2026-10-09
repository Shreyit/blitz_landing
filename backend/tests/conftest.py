import os
import tempfile
import asyncio

# All tests use a fresh database and upload folder, never the event database.
test_directory = tempfile.TemporaryDirectory(prefix="blitz-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{test_directory.name}/test.db"
os.environ["UPLOAD_DIR"] = f"{test_directory.name}/photos"
os.environ["ADMIN_PASSWORD"] = "test-password-for-blitz"
os.environ["SESSION_SECRET"] = "test-session-secret-at-least-32-characters"
os.environ["PRODUCTION"] = "false"

import pytest
from fastapi.testclient import TestClient
from app.database import Session, engine, initialize
from app.main import app
from app.models import Base
from app.security import attempts


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(engine)
    initialize()
    attempts.clear()
    yield


@pytest.fixture
def client():
    options = {}
    if os.getenv("BLITZ_SANDBOX_TESTS") == "1":
        # This sandbox blocks cross-thread socket wakeups. A periodic callback
        # keeps the standard loop responsive without opening any network port.
        def polling_loop():
            loop = asyncio.new_event_loop()

            def pulse():
                loop.call_later(0.01, pulse)

            loop.call_soon(pulse)
            return loop

        options["loop_factory"] = polling_loop
    with TestClient(app, backend_options=options) as client:
        yield client


@pytest.fixture
def admin_client(client):
    assert (
        client.post(
            "/api/admin/login", json={"password": "test-password-for-blitz"}
        ).status_code
        == 200
    )
    return client
