"use client";
import { sportName } from "@/lib/sport-rules";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Gavel, Radio, Trophy, Users } from "lucide-react";
import { SportArt } from "./icons";
import { AuctionState, ROUND_NAMES } from "@/lib/event";
import { useAuction } from "@/lib/use-auction";
export function AuctionBoard({
  state,
  admin = false,
  onBid,
  busy = false,
}: {
  state: AuctionState;
  admin?: boolean;
  onBid?: (team: number) => void;
  busy?: boolean;
}) {
  const leader = state.teams.find((t) => t.id === state.leader);
  const player = state.current;
  return (
    <>
      <div className="auction-meta">
        <span>
          {state.phase === "preview"
            ? "Auction preview"
            : state.phase === "idle"
              ? "Waiting for the first whistle"
              : state.phase === "complete"
                ? "Auction complete"
                : state.phase === "allocation"
                  ? "Final random allocation"
                  : ROUND_NAMES[state.round]}
        </span>
        <span>₹2,000 starting purse per team</span>
        <span className="auction-progress">
          {state.sold} assigned · {state.remaining} in this queue
        </span>
      </div>
      <div className="auction-layout">
        <article className="player-card">
          <div className="player-photo">
            {player?.photo ? (
              <img src={player.photo} alt={`${player.name} player portrait`} />
            ) : (
              <div className="auction-player-placeholder" aria-hidden="true">
                <SportArt sport={player?.sports[0] || "Football"} />
              </div>
            )}
            <span className="player-number">
              {state.phase === "preview"
                ? "Illustrative player card"
                : player
                  ? "Now on the floor"
                  : "BLITZ Auction Dome"}
            </span>
          </div>
          <div className="player-info">
            <h2>
              {player?.name ||
                (state.phase === "complete"
                  ? "Every player has a team."
                  : state.phase === "allocation"
                    ? "One last team-up."
                    : "The floor is getting ready.")}
            </h2>
            <p>
              {player
                ? `${player.programme} · Year ${player.year}`
                : state.phase === "idle"
                  ? "Registered players will appear when the organiser starts."
                  : state.phase === "allocation"
                    ? "Remaining players will be assigned in a saved random draw."
                    : "Explore the squads in the Teams section."}
            </p>
            <div className="tags">
              {player?.sports.map((sport) => (
                <span className="tag" key={sportName(sport)}>
                  {sportName(sport)}
                </span>
              ))}
            </div>
          </div>
        </article>
        <section className="bid-panel" aria-label="Current bid">
          <div className="bid-title">
            <span>{state.bid ? "Current bid" : "Opening bid"}</span>
            <Gavel size={20} />
          </div>
          <div className="bid-amount" aria-live="polite">
            ₹{state.bid || state.next_bid}
          </div>
          <div className="bid-leader">
            {leader ? (
              <>
                <span
                  className="team-dot"
                  style={{ background: leader.color }}
                />
                <strong>{leader.name}</strong>
                <span className="muted">is leading</span>
              </>
            ) : (
              <>
                <span className="status-dot" />
                <span className="muted">
                  {player
                    ? "Waiting for the first bid"
                    : "Waiting for the next player"}
                </span>
              </>
            )}
          </div>
          <div className="next-bid">
            <span>Next valid bid</span>
            <strong>₹{state.next_bid}</strong>
          </div>
          {admin && player && state.phase === "active" ? (
            <div className="admin-team-buttons">
              {state.teams.map((team) => (
                <button
                  key={team.id}
                  disabled={
                    busy ||
                    team.purse < state.next_bid ||
                    state.leader === team.id
                  }
                  onClick={() => onBid?.(team.id)}
                  title={
                    team.purse < state.next_bid
                      ? "Insufficient purse"
                      : state.leader === team.id
                        ? "Already leading"
                        : `Bid ₹${state.next_bid}`
                  }
                >
                  <span
                    className="team-dot"
                    style={{ background: team.color }}
                  />
                  {team.name}
                  <span>₹{state.next_bid}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="spectator-note">
              <Radio size={23} />
              <span>
                {state.phase === "preview"
                  ? "Preview mode. Connect the event server to follow real players and bids."
                  : "You’re courtside. Bids are placed by the organiser and updates appear here live."}
              </span>
            </div>
          )}
        </section>
      </div>
      <section className="purse-section">
        <h2 className="small-heading">
          The eight team purses <span>Balances after confirmed sales</span>
        </h2>
        <div className="purse-grid">
          {state.teams.map((team) => (
            <article
              className={`purse-card ${team.id === state.leader ? "is-leading" : ""}`}
              key={team.id}
            >
              <header>
                <span
                  className="team-initial"
                  style={{ background: team.color }}
                >
                  {team.symbol}
                </span>
                <h3>{team.name}</h3>
              </header>
              <div className="purse-amount">
                <strong>₹{team.purse.toLocaleString("en-IN")}</strong>
                <span>{team.players.length} players</span>
              </div>
              <div className="purse-bar">
                <span
                  style={{
                    width: `${team.purse / 20}%`,
                    background: team.color,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
      {state.history.length > 0 && (
        <section className="auction-history">
          <h2 className="small-heading">
            Recent team-ups <Trophy size={18} />
          </h2>
          {state.history.slice(0, 8).map((row, i) => (
            <div className="history-row" key={`${row.name}-${i}`}>
              <strong>{row.name}</strong>
              <span>{row.team}</span>
              <strong>
                {row.source === "random" ? "Allocated" : `₹${row.price}`}
              </strong>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function Auction() {
  const { state, connected } = useAuction();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setLoading(false), reduced ? 150 : 1600);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="page-width auction-page">
      {loading && (
        <div className="dome-loading" role="status" aria-live="polite">
          <Gavel className="dome-entry-icon" size={56} strokeWidth={1.25} />
          <h2>Stepping into the Dome.</h2>
          <p>New teammates are just a bid away.</p>
          <div className="loading-line" />
        </div>
      )}
      <div className="auction-heading">
        <div className="page-intro" data-entrance>
          <span className="section-kicker">Take your courtside seat</span>
          <h1>The Auction Dome.</h1>
          <p>Follow the bids. Watch the teams take shape.</p>
        </div>
        <div className="live-indicator">
          <i />
          {connected
            ? "Connected to the event"
            : state.phase === "preview"
              ? "Read-only preview"
              : "Reconnecting · last saved state"}
        </div>
      </div>
      <AuctionBoard state={state} />
      {state.phase === "complete" && (
        <div className="form-actions">
          <span>
            <Users size={17} /> The squads are ready.
          </span>
          <Link href="/teams" className="button">
            Meet your team <ArrowUpRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
