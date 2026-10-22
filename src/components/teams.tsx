"use client";
import { sportName } from "@/lib/sport-rules";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, UserRound, X } from "lucide-react";
import { useAuction } from "@/lib/use-auction";
import { reactMascot } from "@/lib/mascot-behavior";
import { TEAM_BRANDING, type Team } from "@/lib/event";
export function Teams() {
  const { state, connected } = useAuction();
  const [openId, setOpenId] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // Read the live team so the popup's roster updates while it is open.
  const openTeam = state.teams.find((team) => team.id === openId) ?? null;
  useEffect(() => {
    if (openTeam && !dialog.current?.open) dialog.current?.showModal();
  }, [openTeam]);
  const showSquad = (team: Team) => {
    setOpenId(team.id);
    reactMascot(
      {
        action: "celebrate",
        message: `${team.name}. That’s your squad spirit!`,
        accent: team.color,
      },
      3500,
    );
  };
  return (
    <div className="page-width">
      <div className="page-intro" data-entrance>
        <span className="section-kicker">Eight colours. One campus.</span>
        <h1>Meet your people.</h1>
        <p>
          New teammates, familiar faces, and a jersey to make your own. Player
          rosters appear as the auction progresses.
        </p>
      </div>
      {!connected && (
        <div className="notice">
          Team identities are provisional. Live rosters will appear when the
          event server is connected.
        </div>
      )}
      <div className="teams-grid">
        {state.teams.map((team) => {
          const brand = TEAM_BRANDING[team.id];
          return (
          <article
            className="team-card"
            key={team.id}
            style={{ "--team-color": team.color } as React.CSSProperties}
            data-reveal
          >
            <div
              className={brand?.logo ? "team-emblem team-emblem-logo" : "team-emblem"}
              style={
                brand?.logo
                  ? ({
                      "--logo-bg": brand.logoBg ?? "#000",
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {brand?.logo ? (
                <img className="team-logo" src={brand.logo} alt={`${team.name} logo`} />
              ) : (
                <>
                  <span className="team-initials" aria-hidden="true">{team.symbol}</span>
                  <span className="team-logo-soon">Logo coming soon</span>
                </>
              )}
            </div>
            <div className="team-card-body">
              <h2>{team.name}</h2>
              <p className="team-owner-line">
                <span>Owner</span>
                <strong className={brand?.owner ? "team-owner" : "team-owner is-tba"}>
                  {brand?.owner ?? "To be announced"}
                </strong>
              </p>
              <div className="team-card-stats">
                <div>
                  <strong>{team.players.length}</strong>
                  <small>{team.players.length === 1 ? "player" : "players"}</small>
                </div>
                <div>
                  <strong>₹{team.purse.toLocaleString("en-IN")}</strong>
                  <small>purse left</small>
                </div>
              </div>
              <button
                type="button"
                className="team-squad-button"
                aria-haspopup="dialog"
                onClick={() => showSquad(team)}
              >
                View the squad <ArrowUpRight size={15} />
              </button>
            </div>
          </article>
          );
        })}
      </div>
      <dialog
        ref={dialog}
        className="squad-dialog"
        aria-labelledby="squad-dialog-title"
        onClose={() => setOpenId(null)}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        style={openTeam ? ({ "--team-color": openTeam.color } as React.CSSProperties) : undefined}
        data-lenis-prevent
      >
        {openTeam && <SquadSheet team={openTeam} onClose={() => dialog.current?.close()} />}
      </dialog>
    </div>
  );
}
function SquadSheet({ team, onClose }: { team: Team; onClose: () => void }) {
  const brand = TEAM_BRANDING[team.id];
  return (
    <>
      <header className="squad-head">
        <div className="squad-badge" style={brand?.logoBg ? { background: brand.logoBg } : undefined}>
          {brand?.logo ? <img src={brand.logo} alt="" /> : <span>{team.symbol}</span>}
        </div>
        <div>
          <h2 id="squad-dialog-title">{team.name}</h2>
          <p className="team-owner-line">
            <span>Owner</span>
            <strong className={brand?.owner ? "team-owner" : "team-owner is-tba"}>
              {brand?.owner ?? "To be announced"}
            </strong>
          </p>
        </div>
        <button type="button" className="squad-close" aria-label="Close squad" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="team-card-stats">
        <div>
          <strong>{team.players.length}</strong>
          <small>{team.players.length === 1 ? "player" : "players"}</small>
        </div>
        <div>
          <strong>₹{team.purse.toLocaleString("en-IN")}</strong>
          <small>purse left</small>
        </div>
      </div>
      <div className="squad-list">
        {team.players.length ? (
          team.players.map((player) => (
            <div key={player.id} className="roster-person">
              {player.photo ? (
                <img src={player.photo} alt={player.name} />
              ) : (
                <span className="roster-avatar">
                  <UserRound size={18} />
                </span>
              )}
              <div>
                <strong>{player.name}</strong>
                <small>
                  {player.programme} · Year {player.year} ·{" "}
                  {player.source === "random" ? "Allocated" : `₹${player.price}`}
                </small>
                <p className="roster-sports">{player.sports.map(sportName).join(", ")}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-message">The first team-up is still to come.</p>
        )}
      </div>
    </>
  );
}
