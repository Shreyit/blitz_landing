import asyncio
import csv
import hashlib
import hmac
import io
import json
import re
import secrets
import threading
import warnings
from contextlib import asynccontextmanager
from datetime import timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from . import config
from .auction import execute, player_view, snapshot
from .database import Session, initialize
from .models import Auction, Audit, EmailJob, Registration, Team, now
from .security import admin, new_session, rate_limit, valid_session

# PostgreSQL row locks are the cross-worker protection. This lock also supports single-process SQLite development.
mutation_lock = threading.RLock()
Image.MAX_IMAGE_PIXELS = 12_000_000


@asynccontextmanager
async def lifespan(app):
    if config.PRODUCTION and not config.DATABASE_URL.startswith("postgresql"):
        raise RuntimeError("Production requires PostgreSQL.")
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    initialize()
    yield


app = FastAPI(title="BLITZ event API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(config.ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def request_checks(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin not in config.ALLOWED_ORIGINS:
            return PlainTextResponse("Origin is not permitted.", status_code=403)
        length = request.headers.get("content-length")
        try:
            if length and int(length) > 6 * 1024 * 1024:
                return Response(
                    content=json.dumps(
                        {
                            "detail": "The upload is too large. Maximum photo size is 5 MB."
                        }
                    ),
                    status_code=413,
                    media_type="application/json",
                )
        except ValueError:
            return Response(status_code=400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path.startswith("/api/admin"):
        response.headers["Cache-Control"] = "no-store"
    return response


class Credentials(BaseModel):
    password: str = Field(max_length=200)


class Verification(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class AuctionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=0)
    command_id: UUID
    team_id: int | None = Field(default=None, ge=1, le=8)


class TeamIdentity(BaseModel):
    id: int = Field(ge=1, le=8)
    name: str = Field(min_length=2, max_length=60)


class TeamConfiguration(BaseModel):
    version: int = Field(ge=0)
    command_id: UUID
    teams: list[TeamIdentity] = Field(min_length=len(config.TEAMS), max_length=len(config.TEAMS))


def verification_email(db, registration, token):
    selection = (
        f'Sports: {", ".join(registration.sports)}'
        if registration.role == "player"
        else f'Volunteer department: {registration.volunteer_department}'
    )
    db.add(
        EmailJob(
            key=f"registration:{registration.id}",
            recipient=registration.email,
            subject="BLITZ: your registration is in",
            body=f'Hi {registration.name},\n\nYour {registration.role} registration for BLITZ is saved.\nProgramme: {registration.programme}, year {registration.year}\n{selection}\n\nVerify your email before the auction starts:\n{config.PUBLIC_URL}/verify?token={token}\n\nThis link expires in 48 hours. Your email is never shown on public rosters.\n\nSee you on the court!\nThe BLITZ organising team',
        )
    )


@app.get("/api/health")
def health():
    with Session() as db:
        db.execute(select(Auction.id))
    return {"status": "ok"}


@app.post("/api/registrations", status_code=201)
async def register(
    request: Request,
    name: str = Form(max_length=100),
    email: str = Form(max_length=200),
    role: Literal["player", "volunteer"] = Form(),
    programme: Literal["BSASS", "BSW"] = Form(),
    year: int = Form(ge=1, le=4),
    age: int = Form(ge=1, le=120),
    gender: Literal["male", "female", "others"] = Form(),
    region: str = Form(max_length=80),
    played_before: Literal["yes", "no"] = Form(),
    sports: str = Form(default="[]", max_length=1000),
    volunteer_department: str = Form(default="", max_length=40),
    volunteer_rationale: str = Form(default="", max_length=2000),
    consent: bool = Form(),
    photo: UploadFile = File(),
):
    rate_limit(request, "register", limit=20)
    name, email = name.strip(), email.strip().lower()
    if len(name) < 2 or any(ord(c) < 32 for c in name):
        raise HTTPException(422, "Enter a valid full name.")
    if not re.fullmatch(
        r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(stud\.tiss\.ac\.in|stud\.tiss\.edu)", email
    ):
        raise HTTPException(422, "Use an @stud.tiss.ac.in or @stud.tiss.edu email address.")
    if not consent:
        raise HTTPException(422, "Consent is required to register.")
    region = region.strip()
    if region not in config.REGIONS:
        raise HTTPException(422, "Select a valid Indian state or union territory.")
    volunteer_department, volunteer_rationale = volunteer_department.strip(), volunteer_rationale.strip()
    try:
        chosen = json.loads(sports)
        if (
            not isinstance(chosen, list)
            or (role == "player" and not chosen)
            or len(chosen) > len(config.SPORTS)
            or any(
                not isinstance(sport, str) or sport not in config.SPORTS
                for sport in chosen
            )
        ):
            raise ValueError()
        chosen = list(dict.fromkeys(chosen))
    except (ValueError, TypeError):
        raise HTTPException(422, "Choose valid sports for a player registration.")
    if role == "volunteer":
        if chosen:
            raise HTTPException(422, "Choose a volunteer department instead of sports.")
        if volunteer_department not in config.VOLUNTEER_DEPARTMENTS:
            raise HTTPException(422, "Choose exactly one valid volunteer department.")
        if not volunteer_rationale or any(ord(char) < 32 and char not in "\n\r\t" for char in volunteer_rationale):
            raise HTTPException(422, "Explain why you’re suitable and how you can contribute.")
    elif volunteer_department or volunteer_rationale:
        raise HTTPException(422, "Volunteer details belong in a separate volunteer registration.")
    content = await photo.read(5 * 1024 * 1024 + 1)
    await photo.close()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Choose a photo smaller than 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError()
                # Normalize pixels and discard metadata; never serve the original upload.
                normalized = ImageOps.fit(
                    ImageOps.exif_transpose(source).convert("RGB"),
                    (600, 600),
                    method=Image.Resampling.LANCZOS,
                )
                output = io.BytesIO()
                normalized.save(output, format="JPEG", quality=85)
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            422, "Upload a valid JPEG, PNG or WebP photo up to 12 megapixels."
        )
    identifier = str(uuid4())
    photo_key = f"{identifier}.jpg"
    path = config.UPLOAD_DIR / photo_key
    token = secrets.token_urlsafe(32)
    with mutation_lock:
        try:
            with Session.begin() as db:
                auction = db.scalar(
                    select(Auction).where(Auction.id == 1).with_for_update()
                )
                if auction.phase != "idle":
                    raise HTTPException(
                        409, "Registration has closed because the auction has started."
                    )
                if db.scalar(
                    select(Registration.id).where(
                        Registration.email == email, Registration.role == role
                    )
                ):
                    raise HTTPException(
                        409,
                        "This email already has a registration for that role. Check your confirmation email.",
                    )
                registration = Registration(
                    id=identifier,
                    name=name,
                    email=email,
                    role=role,
                    programme=programme,
                    year=year,
                    age=age,
                    gender=gender,
                    region=region,
                    played_before=played_before == "yes",
                    volunteer_department=volunteer_department or None,
                    volunteer_rationale=volunteer_rationale or None,
                    sports=chosen,
                    photo_key=photo_key,
                    verification_hash=hashlib.sha256(token.encode()).hexdigest(),
                    verification_expires=now() + timedelta(hours=48),
                )
                db.add(registration)
                verification_email(db, registration, token)
                path.write_bytes(output.getvalue())
                db.flush()
        except IntegrityError:
            path.unlink(missing_ok=True)
            raise HTTPException(409, "This email is already registered for that role.")
        except Exception:
            path.unlink(missing_ok=True)
            raise
    return {
        "id": identifier,
        "message": "Registration saved. Check your institutional inbox to verify your email.",
    }


@app.post("/api/registrations/verify")
def verify(payload: Verification, request: Request):
    rate_limit(request, "verify", limit=30)
    with mutation_lock, Session.begin() as db:
        auction = db.scalar(select(Auction).where(Auction.id == 1).with_for_update())
        registration = db.scalar(
            select(Registration)
            .where(
                Registration.verification_hash
                == hashlib.sha256(payload.token.encode()).hexdigest()
            )
            .with_for_update()
        )
        if not registration:
            raise HTTPException(400, "This verification link is invalid.")
        if registration.verified:
            return {"message": "Your email is already verified. See you at BLITZ!"}
        expiry = registration.verification_expires.replace(tzinfo=timezone.utc)
        if expiry < now():
            raise HTTPException(
                400,
                "This verification link has expired. Contact the organising team for help.",
            )
        if registration.role == "player" and auction.phase != "idle":
            raise HTTPException(
                409,
                "The player queue is already frozen. Contact the organiser about your registration.",
            )
        registration.verified = True
    return {"message": "Your email is verified. Your BLITZ registration is complete."}


@app.get("/api/photos/{identifier}")
def photo(identifier: UUID, request: Request):
    with Session() as db:
        registration = db.get(Registration, str(identifier))
        if not registration or not (
            valid_session(request.cookies.get("blitz_admin", ""))
            or registration.role == "player"
            and registration.verified
        ):
            raise HTTPException(404, "Photo not found.")
        path = config.UPLOAD_DIR / registration.photo_key
        if not path.is_file():
            raise HTTPException(404, "Photo not found.")
        return FileResponse(
            path,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=300"},
        )


@app.get("/api/auction")
def auction_state():
    with Session() as db:
        return snapshot(db)


@app.websocket("/api/auction/live")
async def live(socket: WebSocket):
    origin = socket.headers.get("origin")
    if origin and origin not in config.ALLOWED_ORIGINS:
        await socket.close(code=1008)
        return
    await socket.accept()
    try:
        last_version = -1
        while True:
            with Session() as db:
                version = db.scalar(select(Auction.version).where(Auction.id == 1))
                data = snapshot(db) if version != last_version else None
            if data:
                await socket.send_json(data)
                last_version = data["version"]
            # Detect disconnected clients even while the event is idle.
            try:
                message = await asyncio.wait_for(socket.receive(), timeout=1)
                if message["type"] == "websocket.disconnect":
                    break
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass


@app.post("/api/admin/login")
def login(payload: Credentials, request: Request, response: Response):
    rate_limit(request, "login", limit=8)
    if not config.ADMIN_PASSWORD:
        raise HTTPException(
            503,
            "Organiser access is not configured. Set ADMIN_PASSWORD in the backend environment.",
        )
    if not hmac.compare_digest(
        payload.password.encode(), config.ADMIN_PASSWORD.encode()
    ):
        raise HTTPException(401, "That organiser password is incorrect.")
    response.set_cookie(
        "blitz_admin",
        new_session(),
        max_age=12 * 3600,
        httponly=True,
        secure=config.PRODUCTION,
        samesite="strict",
        path="/",
    )
    return {"authenticated": True}


@app.post("/api/admin/logout")
def logout(response: Response):
    response.delete_cookie("blitz_admin", path="/")
    return {"authenticated": False}


@app.get("/api/admin/me")
def me(actor=Depends(admin)):
    return {"authenticated": True}


@app.post("/api/admin/auction/{action}")
def auction_command(
    action: Literal["start", "bid", "sell", "unsold", "cancel", "allocate"],
    payload: AuctionCommand,
    actor=Depends(admin),
):
    with mutation_lock, Session.begin() as db:
        execute(db, action, payload)
        return snapshot(db)


@app.get("/api/admin/registrations")
def registrations(actor=Depends(admin)):
    with Session() as db:
        return [
            player_view(player, admin=True)
            for player in db.scalars(
                select(Registration).order_by(Registration.created_at)
            ).all()
        ]


@app.get("/api/admin/registrations.csv")
def export(actor=Depends(admin)):
    def safe(value):
        value = str(value)
        return (
            "'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r")) else value
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Name", "Email", "Role", "Programme", "Year", "Age", "Gender", "Region", "Played BLITZ before", "Sports", "Volunteer department", "Volunteer rationale", "Verified"]
    )
    with Session() as db:
        for player in db.scalars(
            select(Registration).order_by(Registration.created_at)
        ).all():
            writer.writerow(
                [
                    safe(value)
                    for value in [
                        player.name,
                        player.email,
                        player.role,
                        player.programme,
                        player.year,
                        player.age if player.age is not None else "",
                        player.gender or "",
                        player.region or "",
                        "" if player.played_before is None else "Yes" if player.played_before else "No",
                        ", ".join(player.sports),
                        player.volunteer_department or "",
                        player.volunteer_rationale or "",
                        player.verified,
                    ]
                ]
            )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="blitz-registrations.csv"'
        },
    )


@app.get("/api/admin/emails")
def emails(actor=Depends(admin)):
    with Session() as db:
        return [
            dict(
                id=job.id,
                recipient=job.recipient,
                subject=job.subject,
                status=job.status,
                attempts=job.attempts,
            )
            for job in db.scalars(
                select(EmailJob).order_by(EmailJob.id.desc()).limit(200)
            ).all()
        ]


@app.post("/api/admin/teams")
def configure_teams(payload: TeamConfiguration, actor=Depends(admin)):
    names = [team.name.strip() for team in payload.teams]
    if (
        {team.id for team in payload.teams} != config.TEAM_IDS
        or len(set(name.casefold() for name in names)) != len(config.TEAMS)
        or any(len(name) < 2 or any(ord(c) < 32 for c in name) for name in names)
    ):
        raise HTTPException(
            422, "Provide a distinct name for each team."
        )
    with mutation_lock, Session.begin() as db:
        auction = db.scalar(select(Auction).where(Auction.id == 1).with_for_update())
        existing = db.scalar(
            select(Audit).where(Audit.command_id == str(payload.command_id))
        )
        if existing:
            if existing.action != "teams" or existing.details.get("teams") != [
                {"id": t.id, "name": n} for t, n in zip(payload.teams, names)
            ]:
                raise HTTPException(
                    409, "This command ID was already used for another action."
                )
            return snapshot(db)
        if auction.phase != "idle":
            raise HTTPException(409, "Team names are fixed once the auction starts.")
        if auction.version != payload.version:
            raise HTTPException(409, "Event settings changed. Refresh and try again.")
        identities = []
        for entry, name in zip(payload.teams, names):
            team = db.get(Team, entry.id)
            team.name = name
            team.symbol = "".join(word[0] for word in name.split()[:2]).upper()
            identities.append({"id": team.id, "name": name})
        auction.version += 1
        db.add(
            Audit(
                command_id=str(payload.command_id),
                action="teams",
                details={"teams": identities},
            )
        )
        db.flush()
        return snapshot(db)


@app.get("/api/admin/audit")
def audit_log(actor=Depends(admin)):
    with Session() as db:
        return [
            dict(
                id=event.id,
                action=event.action,
                details=event.details,
                timestamp=event.created_at.isoformat(),
            )
            for event in db.scalars(
                select(Audit).order_by(Audit.id.desc()).limit(200)
            ).all()
        ]
