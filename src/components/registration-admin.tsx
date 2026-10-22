"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Gavel, LogOut, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { api, ApiError, command } from "@/lib/api";
import { genderLabel } from "@/lib/registration-options";
import { sportName } from "@/lib/sport-rules";

type Registration = {
  id: string; name: string; email: string; role: string; programme: string;
  year: number; age: number | null; gender: string | null; region: string | null;
  sports: string[]; played_before: boolean | null;
  volunteer_department: string | null; volunteer_rationale: string | null;
  photo: string | null; created_at?: string; consent_at?: string;
};
const date = (value?: string) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
const interests = (row: Registration) => row.role === "player"
  ? row.sports.map(sportName).join(", ") : row.volunteer_department || "Not recorded";

function ProfilePhoto({ row, large = false }: { row: Registration; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  // Private photo requests must retain the browser's admin cookie.
  return row.photo && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.photo} alt={`${row.name}'s registration photo`} className={large ? "roster-photo-large" : "roster-photo"}
      loading={large ? "eager" : "lazy"} onError={() => setFailed(true)} />
  ) : <span className={large ? "roster-photo-large roster-initials" : "roster-photo roster-initials"} aria-label="Photo unavailable">{row.name.slice(0, 1)}</span>;
}

function Profile({ row, close }: { row: Registration; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const details = [
    ["Email", row.email], ["Role", row.role === "player" ? "Player" : "Volunteer"],
    ["Programme", row.programme], ["Year", String(row.year)], ["Age", row.age ?? "Not recorded"],
    ["Gender", row.gender ? genderLabel(row.gender) : "Not recorded"], ["Home state / UT", row.region || "Not recorded"],
    ["Played BLITZ before", row.played_before === null ? "Not recorded" : row.played_before ? "Yes" : "No"],
    [row.role === "player" ? "Sports" : "Department", interests(row)],
    ["Registration", "Complete"],
    ["Registered", date(row.created_at)], ["Consent recorded", date(row.consent_at)],
    ["Registration ID", row.id],
  ];
  return <dialog ref={ref} className="roster-dialog" aria-labelledby="profile-title" onClose={close}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="roster-dialog-head"><span className="section-kicker">Registration profile</span>
      <button type="button" className="roster-icon-button" onClick={close} aria-label="Close profile"><X size={21} /></button></div>
    <div className="roster-profile-heading"><ProfilePhoto row={row} large /><div><h2 id="profile-title">{row.name}</h2><p>{row.programme} · Year {row.year}</p></div></div>
    <dl className="roster-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {row.role === "volunteer" && <div className="roster-rationale"><h3>Suitability and contribution</h3><p>{row.volunteer_rationale || "Not recorded"}</p></div>}
  </dialog>;
}

function Roster({ expired, logout }: { expired: () => void; logout: () => Promise<void> }) {
  const [rows, setRows] = useState<Registration[]>([]);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [role, setRole] = useState("all");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [updated, setUpdated] = useState("");
  const [exporting, setExporting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const handleError = useCallback((err: unknown) => {
    if (err instanceof Error && err.name === "AbortError") return;
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { expired(); return; }
    if (alive.current) setError(err instanceof Error ? err.message : "Could not load registrations.");
  }, [expired]);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const data = await api<Registration[]>("/admin/registrations", { signal: request.signal });
      if (!request.signal.aborted && alive.current) {
        setRows(data); setSelected(current => data.find(row => row.id === current?.id) || null);
        setUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (err) { handleError(err); }
    finally { if (!request.signal.aborted && alive.current) setBusy(false); }
  }, [handleError]);
  useEffect(() => {
    alive.current = true; void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { alive.current = false; controller.current?.abort(); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  async function download() {
    setExporting(true); setError("");
    try {
      const response = await fetch("/api/admin/registrations.csv", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new ApiError("Could not export registrations. Please sign in again if your session expired.", response.status);
      const blob = await response.blob();
      if (!alive.current) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = "blitz-registrations.csv"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { handleError(err); }
    finally { if (alive.current) setExporting(false); }
  }
  const search = query.trim().toLowerCase();
  const filtered = rows.filter(row => (role === "all" || row.role === role)
    && [row.name, row.email, row.programme, row.region, interests(row)].some(value => value?.toLowerCase().includes(search)));
  const players = rows.filter(row => row.role === "player").length;
  const returning = rows.filter(row => row.played_before === true).length;
  return <div className="page-width roster-page">
    <header className="roster-heading"><div className="page-intro"><span className="section-kicker">Private organiser access</span><h1>Your BLITZ roster.</h1><p>Players, volunteers, and every detail they shared.</p></div>
      <div className="roster-heading-actions"><Link className="button button-small" href="/admin/auction"><Gavel size={16} /> Auction controls</Link>
      <button className="button button-outline button-small" onClick={() => { void logout().catch(handleError); }}><LogOut size={16} /> Sign out</button></div></header>
    <div className="roster-stats" aria-label="Registration totals">{[["Total registrations", rows.length], ["Players", players], ["Volunteers", rows.length - players], ["Returning participants", returning]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{busy && !updated ? "—" : count}</strong></div>)}</div>
    <p className="roster-note">Player and volunteer entries are counted separately. Registration is complete when the form is saved; email delivery runs separately.</p>
    <div className="roster-toolbar">
      <label className="roster-search"><Search size={18} /><span className="sr-only">Search registrations</span><input type="search" placeholder="Search name, email, sport, state…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="roster-filter">Role<select value={role} onChange={e => setRole(e.target.value)}><option value="all">All roles</option><option value="player">Players</option><option value="volunteer">Volunteers</option></select></label>
      <button className="button button-outline button-small" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} className={busy ? "roster-spin" : ""} /> Refresh</button>
      <button className="button button-outline button-small" disabled={exporting || !rows.length} onClick={() => void download()}><Download size={16} /> {exporting ? "Exporting…" : "Export CSV"}</button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="roster-list-status" role="status">{busy ? "Loading registrations…" : `${filtered.length} of ${rows.length} registrations`}{updated && <span>Updated {updated}</span>}</div>
    {!busy && !rows.length ? <div className="roster-empty"><Users size={32} /><h2>Your first teammates are on their way.</h2><p>Submit a player or volunteer registration. It will appear here after you refresh.</p><a className="button" href="/register">Open registration</a></div>
      : !busy && !filtered.length ? <div className="roster-empty"><h2>No matching registrations.</h2><p>Try another search or clear your filters.</p></div>
      : <div className="roster-grid" aria-busy={busy}>{filtered.map(row => <button type="button" className="roster-card" key={row.id} onClick={() => setSelected(row)} aria-label={`View ${row.name}, ${row.role} registration`}>
        <ProfilePhoto row={row} /><div className="roster-card-body"><div className="roster-card-title"><h2>{row.name}</h2><span className="roster-badge is-verified">Registered</span></div><p>{row.email}</p><p>{row.programme} · Year {row.year} · {row.role === "player" ? "Player" : "Volunteer"}</p><span className="roster-interests">{interests(row)}</span><span className="roster-view">View full profile ↗</span></div>
      </button>)}</div>}
    {selected && <Profile key={selected.id} row={selected} close={() => setSelected(null)} />}
  </div>;
}

export function RegistrationAdmin() {
  const [session, setSession] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/admin/me", { signal: controller.signal }).then(() => setSession("signed-in")).catch(err => {
      if (controller.signal.aborted) return;
      if (!(err instanceof ApiError) || ![401, 403].includes(err.status)) setError(err.message);
      setSession("signed-out");
    });
    return () => controller.abort();
  }, []);
  const expired = useCallback(() => { setSession("signed-out"); setError("Your organiser session ended. Please sign in again."); }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await command("/admin/login", { email: email.trim().toLowerCase(), password }); setPassword(""); setSession("signed-in"); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function logout() { await command("/admin/logout", {}); setSession("signed-out"); setPassword(""); setError(""); }
  if (session === "checking") return <div className="admin-login" role="status">Checking organiser access…</div>;
  if (session === "signed-in") return <Roster expired={expired} logout={logout} />;
  return <div className="admin-login roster-login"><form className="form-card" onSubmit={login}>
    <ShieldCheck size={30} /><span className="section-kicker">Organiser access</span><h1>Your team starts here.</h1><p>Sign in to review registration details and photos.</p>
    <label className="field">Organiser email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label className="field">Organiser password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? "Signing in…" : "Open registration dashboard"}</button>
  </form></div>;
}
