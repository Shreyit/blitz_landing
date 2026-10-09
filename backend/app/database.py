from pathlib import Path
from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.schema import CreateColumn
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL, TEAMS
from .models import Auction, Base, Registration, Team

if DATABASE_URL.startswith("sqlite:///"):
    Path(DATABASE_URL.removeprefix("sqlite:///")).parent.mkdir(
        parents=True, exist_ok=True
    )
engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    ),
    pool_pre_ping=True,
)
if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


Session = sessionmaker(engine, expire_on_commit=False)


def upgrade_registration_columns(connection):
    """Add the intake fields without changing or inventing existing player data."""
    existing = {column["name"] for column in inspect(connection).get_columns("registrations")}
    for name in ("age", "gender", "region", "played_before", "volunteer_department", "volunteer_rationale"):
        if name not in existing:
            column = Registration.__table__.c[name]
            definition = str(CreateColumn(column).compile(dialect=connection.dialect))
            connection.execute(text(f"ALTER TABLE registrations ADD COLUMN {definition}"))


def initialize():
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            # Serialize first-run schema/seed initialization across API workers.
            connection.execute(text("SELECT pg_advisory_xact_lock(76284201)"))
        Base.metadata.create_all(connection)
        upgrade_registration_columns(connection)
        if (
            connection.execute(
                select(Auction.id).where(Auction.id == 1)
            ).scalar_one_or_none()
            is None
        ):
            connection.execute(
                Team.__table__.insert(),
                [
                    dict(id=index, name=name, color=color, symbol=symbol, purse=2000)
                    for index, (name, color, symbol) in enumerate(TEAMS, 1)
                ],
            )
            connection.execute(
                Auction.__table__.insert().values(
                    id=1,
                    phase="idle",
                    round=0,
                    queue=[],
                    unsold=[],
                    cursor=0,
                    bid=0,
                    leader=None,
                    version=0,
                    total=0,
                )
            )
