"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Dices, RotateCcw, Trophy } from "lucide-react";
import { SPORT_RULES, sportName } from "@/lib/sport-rules";
import { ENCOUNTERS, POOLS, poolFixtures, poolTable, type PoolName, type PoolTable, type Result } from "@/lib/tournament";
import { reactMascot } from "@/lib/mascot-behavior";

const POOL_SPORTS = SPORT_RULES.filter((rule) => rule.pool);
const POOL_NAMES = Object.keys(POOLS) as PoolName[];
const EMPTY: Record<PoolName, Result[]> = { A: [null, null, null], B: [null, null, null] };
const STEPS = ["6 teams", "2 pools of 3", "Round robin", "Top of each pool", "Final", "Champion"];
const LIFTING_STEPS = ["Registration", "Weigh-in", "Weight category", "Three deadlift attempts", "Highest valid lift", "Category champion"];

function poolStatus(table: PoolTable, decider: string) {
  if (!table.complete) return "Pick a result for all three matches.";
  if (table.decidedBy === "points") return `${table.winner} tops the pool on ranking points.`;
  if (table.decidedBy === "head-to-head") return `${table.winner} goes through on head-to-head.`;
  return `${table.tied.join(", ")} are level. ${decider} decides who goes through.`;
}

function Pool({ pool, results, draws, decider, tieWinner, onResult, onTieWinner }: {
  pool: PoolName;
  results: Result[];
  draws: boolean;
  decider: string;
  tieWinner: string | null;
  onResult: (index: number, result: Result) => void;
  onTieWinner: (team: string) => void;
}) {
  const table = poolTable(pool, results);
  return (
    <div className="format-pool" data-pool={pool}>
      <h3>Pool {pool}</h3>
      <div className="format-fixtures">
        {poolFixtures(pool).map(([home, away], index) => {
          const options: [Exclude<Result, null>, string, string][] = [
            ["home", home, `${home} wins`],
            ...(draws ? [["draw", "Draw", `${home} and ${away} draw`] as [Exclude<Result, null>, string, string]] : []),
            ["away", away, `${away} wins`],
          ];
          return (
            <div className="format-fixture" key={`${home}-${away}`} role="group" aria-label={`${home} vs ${away}`}>
              <span>Match {index + 1}</span>
              <div>
                {options.map(([value, label, name]) => (
                  <button key={value} type="button" aria-label={name} aria-pressed={results[index] === value}
                    onClick={() => onResult(index, results[index] === value ? null : value)}>{label}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <table className="format-table">
        <caption className="visually-hidden">Pool {pool} standings</caption>
        <thead><tr><th scope="col">Team</th><th scope="col"><abbr title="Played">P</abbr></th><th scope="col"><abbr title="Won">W</abbr></th>{draws && <th scope="col"><abbr title="Drawn">D</abbr></th>}<th scope="col"><abbr title="Lost">L</abbr></th><th scope="col"><abbr title="Ranking points">Pts</abbr></th></tr></thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.team} data-winner={row.team === table.winner} data-tied={table.tied.includes(row.team)}>
              <th scope="row">{row.team}</th><td>{row.played}</td><td>{row.won}</td>{draws && <td>{row.drawn}</td>}<td>{row.lost}</td><td><strong>{row.points}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="format-status" aria-live="polite">{poolStatus(table, decider)}</p>
      {table.tied.length > 0 && (
        <div className="format-tie" role="group" aria-label={`Who wins on ${decider} in Pool ${pool}?`}>
          <span>Who wins on {decider.toLowerCase()}?</span>
          <div>{table.tied.map((team) => <button key={team} type="button" aria-pressed={tieWinner === team} onClick={() => onTieWinner(team)}>{team}</button>)}</div>
        </div>
      )}
    </div>
  );
}

export function TournamentFormat() {
  const [sport, setSport] = useState<string>(POOL_SPORTS[0].sport);
  const [results, setResults] = useState(EMPTY);
  const [tieWinners, setTieWinners] = useState<Record<PoolName, string | null>>({ A: null, B: null });
  const [champion, setChampion] = useState<string | null>(null);
  const rule = POOL_SPORTS.find((item) => item.sport === sport)!;
  const pool = rule.pool!;
  const tables = useMemo(() => ({ A: poolTable("A", results.A), B: poolTable("B", results.B) }), [results]);
  const finalists = POOL_NAMES.map((name) => tables[name].winner ?? tieWinners[name]);
  const finalReady = finalists.every(Boolean);

  const update = (next: typeof results) => {
    setResults(next);
    setTieWinners({ A: null, B: null });
    setChampion(null);
    const a = poolTable("A", next.A).winner;
    const b = poolTable("B", next.B).winner;
    if (a && b) reactMascot({ action: "celebrate", message: `${a} vs ${b}. That’s your Final!` }, 2400);
  };
  const chooseSport = (next: (typeof POOL_SPORTS)[number]) => {
    setSport(next.sport);
    // A draw can't stand in a sport that doesn't allow one.
    if (!next.pool!.draws) {
      const strip = (list: Result[]) => list.map((result) => (result === "draw" ? null : result));
      setResults({ A: strip(results.A), B: strip(results.B) });
    }
    setTieWinners({ A: null, B: null });
    setChampion(null);
    reactMascot({ action: "point", message: `${sportName(next.sport)}: same pools, its own tie-breakers.`, sport: next.sport }, 2200);
  };
  const randomise = () => {
    const outcomes: Result[] = pool.draws ? ["home", "away", "draw"] : ["home", "away"];
    const draw = () => [0, 1, 2].map(() => outcomes[Math.floor(Math.random() * outcomes.length)]);
    update({ A: draw(), B: draw() });
  };

  return (
    <section id="tournament-format" className="format-section" data-bolt-greeting="Two pools, one Final. Top your pool and you’re in.">
      <div className="section-heading"><div><span className="section-kicker">The six-team format</span><h2>Two pools.<br/>One Final.</h2></div><p>Every team plays both teams in its pool.<br/>The top team of each pool goes straight to the Final.</p></div>

      <ol className="format-flow" aria-label="Tournament route">
        {STEPS.map((step, index) => <li key={step} style={{ "--step": index } as React.CSSProperties}><span>{step}</span>{index < STEPS.length - 1 && <ArrowRight size={15} aria-hidden="true"/>}</li>)}
      </ol>

      <div className="format-play">
        <div className="format-play-head">
          <div><h3>Try it yourself</h3><p>Pick a sport, then choose who wins each match. A1–A3 and B1–B3 stand in for the teams until the pools are drawn.</p></div>
          <div className="format-actions">
            <button type="button" className="format-action" onClick={randomise}><Dices size={16}/> Random results</button>
            <button type="button" className="format-action" onClick={() => update(EMPTY)}><RotateCcw size={16}/> Clear</button>
          </div>
        </div>

        <div className="format-sports" role="group" aria-label="Choose a sport">
          {POOL_SPORTS.map((item) => <button key={item.sport} type="button" aria-pressed={item.sport === sport} onClick={() => chooseSport(item)}>{sportName(item.sport)}</button>)}
        </div>

        <div className="format-rank">
          <span>Ranking order</span>
          <ol>
            {["Ranking points", "Head-to-head", ...pool.rankBy].map((item) => <li key={item}>{item}</li>)}
          </ol>
          <p>Win 3{pool.draws ? ", draw 1" : ""}, loss 0. {pool.levelMatch} Head-to-head applies only when exactly two teams are level.</p>
        </div>

        <div className="format-pools">
          {POOL_NAMES.map((name) => (
            <Pool key={name} pool={name} results={results[name]} draws={pool.draws} decider={pool.rankBy[0]} tieWinner={tieWinners[name]}
              onTieWinner={(team) => { setTieWinners({ ...tieWinners, [name]: team }); setChampion(null); }}
              onResult={(index, result) => update({ ...results, [name]: results[name].map((item, i) => (i === index ? result : item)) })} />
          ))}
        </div>

        <ArrowDown className="format-down" size={22} aria-hidden="true"/>

        <div className="format-final" data-ready={finalReady}>
          <span className="format-final-label">The Final{sport === "Tug of war" ? "s" : ""}</span>
          <div className="format-final-teams" role="group" aria-label="Choose the Final winner">
            {finalists.map((team, index) => (
              <button key={index} type="button" disabled={!team} aria-pressed={!!team && champion === team}
                onClick={() => {
                  setChampion(team);
                  if (team) reactMascot({ action: "celebrate", message: `${team} takes the title!` }, 2400);
                }}>
                {team ?? `Pool ${POOL_NAMES[index]} winner`}
              </button>
            ))}
          </div>
          <p>{pool.final}</p>
          <div className="format-champion" aria-live="polite"><Trophy size={24} aria-hidden="true"/><span>{champion ? `${champion} are ${sportName(sport)} champions` : finalReady ? "Pick the Final winner" : "Champion to be decided"}</span></div>
        </div>
      </div>

      <div className="format-notes"><span>No quarterfinals or semifinals</span><span>No byes</span><span>No third-place match</span><span>Men’s and women’s tug of war have separate pools and Finals</span></div>

      <div className="format-extras">
        <div className="format-count">
          <span>Across {ENCOUNTERS.events} pool events</span>
          <strong>{ENCOUNTERS.total} encounters</strong>
          <p>{ENCOUNTERS.pool} pool fixtures and {ENCOUNTERS.finals} Finals, before any tie-break contests.</p>
        </div>
        <div className="format-lifting">
          <span>Power lifting runs separately</span>
          <ol>{LIFTING_STEPS.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      </div>

      <p className="format-draft">These rules are a draft awaiting organising committee approval. Items marked “Proposed” may change.</p>
    </section>
  );
}
