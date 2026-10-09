"use client";
import { sportName } from "@/lib/sport-rules";
import { useEffect, useState } from "react";
import { Download, Gavel, LogOut, Play, Shuffle, X } from "lucide-react";
import { api, command } from "@/lib/api";
import { AuctionState, Player } from "@/lib/event";
import { useAuction } from "@/lib/use-auction";
import { AuctionBoard } from "./auction";
import { reactMascot } from "@/lib/mascot-behavior";
import { genderLabel } from "@/lib/registration-options";
type Registration = Player & {
  role: string; email: string; verified: boolean;
  age: number | null; gender: string | null; region: string | null;
  played_before: boolean | null;
  volunteer_department: string | null; volunteer_rationale: string | null;
};
type MailJob = {
  id: number;
  recipient: string;
  subject: string;
  status: string;
  attempts: number;
};
type AuditEvent = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
};
export function Admin() {
  const { state, setState, connected, refresh } = useAuction();
  const [authenticated, setAuthenticated] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("auction");
  const [registrations, setRegistrations] = useState<Registration[]>([]),
    [jobs, setJobs] = useState<MailJob[]>([]);
  const [teamNames, setTeamNames] = useState<{ id: number; name: string }[]>(
      [],
    ),
    [audit, setAudit] = useState<AuditEvent[]>([]);
  const [teamVersion, setTeamVersion] = useState(0);
  useEffect(() => {
    if (error)
      reactMascot({
        action: "encourage",
        message: "Check the dashboard message. We can sort this.",
      });
    else if (busy)
      reactMascot(
        { action: "think", message: "Saving the event’s next move…" },
        15000,
      );
    else if (authenticated)
      reactMascot({
        action: "point",
        message:
          tab === "teams"
            ? "Eight names. Eight colours. Make them yours."
            : tab === "registrations"
              ? "Your players and volunteer crew are here."
              : tab === "emails"
                ? "Keeping an eye on the event’s outgoing mail."
                : tab === "audit"
                  ? "Every auction decision leaves a record."
                  : "You’ve got the controls. Keep it fair.",
      });
  }, [authenticated, tab, busy, error]);
  useEffect(() => {
    api("/admin/me")
      .then(() => setAuthenticated(true))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    if (tab === "registrations")
      api<Registration[]>("/admin/registrations")
        .then(setRegistrations)
        .catch((e) => setError(e.message));
    if (tab === "emails")
      api<MailJob[]>("/admin/emails")
        .then(setJobs)
        .catch((e) => setError(e.message));
    if (tab === "audit")
      api<AuditEvent[]>("/admin/audit")
        .then(setAudit)
        .catch((e) => setError(e.message));
  }, [authenticated, tab]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await command("/admin/login", { password });
      setAuthenticated(true);
      setPassword("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(name: string, extra: object = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await command<AuctionState>(`/admin/auction/${name}`, {
        version: state.version,
        command_id: crypto.randomUUID(),
        ...extra,
      });
      setState(data);
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  if (!authenticated)
    return (
      <div className="admin-login">
        <form className="form-card" onSubmit={login}>
          <span className="section-kicker">Organiser access</span>
          <h1>Behind the scoreboard.</h1>
          <p>
            Sign in to run the auction, review registrations, and check email
            delivery.
          </p>
          <label className="field">
            Organiser password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Signing in…" : "Enter organiser dashboard"}
            <Gavel size={17} />
          </button>
        </form>
      </div>
    );
  return (
    <div className="page-width auction-page">
      <div className="auction-heading">
        <div className="page-intro">
          <span className="section-kicker">Organiser dashboard</span>
          <h1>Your courtside controls.</h1>
          <p>Choose a team to place its next bid. Close each lot explicitly.</p>
        </div>
        <button
          className="button button-outline button-small"
          onClick={async () => {
            try {
              await command("/admin/logout", {});
              setAuthenticated(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
      <div className="admin-tabs" aria-label="Dashboard sections">
        {["auction", "registrations", "teams", "emails", "audit"].map(
          (value) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setError("");
                if (value === "teams") {
                  setTeamNames(
                    state.teams.map((t) => ({ id: t.id, name: t.name })),
                  );
                  setTeamVersion(state.version);
                }
              }}
            >
              {
                (
                  {
                    auction: "Auction controls",
                    registrations: "Registrations",
                    teams: "Team setup",
                    emails: "Email delivery",
                    audit: "Audit log",
                  } as Record<string, string>
                )[value]
              }
            </button>
          ),
        )}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!connected && (
        <div className="notice error">
          The event server is disconnected. Controls are unavailable until it
          reconnects.
        </div>
      )}
      {tab === "auction" && (
        <>
          <AuctionBoard
            state={state}
            admin
            onBid={(team) => action("bid", { team_id: team })}
            busy={busy || !connected}
          />
          <div className="admin-controls">
            {state.phase === "idle" && (
              <button
                className="button"
                disabled={busy || !connected}
                onClick={() => {
                  if (
                    confirm(
                      "Start the auction? This closes registration and freezes the verified player queue.",
                    )
                  )
                    action("start");
                }}
              >
                <Play size={16} /> Start auction
              </button>
            )}
            {state.phase === "active" && (
              <>
                <button
                  className="button"
                  disabled={busy || !connected || !state.leader}
                  onClick={() => {
                    const team = state.teams.find((t) => t.id === state.leader);
                    if (
                      confirm(
                        `Sell ${state.current?.name} to ${team?.name} for ₹${state.bid}?`,
                      )
                    )
                      action("sell");
                  }}
                >
                  <Gavel size={16} /> Sell player · ₹{state.bid}
                </button>
                <button
                  className="button button-outline"
                  disabled={busy || !connected || state.bid > 0}
                  onClick={() => action("unsold")}
                >
                  Mark unsold & next
                </button>
                <button
                  className="button button-outline"
                  disabled={busy || !connected || !state.bid}
                  onClick={() => {
                    if (
                      confirm(
                        "Clear all bids for this player? This will be recorded in the audit log.",
                      )
                    )
                      action("cancel");
                  }}
                >
                  <X size={15} /> Cancel current bids
                </button>
              </>
            )}
            {state.phase === "allocation" && (
              <button
                className="button"
                disabled={busy || !connected}
                onClick={() => {
                  if (
                    confirm(
                      "Randomly distribute all remaining players for ₹0? The draw is saved and cannot be rerolled.",
                    )
                  )
                    action("allocate");
                }}
              >
                <Shuffle size={17} /> Distribute remaining players
              </button>
            )}
            {state.phase === "complete" && (
              <div className="notice">
                The auction is complete. All players have a team; assignment
                emails are in the delivery queue.
              </div>
            )}
          </div>
          <div className="notice">
            The next round starts after every player in this queue has been
            announced. The same remaining purses carry across all rounds. Final
            random assignments cost ₹0.
          </div>
        </>
      )}
      {tab === "registrations" && (
        <>
          <div className="small-heading">
            {registrations.length} registrations
            <a href="/api/admin/registrations.csv" className="secondary-link">
              <Download size={15} /> Export CSV
            </a>
          </div>
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Programme / year</th>
                  <th>Age / gender</th>
                  <th>Region</th>
                  <th>Played BLITZ before</th>
                  <th>Sports / department</th>
                  <th>Volunteer contribution</th>
                  <th>Email status</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.photo && (
                        <img
                          src={r.photo}
                          alt={r.name}
                          width={32}
                          height={32}
                          style={{ objectFit: "cover", borderRadius: 3 }}
                        />
                      )}
                    </td>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.role}</td>
                    <td>
                      {r.programme} / {r.year}
                    </td>
                    <td>{r.age ?? "—"} / {r.gender ? genderLabel(r.gender) : "—"}</td>
                    <td>{r.region || "—"}</td>
                    <td>{r.played_before == null ? "—" : r.played_before ? "Yes" : "No"}</td>
                    <td>{r.role === "volunteer" ? r.volunteer_department || "—" : r.sports.map(sportName).join(", ")}</td>
                    <td>{r.volunteer_rationale ? <details className="admin-volunteer-rationale"><summary>Read statement</summary><p>{r.volunteer_rationale}</p></details> : "—"}</td>
                    <td>{r.verified ? "Verified" : "Awaiting verification"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!registrations.length && (
              <p className="empty-message" style={{ padding: 25 }}>
                No registrations yet.
              </p>
            )}
          </div>
        </>
      )}
      {tab === "emails" && (
        <>
          <h2 className="small-heading">
            Email outbox <span>Refresh this tab to check delivery</span>
          </h2>
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.recipient}</td>
                    <td>{job.subject}</td>
                    <td>{job.status}</td>
                    <td>{job.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!jobs.length && (
              <p className="empty-message" style={{ padding: 25 }}>
                No mail queued yet.
              </p>
            )}
          </div>
        </>
      )}
      {tab === "teams" && (
        <form
          className="form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const updated = await command<AuctionState>("/admin/teams", {
                version: teamVersion,
                command_id: crypto.randomUUID(),
                teams: teamNames,
              });
              setState(updated);
              setTeamVersion(updated.version);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="form-heading">Give the squads their names.</h2>
          <p className="form-subtitle">
            Set all eight names before starting. Each team begins with ₹2,000;
            team colours stay consistent.
          </p>
          <div className="field-grid">
            {teamNames.map((team, index) => (
              <label className="field" key={team.id}>
                Team {team.id}
                <input
                  value={team.name}
                  minLength={2}
                  maxLength={60}
                  required
                  disabled={state.phase !== "idle" || busy}
                  onChange={(e) =>
                    setTeamNames(
                      teamNames.map((t, i) =>
                        i === index ? { ...t, name: e.target.value } : t,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <div className="form-actions">
            <span>
              {state.phase === "idle"
                ? "Names are locked when the auction starts."
                : "The auction has started; team names are locked."}
            </span>
            <button
              className="button"
              disabled={busy || !connected || state.phase !== "idle"}
            >
              {busy ? "Saving…" : "Save eight team names"}
            </button>
          </div>
        </form>
      )}
      {tab === "audit" && (
        <>
          <h2 className="small-heading">
            Saved auction actions <span>Most recent 200 events</span>
          </h2>
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.timestamp).toLocaleString()}</td>
                    <td>{event.action}</td>
                    <td
                      style={{
                        whiteSpace: "normal",
                        maxWidth: 600,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(event.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.length && (
              <p className="empty-message" style={{ padding: 25 }}>
                No auction actions recorded yet.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
