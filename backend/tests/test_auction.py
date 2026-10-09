from uuid import uuid4
import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from app.auction import execute, next_bid, snapshot
from app.database import Session
from app.main import AuctionCommand
from app.models import Assignment, Auction, Audit, EmailJob, Registration, Team


def seed(count=1, volunteer=False, verified=True):
    with Session.begin() as db:
        ids = []
        for index in range(count):
            player = Registration(
                name=f"Test player {index}",
                email=f"player{index}@stud.tiss.ac.in",
                role="volunteer" if volunteer else "player",
                programme="BSASS",
                year=2,
                sports=["Football"],
                photo_key=f"{uuid4()}.jpg",
                verified=verified,
            )
            db.add(player)
            db.flush()
            ids.append(player.id)
        return ids


def run(action, team_id=None, command_id=None, version=None):
    with Session.begin() as db:
        current = snapshot(db)
        execute(
            db,
            action,
            AuctionCommand(
                version=current["version"] if version is None else version,
                command_id=command_id or uuid4(),
                team_id=team_id,
            ),
        )
        return snapshot(db)


@pytest.mark.parametrize(
    ("round_number", "current", "expected"),
    [
        (0, 0, 20),
        (0, 20, 25),
        (0, 95, 100),
        (0, 100, 110),
        (0, 190, 200),
        (0, 200, 225),
        (0, 225, 250),
        (1, 0, 10),
        (1, 10, 15),
        (1, 100, 105),
        (2, 0, 2),
        (2, 2, 4),
        (3, 0, 1),
        (3, 1, 2),
    ],
)
def test_price_boundaries(round_number, current, expected):
    assert next_bid(round_number, current) == expected


def test_sale_is_atomic_and_idempotent():
    seed(2)
    run("start")
    run("bid", 1)
    state = run("bid", 2)
    assert state["bid"] == 25 and state["leader"] == 2
    command_id = uuid4()
    before = state["version"]
    sold = run("sell", command_id=command_id)
    assert sold["teams"][1]["purse"] == 1975
    assert sold["sold"] == 1 and sold["bid"] == 0 and sold["leader"] is None
    repeated = run("sell", command_id=command_id, version=before)
    assert repeated["sold"] == 1 and repeated["teams"][1]["purse"] == 1975
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(Assignment)) == 1
        assert db.scalar(select(func.count()).select_from(EmailJob)) == 1


def test_purse_leader_and_stale_commands():
    seed()
    run("start")
    with Session.begin() as db:
        db.get(Team, 1).purse = 19
    with pytest.raises(HTTPException, match="purse"):
        run("bid", 1)
    with Session.begin() as db:
        db.get(Team, 1).purse = 20
    state = run("bid", 1)
    with pytest.raises(HTTPException, match="leading"):
        run("bid", 1)
    with pytest.raises(HTTPException, match="changed"):
        run("bid", 2, version=state["version"] - 1)
    with pytest.raises(HTTPException, match="Cancel"):
        run("unsold")
    assert run("sell")["teams"][0]["purse"] == 0


def test_cancel_preserves_bid_audit():
    seed()
    run("start")
    run("bid", 1)
    state = run("cancel")
    assert state["bid"] == 0 and state["leader"] is None
    with Session() as db:
        assert (
            db.scalar(select(Audit).where(Audit.action == "cancel")).details[
                "cancelled_amount"
            ]
            == 20
        )
    assert run("unsold")["round"] == 1


def test_round_queues_only_include_unsold_players():
    seed(3)
    run("start")
    run("bid", 1)
    run("sell")
    run("unsold")
    state = run("unsold")
    assert state["round"] == 1 and state["remaining"] == 2 and state["next_bid"] == 10
    run("bid", 2)
    run("sell")
    state = run("unsold")
    assert state["round"] == 2 and state["remaining"] == 1 and state["next_bid"] == 2
    state = run("unsold")
    assert state["round"] == 3 and state["next_bid"] == 1
    state = run("unsold")
    assert state["phase"] == "allocation" and state["remaining"] == 1
    state = run("allocate")
    assert state["phase"] == "complete" and state["sold"] == 3


@pytest.mark.parametrize("count", [1, 7, 8, 9, 19])
def test_random_distribution_is_saved_and_balanced(count):
    seed(count)
    run("start")
    for _ in range(count * 4):
        run("unsold")
    state = run("allocate")
    sizes = [len(team["players"]) for team in state["teams"]]
    assert sum(sizes) == count and max(sizes) - min(sizes) <= 1
    assert all(team["purse"] == 2000 for team in state["teams"])
    assert all(
        p["price"] == 0 and p["source"] == "random"
        for t in state["teams"]
        for p in t["players"]
    )
    with pytest.raises(HTTPException, match="final rapid"):
        run("allocate")
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(Assignment)) == count
        assert db.scalar(select(func.count()).select_from(EmailJob)) == count


def test_selling_every_player_finishes_without_empty_rounds():
    seed()
    run("start")
    run("bid", 1)
    state = run("sell")
    assert state["phase"] == "complete" and state["remaining"] == 0


@pytest.mark.parametrize(("volunteer", "verified"), [(True, True), (False, False)])
def test_only_verified_players_enter_queue(volunteer, verified):
    seed(volunteer=volunteer, verified=verified)
    with pytest.raises(HTTPException, match="no verified"):
        run("start")


def test_private_email_never_appears_in_snapshot():
    seed()
    run("start")
    run("bid", 1)
    run("sell")
    with Session() as db:
        assert "@stud.tiss.ac.in" not in str(snapshot(db))


def test_admin_auth_required(client):
    assert client.get("/api/admin/registrations").status_code == 401
    assert (
        client.post(
            "/api/admin/auction/start", json={"version": 0, "command_id": str(uuid4())}
        ).status_code
        == 401
    )


def test_http_commands_and_reload(admin_client):
    seed()
    response = admin_client.post(
        "/api/admin/auction/start", json={"version": 0, "command_id": str(uuid4())}
    )
    assert response.status_code == 200
    state = response.json()
    response = admin_client.post(
        "/api/admin/auction/bid",
        json={"version": state["version"], "command_id": str(uuid4()), "team_id": 3},
    )
    assert response.json()["bid"] == 20
    assert admin_client.get("/api/auction").json()["leader"] == 3


def test_cross_origin_command_rejected(admin_client):
    assert (
        admin_client.post(
            "/api/admin/auction/start",
            headers={"origin": "https://other.example"},
            json={"version": 0, "command_id": str(uuid4())},
        ).status_code
        == 403
    )
