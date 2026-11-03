import io
import re
import json
import pytest
from datetime import timedelta
from PIL import Image
from sqlalchemy import select
from app.database import Session
from app.models import EmailJob, Registration, now
from app import config


def photo():
    output = io.BytesIO()
    Image.new("RGB", (120, 160), "green").save(output, "PNG")
    return output.getvalue()


def register(client, image_bytes=None, **overrides):
    data = {
        "name": "A campus player",
        "email": "student@stud.tiss.ac.in",
        "role": "player",
        "programme": "BSASS",
        "year": "2",
        "age": "20",
        "gender": "female",
        "region": "Maharashtra",
        "played_before": "no",
        "sports": '["Football", "Cricket"]',
        "consent": "true",
    }
    if overrides.get("role") == "volunteer":
        data.update(
            sports="[]", volunteer_department="Operations",
            volunteer_rationale="I can organise schedules and help coordinate match-day logistics.",
        )
    data.update(overrides)
    return client.post(
        "/api/registrations",
        data=data,
        files={"photo": ("photo.png", image_bytes if image_bytes is not None else photo(), "image/png")},
    )


def token():
    with Session() as db:
        email = db.scalar(select(EmailJob).order_by(EmailJob.id))
        return re.search(r"token=([\w-]+)", email.body)[1]


def test_registration_verification_and_photo_privacy(client):
    response = register(client)
    assert response.status_code == 201
    identifier = response.json()["id"]
    assert client.get(f"/api/photos/{identifier}").status_code == 404
    assert (
        client.post("/api/registrations/verify", json={"token": token()}).status_code
        == 200
    )
    image = client.get(f"/api/photos/{identifier}")
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(image.content)).size == (600, 600)
    assert (
        client.post("/api/registrations/verify", json={"token": token()}).status_code
        == 200
    )
    assert register(client).status_code == 409


def test_allowed_domains_and_roles(client):
    for email in [
        "student@gmail.com",
        "student@stud.tiss.edu.evil",
        "student@evil.tiss.edu",
        "student@tiss.edu",
        "student@stud.tiss.ac.in.evil",
    ]:
        assert register(client, email=email).status_code == 422
    assert register(client, email="STUDENT@STUD.TISS.EDU").status_code == 201
    assert (
        register(client, email="student@stud.tiss.edu", role="volunteer").status_code == 201
    )


def test_volunteer_photo_remains_private(client):
    result = register(client, role="volunteer")
    identifier = result.json()["id"]
    assert (
        client.post("/api/registrations/verify", json={"token": token()}).status_code
        == 200
    )
    assert client.get(f"/api/photos/{identifier}").status_code == 404


def test_expired_verification(client):
    register(client)
    with Session.begin() as db:
        db.scalar(select(Registration)).verification_expires = now() - timedelta(
            seconds=1
        )
    assert (
        client.post("/api/registrations/verify", json={"token": token()}).status_code
        == 400
    )


def test_invalid_sports_consent_and_image(client):
    assert register(client, sports="[]").status_code == 422
    assert register(client, sports='["Basketball"] ').status_code == 422
    assert register(client, sports="[{}]").status_code == 422
    assert register(client, consent="false").status_code == 422
    data = {
        "name": "Student",
        "email": "s@stud.tiss.edu",
        "role": "player",
        "programme": "BSW",
        "year": 1,
        "age": 20,
        "gender": "others",
        "region": "Delhi",
        "played_before": "no",
        "sports": '["Football"]',
        "consent": True,
    }
    assert (
        client.post(
            "/api/registrations",
            data=data,
            files={"photo": ("bad.png", b"not an image", "image/png")},
        ).status_code
        == 422
    )


@pytest.mark.parametrize("sport", ["Football", "Cricket", "Badminton", "Table tennis", "Weightlifting", "Chess", "Tug of war", "Dodgeball"])
def test_current_sports_are_accepted(client, sport):
    response = register(client, sports=json.dumps([sport]))
    assert response.status_code == 201
    with Session() as db:
        registration = db.scalar(select(Registration))
        assert registration.sports == [sport]


@pytest.mark.parametrize("sport", ["Basketball", "Volleyball"])
def test_removed_sports_are_rejected(client, sport):
    assert register(client, sports=json.dumps([sport])).status_code == 422


def test_closed_registration(admin_client):
    register(admin_client)
    admin_client.post("/api/registrations/verify", json={"token": token()})
    from uuid import uuid4

    assert (
        admin_client.post(
            "/api/admin/auction/start", json={"version": 0, "command_id": str(uuid4())}
        ).status_code
        == 200
    )
    assert register(admin_client, email="another@stud.tiss.edu").status_code == 409


def test_cookie_is_httponly(client):
    response = client.post(
        "/api/admin/login", json={"password": "test-password-for-blitz"}
    )
    assert (
        "HttpOnly" in response.headers["set-cookie"]
        and "SameSite=strict" in response.headers["set-cookie"]
    )
    assert client.get("/api/admin/me").status_code == 200
    client.post("/api/admin/logout")
    assert client.get("/api/admin/me").status_code == 401


@pytest.mark.parametrize("field,value", [
    ("age", "0"), ("age", "121"), ("age", "20.5"), ("age", None),
    ("gender", "invalid"), ("gender", None), ("region", "Not a state"), ("region", None),
])
def test_required_demographics_are_validated(client, field, value):
    assert register(client, **{field: value}).status_code == 422


@pytest.mark.parametrize("department", config.VOLUNTEER_DEPARTMENTS)
def test_volunteer_department_and_rationale_are_saved(admin_client, department):
    response = register(admin_client, role="volunteer", volunteer_department=department)
    assert response.status_code == 201
    data = admin_client.get("/api/admin/registrations").json()[0]
    assert data["sports"] == []
    assert data["volunteer_department"] == department
    assert "coordinate" in data["volunteer_rationale"]
    assert (data["age"], data["gender"], data["region"]) == (20, "female", "Maharashtra")
    csv = admin_client.get("/api/admin/registrations.csv").text
    assert department in csv and "Maharashtra" in csv and "coordinate" in csv
    with Session() as db:
        email = db.scalar(select(EmailJob))
        assert f"Volunteer department: {department}" in email.body
        assert "Sports:" not in email.body


@pytest.mark.parametrize("overrides", [
    {"volunteer_department": ""}, {"volunteer_department": "Operations, Medical"},
    {"volunteer_department": "Football"}, {"volunteer_rationale": "   "},
    {"volunteer_rationale": "x" * 2001}, {"sports": '["Football"]'},
])
def test_volunteer_requires_one_department_and_a_statement(client, overrides):
    assert register(client, role="volunteer", **overrides).status_code == 422


@pytest.mark.parametrize("gender", ["male", "female", "others"])
def test_demographics_stay_out_of_public_player_views(client, gender):
    from app.auction import player_view
    assert register(client, gender=gender).status_code == 201
    with Session() as db:
        registration = db.scalar(select(Registration))
        public = player_view(registration)
        private = player_view(registration, admin=True)
        for field in ("age", "gender", "region", "played_before", "volunteer_department", "volunteer_rationale"):
            assert field not in public
            assert field in private
        assert private["gender"] == gender


def test_one_email_can_register_both_roles_with_independent_choices(client):
    assert register(client).status_code == 201
    assert register(client, role="volunteer", volunteer_department="Sustainability").status_code == 201
    with Session() as db:
        registrations = db.scalars(select(Registration).order_by(Registration.role)).all()
        assert len(registrations) == 2
        assert registrations[0].role == "player" and registrations[0].sports == ["Football", "Cricket"]
        assert registrations[0].volunteer_department is None
        assert registrations[1].role == "volunteer" and registrations[1].sports == []
        assert registrations[1].volunteer_department == "Sustainability"
    assert register(client, role="volunteer").status_code == 409


@pytest.mark.parametrize("role", ["player", "volunteer"])
@pytest.mark.parametrize("answer,expected", [("yes", True), ("no", False)])
def test_previous_participation_is_saved_for_both_roles(admin_client, role, answer, expected):
    assert register(admin_client, role=role, played_before=answer).status_code == 201
    saved = admin_client.get("/api/admin/registrations").json()[0]
    assert saved["played_before"] is expected
    with Session() as db:
        assert db.scalar(select(Registration)).played_before is expected
    csv = admin_client.get("/api/admin/registrations.csv").text
    assert "Played BLITZ before" in csv and ("Yes" if expected else "No") in csv


@pytest.mark.parametrize("answer", [None, "", "maybe", "true"])
def test_previous_participation_requires_an_explicit_yes_or_no(client, answer):
    assert register(client, played_before=answer).status_code == 422


def test_square_photo_is_preserved_without_a_second_portrait_crop(client):
    from PIL import ImageDraw
    selected = Image.new("RGB", (600, 600), "blue")
    ImageDraw.Draw(selected).rectangle((0, 0, 150, 150), fill="red")
    output = io.BytesIO()
    selected.save(output, "PNG")
    response = register(client, image_bytes=output.getvalue())
    assert response.status_code == 201
    assert client.post("/api/registrations/verify", json={"token": token()}).status_code == 200
    saved = Image.open(io.BytesIO(client.get(f'/api/photos/{response.json()["id"]}').content))
    assert saved.size == (600, 600)
    red = saved.getpixel((25, 25))
    blue = saved.getpixel((575, 575))
    assert red[0] > 240 and red[1] < 15 and red[2] < 15
    assert blue[2] > 240 and blue[0] < 15 and blue[1] < 15
