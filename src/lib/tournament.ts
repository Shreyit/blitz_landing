/**
 * Six-team, two-pool format: each pool plays a three-match round robin and the
 * top team of each pool meets the other in the Final. See docs/TOURNAMENT_RULES.md.
 */
export const POOLS = {
  A: ["A1", "A2", "A3"],
  B: ["B1", "B2", "B3"],
} as const;
export type PoolName = keyof typeof POOLS;

/** Fixture order from the rulebook: 1 v 2, 2 v 3, 3 v 1. */
export function poolFixtures(pool: PoolName): [string, string][] {
  const [one, two, three] = POOLS[pool];
  return [[one, two], [two, three], [three, one]];
}

export const RANKING_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/** "home" is the first-named team of a fixture, "away" the second. */
export type Result = "home" | "away" | "draw" | null;

export type StandingRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
};

export type PoolTable = {
  rows: StandingRow[];
  /** Every fixture in the pool has a result. */
  complete: boolean;
  /** The team that tops the pool, when points (and head-to-head) settle it. */
  winner: string | null;
  /** How the top spot was settled. */
  decidedBy: "points" | "head-to-head" | null;
  /** Teams level at the top that need the sport's own tie-breaker. */
  tied: string[];
};

function headToHead(fixtures: [string, string][], results: Result[], a: string, b: string): string | null {
  const index = fixtures.findIndex(([home, away]) => (home === a && away === b) || (home === b && away === a));
  const result = results[index];
  if (result === "home") return fixtures[index][0];
  if (result === "away") return fixtures[index][1];
  return null;
}

export function poolTable(pool: PoolName, results: Result[]): PoolTable {
  const fixtures = poolFixtures(pool);
  const rows = new Map<string, StandingRow>(
    POOLS[pool].map((team) => [team, { team, played: 0, won: 0, drawn: 0, lost: 0, points: 0 }]),
  );
  fixtures.forEach(([home, away], index) => {
    const result = results[index];
    if (!result) return;
    const h = rows.get(home)!;
    const a = rows.get(away)!;
    h.played++;
    a.played++;
    if (result === "draw") {
      h.drawn++; a.drawn++;
      h.points += RANKING_POINTS.draw; a.points += RANKING_POINTS.draw;
    } else {
      const [winner, loser] = result === "home" ? [h, a] : [a, h];
      winner.won++; loser.lost++;
      winner.points += RANKING_POINTS.win;
    }
  });

  const ordered = [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    // Two teams level on points: their head-to-head result orders them.
    const level = [...rows.values()].filter((row) => row.points === x.points);
    if (level.length === 2) {
      const h2h = headToHead(fixtures, results, x.team, y.team);
      if (h2h === x.team) return -1;
      if (h2h === y.team) return 1;
    }
    return 0;
  });

  const complete = fixtures.every((_, index) => results[index]);
  const top = ordered.filter((row) => row.points === ordered[0].points);
  let winner: string | null = null;
  let decidedBy: PoolTable["decidedBy"] = null;
  let tied: string[] = [];
  if (complete) {
    if (top.length === 1) {
      winner = top[0].team;
      decidedBy = "points";
    } else if (top.length === 2) {
      // Exactly two teams level: head-to-head first, then the sport's statistic.
      winner = headToHead(fixtures, results, top[0].team, top[1].team);
      decidedBy = winner ? "head-to-head" : null;
      if (!winner) tied = top.map((row) => row.team);
    } else {
      // All three level: skip the circular head-to-head and use the sport's statistic.
      tied = top.map((row) => row.team);
    }
  }
  return { rows: ordered, complete, winner, decidedBy, tied };
}

/** Encounters in the eight pool-based events: six pool fixtures and one Final each. */
export const ENCOUNTERS = { events: 8, pool: 48, finals: 8, total: 56 } as const;
