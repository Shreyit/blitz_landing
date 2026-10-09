import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint("email", "role"),
        CheckConstraint("role IN ('player', 'volunteer')"),
        CheckConstraint("programme IN ('BSASS', 'BSW')"),
        CheckConstraint("year BETWEEN 1 AND 4"),
        CheckConstraint("age BETWEEN 1 AND 120"),
        CheckConstraint("gender IN ('male', 'female', 'others')"),
    )
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(12))
    programme: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)
    # Nullable for existing registrations; new submissions require these fields.
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    region: Mapped[str | None] = mapped_column(String(80), nullable=True)
    played_before: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    volunteer_department: Mapped[str | None] = mapped_column(String(40), nullable=True)
    volunteer_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    sports: Mapped[list] = mapped_column(JSON)
    photo_key: Mapped[str] = mapped_column(String(80))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True
    )
    verification_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (CheckConstraint("purse BETWEEN 0 AND 2000"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    color: Mapped[str] = mapped_column(String(7))
    symbol: Mapped[str] = mapped_column(String(4))
    purse: Mapped[int] = mapped_column(Integer, default=2000)


class Auction(Base):
    __tablename__ = "auction"
    __table_args__ = (
        CheckConstraint("id = 1"),
        CheckConstraint("round BETWEEN 0 AND 3"),
        CheckConstraint("bid >= 0"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    phase: Mapped[str] = mapped_column(String(16), default="idle")
    round: Mapped[int] = mapped_column(Integer, default=0)
    queue: Mapped[list] = mapped_column(JSON, default=list)
    unsold: Mapped[list] = mapped_column(JSON, default=list)
    cursor: Mapped[int] = mapped_column(Integer, default=0)
    bid: Mapped[int] = mapped_column(Integer, default=0)
    leader: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)


class Bid(Base):
    __tablename__ = "bids"
    __table_args__ = (CheckConstraint("amount > 0"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("registrations.id"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    amount: Mapped[int] = mapped_column(Integer)
    round: Mapped[int] = mapped_column(Integer)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    command_id: Mapped[str] = mapped_column(String(36), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint("price >= 0"),
        CheckConstraint("source IN ('auction', 'random')"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("registrations.id"), unique=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    price: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Audit(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    command_id: Mapped[str] = mapped_column(String(36), unique=True)
    action: Mapped[str] = mapped_column(String(20))
    actor: Mapped[str] = mapped_column(String(30), default="organiser")
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class EmailJob(Base):
    __tablename__ = "email_outbox"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True)
    recipient: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
