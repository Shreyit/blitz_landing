"use client";
import { sportName } from "@/lib/sport-rules";
import { ChevronDown, UserRound } from "lucide-react";
import { useAuction } from "@/lib/use-auction";
import { reactMascot } from "@/lib/mascot-behavior";
export function Teams() {
  const { state, connected } = useAuction();
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
        {state.teams.map((team) => (
          <article
            className="team-card"
            key={team.id}
            style={{ "--team-color": team.color } as React.CSSProperties}
            data-reveal
          >
            <div className="team-emblem">
              <div className="shield">{team.symbol}</div>
            </div>
            <div className="team-card-body">
              <h2>{team.name}</h2>
              <p>Built one teammate at a time.</p>
              <div className="team-card-stats">
                <span>{team.players.length} players</span>
                <span>₹{team.purse.toLocaleString("en-IN")} remaining</span>
              </div>
              <details
                onToggle={(event) => {
                  if (event.currentTarget.open)
                    reactMascot(
                      {
                        action: "celebrate",
                        message: `${team.name}. That’s your squad spirit!`,
                        accent: team.color,
                      },
                      3500,
                    );
                }}
              >
                <summary>
                  View the squad <ChevronDown size={15} />
                </summary>
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
                          {player.source === "random"
                            ? "Allocated"
                            : `₹${player.price}`}
                        </small>
                        <p className="roster-sports">
                          {player.sports.map(sportName).join(", ")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-message">
                    The first team-up is still to come.
                  </p>
                )}
              </details>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
