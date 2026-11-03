import secrets
from sqlalchemy import select, update
from fastapi import HTTPException
from .models import Assignment, Auction, Audit, Bid, EmailJob, Registration, Team


def next_bid(round_number: int, current: int) -> int:
    if round_number == 0:
        return (
            20
            if current == 0
            else current + (5 if current < 100 else 10 if current < 200 else 25)
        )
    base, increment = {1: (10, 5), 2: (2, 2), 3: (1, 1)}[round_number]
    return base if current == 0 else current + increment


def player_view(player, admin=False):
    data = dict(
        id=player.id,
        name=player.name,
        programme=player.programme,
        year=player.year,
        sports=player.sports,
        photo=f"/api/photos/{player.id}",
    )
    if admin:
        data.update(
            email=player.email, role=player.role, verified=player.verified,
            age=player.age, gender=player.gender, region=player.region,
            played_before=player.played_before,
            volunteer_department=player.volunteer_department,
            volunteer_rationale=player.volunteer_rationale,
        )
    return data


def snapshot(db):
    # Hold the auction lock while assembling a snapshot to avoid mixing a lot
    # from before a sale with balances/assignments from after it.
    auction = db.scalar(select(Auction).where(Auction.id == 1).with_for_update())
    teams = db.scalars(select(Team).order_by(Team.id)).all()
    # Fetch registrations in one query; never include private email fields in public state.
    players = {
        p.id: p
        for p in db.scalars(
            select(Registration).where(
                Registration.role == "player", Registration.verified.is_(True)
            )
        ).all()
    }
    assignments = db.scalars(select(Assignment).order_by(Assignment.id.desc())).all()
    rosters = {team.id: [] for team in teams}
    history = []
    names = {team.id: team.name for team in teams}
    for assignment in assignments:
        player = players.get(assignment.player_id)
        if not player:
            continue
        rosters[assignment.team_id].append(
            {
                **player_view(player),
                "price": assignment.price,
                "source": assignment.source,
            }
        )
        if len(history) < 20:
            history.append(
                dict(
                    name=player.name,
                    team=names[assignment.team_id],
                    price=assignment.price,
                    source=assignment.source,
                )
            )
    current_id = (
        auction.queue[auction.cursor]
        if auction.phase == "active" and auction.cursor < len(auction.queue)
        else None
    )
    current = players.get(current_id)
    return dict(
        phase=auction.phase,
        round=auction.round,
        version=auction.version,
        current=player_view(current) if current else None,
        bid=auction.bid,
        leader=auction.leader,
        next_bid=next_bid(auction.round, auction.bid),
        remaining=max(0, len(auction.queue) - auction.cursor),
        sold=len(assignments),
        total=auction.total,
        teams=[
            dict(
                id=t.id,
                name=t.name,
                color=t.color,
                symbol=t.symbol,
                purse=t.purse,
                players=rosters[t.id],
            )
            for t in teams
        ],
        history=history,
    )


def assign(db, player_id, team, price, source):
    player = db.get(Registration, player_id)
    if not player or player.role != "player" or not player.verified:
        raise HTTPException(409, "This player is not eligible for assignment.")
    db.add(Assignment(player_id=player_id, team_id=team.id, price=price, source=source))
    line = (
        f"You were assigned to {team.name} by random allocation (₹0)."
        if source == "random"
        else f"You were sold to {team.name} for ₹{price}."
    )
    db.add(
        EmailJob(
            key=f"assignment:{player_id}",
            recipient=player.email,
            subject=f"BLITZ: welcome to {team.name}",
            body=f'Hi {player.name},\n\n{line}\n\nYour sports: {", ".join(player.sports)}\n\nSee you on the court!\nThe BLITZ organising team',
        )
    )


def advance(auction):
    auction.cursor += 1
    auction.bid = 0
    auction.leader = None
    if auction.cursor < len(auction.queue):
        return
    if not auction.unsold:
        auction.phase = "complete"
        auction.queue = []
        auction.cursor = 0
    elif auction.round < 3:
        auction.round += 1
        auction.queue = list(auction.unsold)
        auction.unsold = []
        auction.cursor = 0
    else:
        auction.phase = "allocation"
        auction.queue = list(auction.unsold)
        auction.unsold = []
        auction.cursor = 0


def execute(db, action, payload):
    auction = db.scalar(select(Auction).where(Auction.id == 1).with_for_update())
    command_id = str(payload.command_id)
    existing = db.scalar(select(Audit).where(Audit.command_id == command_id))
    if existing:
        if (
            existing.action != action
            or existing.details.get("team_id") != payload.team_id
        ):
            raise HTTPException(
                409, "This command ID was already used for another action."
            )
        return
    if auction.version != payload.version:
        raise HTTPException(
            409,
            "The auction changed. The latest state has been loaded; review it and try again.",
        )
    details = {"round": auction.round, "team_id": payload.team_id}
    if action == "start":
        if auction.phase != "idle":
            raise HTTPException(409, "The auction has already started.")
        queue = list(
            db.scalars(
                select(Registration.id)
                .where(Registration.role == "player", Registration.verified.is_(True))
                .order_by(Registration.created_at, Registration.id)
            ).all()
        )
        if not queue:
            raise HTTPException(
                409,
                "There are no verified players. Verify registrations before starting.",
            )
        secrets.SystemRandom().shuffle(queue)
        auction.queue, auction.total, auction.phase = queue, len(queue), "active"
        details["queue"] = queue
    elif action == "allocate":
        if auction.phase != "allocation":
            raise HTTPException(
                409,
                "Random allocation is available only after the final rapid-fire round.",
            )
        players = list(auction.queue)
        rng = secrets.SystemRandom()
        rng.shuffle(players)
        teams = list(db.scalars(select(Team).order_by(Team.id).with_for_update()).all())
        draw = []
        for offset in range(0, len(players), len(teams)):
            rng.shuffle(teams)
            for player_id, team in zip(players[offset : offset + len(teams)], teams):
                assign(db, player_id, team, 0, "random")
                draw.append({"player_id": player_id, "team_id": team.id})
        details["draw"] = draw
        auction.phase, auction.queue, auction.cursor = "complete", [], 0
    else:
        if auction.phase != "active" or auction.cursor >= len(auction.queue):
            raise HTTPException(409, "There is no active player lot.")
        player_id = auction.queue[auction.cursor]
        details["player_id"] = player_id
        if action == "bid":
            team = db.scalar(
                select(Team).where(Team.id == payload.team_id).with_for_update()
            )
            if not team:
                raise HTTPException(400, "Choose one of the teams.")
            amount = next_bid(auction.round, auction.bid)
            if team.id == auction.leader:
                raise HTTPException(409, "This team is already leading.")
            if team.purse < amount:
                raise HTTPException(
                    409, "This team does not have enough purse for the next bid."
                )
            auction.bid, auction.leader = amount, team.id
            details["amount"] = amount
            db.add(
                Bid(
                    player_id=player_id,
                    team_id=team.id,
                    amount=amount,
                    round=auction.round,
                    command_id=command_id,
                )
            )
        elif action == "sell":
            if not auction.leader or not auction.bid:
                raise HTTPException(
                    409, "A player needs a valid bid before being sold."
                )
            team = db.scalar(
                select(Team).where(Team.id == auction.leader).with_for_update()
            )
            if team.purse < auction.bid:
                raise HTTPException(409, "The leading team cannot afford this sale.")
            assign(db, player_id, team, auction.bid, "auction")
            details.update(winner=team.id, price=auction.bid)
            team.purse -= auction.bid
            advance(auction)
        elif action == "unsold":
            if auction.bid:
                raise HTTPException(
                    409,
                    "Cancel the current bids explicitly before marking this player unsold.",
                )
            auction.unsold = [*auction.unsold, player_id]
            advance(auction)
        elif action == "cancel":
            if not auction.bid:
                raise HTTPException(409, "There are no bids to cancel.")
            details.update(
                cancelled_amount=auction.bid, cancelled_leader=auction.leader
            )
            db.execute(
                update(Bid)
                .where(
                    Bid.player_id == player_id,
                    Bid.round == auction.round,
                    Bid.cancelled.is_(False),
                )
                .values(cancelled=True)
            )
            auction.bid, auction.leader = 0, None
        else:
            raise HTTPException(404, "Unknown auction action.")
    auction.version += 1
    db.add(Audit(command_id=command_id, action=action, details=details))
    db.flush()
