"use client";
import { sportName } from "@/lib/sport-rules";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Gavel, RotateCcw, SkipForward, Trophy, Users } from "lucide-react";
import { SportArt } from "./icons";
import { BiddingRules } from "./bidding-rules";
import { AuctionState, Player, ROUND_NAMES, TEAM_BRANDING, Team, orderTeams } from "@/lib/event";
import { useAuction } from "@/lib/use-auction";

/** 1 → "1st year", 2 → "2nd year", 3 → "3rd year", 4 → "4th year". */
export function yearLabel(year: number) {
  const suffix = year % 100 >= 11 && year % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][year % 10] || "th";
  return `${year}${suffix} year`;
}

function TeamBadge({ team, className = "" }: { team: Team; className?: string }) {
  const brand = TEAM_BRANDING[team.id];
  return (
    <span
      className={`dome-badge ${className}`}
      style={{ background: brand?.logo ? brand.logoBg ?? "#000" : team.color }}
      aria-hidden="true"
    >
      {brand?.logo ? <img src={brand.logo} alt="" /> : team.symbol}
    </span>
  );
}

type Sale = { player: Player; team: Team; price: number };

/** Watches the live state and reports each new auction sale exactly once. */
function useSale(state: AuctionState) {
  const [sale, setSale] = useState<Sale | null>(null);
  const seen = useRef<{ sold: number; current: Player | null } | null>(null);
  // Kept outside the effect so live updates during the celebration don't cancel it.
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hide.current), []);
  useEffect(() => {
    if (state.phase === "preview") return;
    const before = seen.current;
    seen.current = { sold: state.sold, current: state.current };
    // The first real snapshot only sets the baseline: no confetti on page load.
    if (!before || state.sold <= before.sold || !before.current) return;
    const last = state.history[0];
    const team = state.teams.find((t) => t.name === last?.team);
    if (!last || last.source !== "auction" || !team || last.name !== before.current.name) return;
    setSale({ player: before.current, team, price: last.price });
    clearTimeout(hide.current);
    hide.current = setTimeout(() => setSale(null), 3200);
  }, [state]);
  return sale;
}

function SoldCelebration({ sale }: { sale: Sale }) {
  const brand = TEAM_BRANDING[sale.team.id];
  const colours = [sale.team.color, "#d9f46b", "#ffffff", "#e68b61", "#f6c945"];
  return (
    <div className="dome-sold" role="status" aria-live="assertive">
      <div className="dome-confetti" aria-hidden="true">
        {Array.from({ length: 70 }, (_, i) => (
          <i
            key={i}
            style={
              {
                "--x": `${(i * 37) % 100}%`,
                "--drift": `${((i * 53) % 120) - 60}px`,
                "--spin": `${((i * 71) % 720) - 360}deg`,
                "--delay": `${(i % 14) * 0.05}s`,
                "--fall": `${1.9 + (i % 7) * 0.18}s`,
                background: colours[i % colours.length],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="dome-sold-card" style={{ "--team-color": sale.team.color } as React.CSSProperties}>
        <span className="dome-sold-stamp">
          <Gavel size={22} /> Sold!
        </span>
        <div className="dome-sold-people">
          <span className="dome-sold-photo">
            {sale.player.photo ? <img src={sale.player.photo} alt="" /> : <Users size={34} />}
          </span>
          <span className="dome-sold-arrow" aria-hidden="true">→</span>
          <TeamBadge team={sale.team} className="dome-sold-team" />
        </div>
        <h2>{sale.player.name}</h2>
        <p>
          joins <strong>{sale.team.name}</strong>
          {brand?.owner ? ` · ${brand.owner}` : ""}
        </p>
        <strong className="dome-sold-price">₹{sale.price.toLocaleString("en-IN")}</strong>
      </div>
    </div>
  );
}

export function AuctionBoard({
  state,
  admin = false,
  busy = false,
  genders,
  onBid,
  onSell,
  onUnsold,
  onCancel,
}: {
  state: AuctionState;
  admin?: boolean;
  busy?: boolean;
  /** Organiser-only lookup (player id → gender); never part of the public feed. */
  genders?: Record<string, string>;
  onBid?: (team: number) => void;
  onSell?: () => void;
  onUnsold?: () => void;
  onCancel?: () => void;
}) {
  const leader = state.teams.find((t) => t.id === state.leader) ?? null;
  const player = state.current;
  const live = state.phase === "active" && !!player;
  const controls = admin && live;
  const sale = useSale(state);
  const gender = player && genders?.[player.id];
  const status =
    state.phase === "preview"
      ? "Auction preview"
      : state.phase === "idle"
        ? "Waiting for the first whistle"
        : state.phase === "complete"
          ? "Auction complete"
          : state.phase === "allocation"
            ? "Final random allocation"
            : ROUND_NAMES[state.round];
  return (
    <div className="dome">
      <section className="dome-kpis" aria-label="Team purses">
        {orderTeams(state.teams).map((team) => (
          <div
            key={team.id}
            className={`dome-kpi${team.id === state.leader ? " is-leading" : ""}`}
            style={{ "--team-color": team.color } as React.CSSProperties}
            title={`${team.name}: ₹${team.purse.toLocaleString("en-IN")} left`}
          >
            <TeamBadge team={team} />
            <span className="dome-kpi-name">{team.name}</span>
            <strong>₹{team.purse.toLocaleString("en-IN")}</strong>
          </div>
        ))}
      </section>

      <div className="dome-meta">
        <span className="dome-status">{status}</span>
        <span>
          {state.sold} sold · {state.remaining} in queue
        </span>
      </div>

      <section className="dome-stage" aria-label="Player on the floor">
        <div className="dome-photo">
          {player?.photo ? (
            <img src={player.photo} alt={`${player.name} player portrait`} />
          ) : (
            <div className="auction-player-placeholder" aria-hidden="true">
              <SportArt sport={player?.sports[0] || "Football"} />
            </div>
          )}
          {live && <span className="dome-live">Now on the floor</span>}
        </div>
        <div className="dome-player">
          <span className="section-kicker">
            {state.phase === "preview" ? "Illustrative player" : player ? "Player" : "BLITZ Auction Dome"}
          </span>
          <h2>
            {player?.name ||
              (state.phase === "complete"
                ? "Every player has a team."
                : state.phase === "allocation"
                  ? "One last team-up."
                  : "The floor is getting ready.")}
          </h2>
          {player ? (
            <dl className="dome-facts">
              <div>
                <dt>Course</dt>
                <dd>{player.programme}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{yearLabel(player.year)}</dd>
              </div>
              {admin && (
                <div>
                  <dt>Gender</dt>
                  <dd>{gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "—"}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="dome-note">
              {state.phase === "idle"
                ? "Registered players will appear when the organiser starts."
                : state.phase === "allocation"
                  ? "Remaining players will be assigned in a saved random draw."
                  : "Explore the squads in the Teams section."}
            </p>
          )}
          {player && (
            <div className="dome-sports">
              <span>Sports</span>
              <div className="tags">
                {player.sports.map((sport) => (
                  <span className="tag" key={sportName(sport)}>
                    {sportName(sport)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
          <aside
            className="dome-bar"
            aria-label="Current bid"
            style={leader ? ({ "--team-color": leader.color } as React.CSSProperties) : undefined}
          >
            <div className="dome-bid">
              <span>{state.bid ? "Current bid" : "Opening bid"}</span>
              <strong aria-live="polite">₹{(state.bid || state.next_bid).toLocaleString("en-IN")}</strong>
            </div>
            <div className="dome-leader">
              {leader ? (
                <>
                  <TeamBadge team={leader} />
                  <span>
                    <strong>{leader.name}</strong>
                    <small>leads · next bid ₹{state.next_bid}</small>
                  </span>
                </>
              ) : (
                <span className="dome-waiting">
                  {live ? "Waiting for the first bid" : "Waiting for the next player"}
                </span>
              )}
            </div>
            {controls && (
              <div className="dome-actions">
                <button type="button" className="dome-secondary" aria-label="Clear bids" disabled={busy || !state.bid} onClick={onCancel}>
                  <RotateCcw size={15} /> <span>Clear bids</span>
                </button>
                <button type="button" className="dome-secondary" aria-label="Mark unsold" disabled={busy || state.bid > 0} onClick={onUnsold}>
                  <SkipForward size={15} /> <span>Unsold</span>
                </button>
                <button type="button" className="dome-sell" disabled={busy || !leader} onClick={onSell}>
                  <Gavel size={22} /> Sold
                </button>
              </div>
            )}
          </aside>
      </section>

      <section className="dome-teams" aria-label={controls ? "Bid for a team" : "Teams"}>
        {orderTeams(state.teams).map((team) => {
          const brand = TEAM_BRANDING[team.id];
          const leading = team.id === state.leader;
          const short = team.purse < state.next_bid;
          const body = (
            <>
              <TeamBadge team={team} />
              <span className="dome-team-text">
                <strong>{team.name}</strong>
                <small>{brand?.owner ?? "Owner to be announced"}</small>
              </span>
              <span className="dome-team-tag">
                {leading ? "Leading" : controls ? (short ? "Purse short" : `Bid ₹${state.next_bid}`) : null}
              </span>
            </>
          );
          const style = { "--team-color": team.color } as React.CSSProperties;
          const className = `dome-team${leading ? " is-leading" : ""}`;
          return controls ? (
            <button
              key={team.id}
              type="button"
              className={className}
              style={style}
              disabled={busy || short || leading}
              onClick={() => onBid?.(team.id)}
              aria-label={leading ? `${team.name} is leading` : `Bid ₹${state.next_bid} for ${team.name}`}
            >
              {body}
            </button>
          ) : (
            <div key={team.id} className={className} style={style}>
              {body}
            </div>
          );
        })}
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
              <strong>{row.source === "random" ? "Allocated" : `₹${row.price}`}</strong>
            </div>
          ))}
        </section>
      )}
      {sale && <SoldCelebration key={`${sale.player.id}-${state.sold}`} sale={sale} />}
    </div>
  );
}
export function Auction() {
  const { state, connected } = useAuction();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"live" | "rules">("live");
  useEffect(() => {
    if (location.hash === "#how-bidding-works") setView("rules");
  }, []);
  const choose = (next: "live" | "rules") => {
    setView(next);
    history.replaceState(null, "", next === "rules" ? "#how-bidding-works" : location.pathname);
  };
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
      <div className="auction-tabs" role="tablist" aria-label="Auction Dome sections">
        <button
          type="button"
          role="tab"
          id="tab-live"
          aria-selected={view === "live"}
          aria-controls="panel-live"
          className={view === "live" ? "is-active" : undefined}
          onClick={() => choose("live")}
        >
          <Gavel size={16} /> Live Dome
        </button>
        <button
          type="button"
          role="tab"
          id="tab-rules"
          aria-selected={view === "rules"}
          aria-controls="panel-rules"
          className={view === "rules" ? "is-active" : undefined}
          onClick={() => choose("rules")}
        >
          <BookOpen size={16} /> How bidding works
        </button>
      </div>
      <div role="tabpanel" id="panel-live" aria-labelledby="tab-live" hidden={view !== "live"}>
        <AuctionBoard state={state} />
      </div>
      <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules" hidden={view !== "rules"}>
        {view === "rules" && <BiddingRules state={state} />}
      </div>
      {view === "live" && state.phase === "complete" && (
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
