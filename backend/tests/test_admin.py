from uuid import uuid4
from sqlalchemy import select
from app.database import Session
from app.models import Auction, EmailJob, Registration


def test_eight_team_names_are_editable_before_auction(admin_client):
    command_id = str(uuid4())
    payload = {
        "command_id": command_id,
        "version": 0,
        "teams": [{"id": i, "name": f"Campus Team {i}"} for i in range(1, 9)],
    }
    response = admin_client.post("/api/admin/teams", json=payload)
    assert response.status_code == 200
    state = response.json()
    assert state["teams"][0]["name"] == "Campus Team 1" and state["version"] == 1
    assert admin_client.post("/api/admin/teams", json=payload).status_code == 200
    duplicate = {
        **payload,
        "command_id": str(uuid4()),
        "version": 1,
        "teams": [{"id": i, "name": "Duplicate"} for i in range(1, 9)],
    }
    assert admin_client.post("/api/admin/teams", json=duplicate).status_code == 422
    with Session.begin() as db:
        db.get(Auction, 1).phase = "active"
    assert (
        admin_client.post(
            "/api/admin/teams",
            json={**payload, "command_id": str(uuid4()), "version": 1},
        ).status_code
        == 409
    )
    assert admin_client.get("/api/admin/audit").json()[0]["action"] == "teams"


def test_private_admin_views_and_csv_formula_safety(admin_client):
    with Session.begin() as db:
        db.add(
            Registration(
                name='=HYPERLINK("evil")',
                email="student@stud.tiss.edu",
                role="volunteer",
                programme="BSW",
                year=1,
                sports=["Football"],
                photo_key="test.jpg",
                verified=False,
            )
        )
        db.add(
            EmailJob(
                key="test",
                recipient="student@stud.tiss.edu",
                subject="Verify",
                body="private verification token",
            )
        )
    response = admin_client.get("/api/admin/registrations")
    assert response.json()[0]["email"] == "student@stud.tiss.edu"
    assert response.headers["cache-control"] == "no-store"
    assert "'=HYPERLINK" in admin_client.get("/api/admin/registrations.csv").text
    jobs = admin_client.get("/api/admin/emails").json()
    assert "body" not in jobs[0] and "verification token" not in str(jobs)
