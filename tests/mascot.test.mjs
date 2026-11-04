import test from "node:test";
import assert from "node:assert/strict";
import {
  fieldReaction,
  pageReaction,
  registrationReaction,
  MASCOT_SPORTS,
  nextMascotSport,
  pageSport,
  isMascotSport,
  MASCOT_TRICKS,
  mascotTrick,
} from "../src/lib/mascot-behavior.ts";
import { SPORTS } from "../src/lib/event.ts";
import { INITIAL_TUG, TUG_LIMIT, pullRope } from "../src/lib/tug-of-war.ts";
import { SPORT_RULES, sportName, sportSlug } from "../src/lib/sport-rules.ts";
import { ENCOUNTERS, poolFixtures, poolTable } from "../src/lib/tournament.ts";

test("every registration sport has a complete rule entry and a unique rules anchor", () => {
  assert.deepEqual(SPORT_RULES.map((rule) => rule.sport), SPORTS);
  assert.equal(new Set(SPORT_RULES.map((rule) => sportSlug(rule.sport))).size, SPORTS.length);
  for (const rule of SPORT_RULES) {
    assert(rule.format);
    assert.equal(rule.facts.length, 3);
    assert(rule.sections.length > 0);
    assert(rule.sections.every((section) => section.title && section.points.length));
  }
  assert.equal(sportName("Weightlifting"), "Power lifting");
  assert.equal(sportSlug("Weightlifting"), "power-lifting");
  assert.deepEqual(SPORT_RULES.find((rule) => rule.sport === "Weightlifting").categories,
    ["Under 53 kg", "Under 59 kg", "Under 66 kg", "Under 74 kg", "Under 79 kg", "Open"]);
});

test("pool fixtures follow the rulebook and every team plays twice", () => {
  assert.deepEqual(poolFixtures("A"), [["A1", "A2"], ["A2", "A3"], ["A3", "A1"]]);
  assert.deepEqual(poolFixtures("B"), [["B1", "B2"], ["B2", "B3"], ["B3", "B1"]]);
  for (const team of ["A1", "A2", "A3"]) assert.equal(poolFixtures("A").flat().filter((t) => t === team).length, 2);
  assert.equal(ENCOUNTERS.pool + ENCOUNTERS.finals, ENCOUNTERS.total);
});

test("the pool table awards 3-1-0 and only names a winner once all matches are in", () => {
  const partial = poolTable("A", ["home", null, null]);
  assert.equal(partial.complete, false);
  assert.equal(partial.winner, null);
  assert.deepEqual(partial.rows.map((row) => [row.team, row.points]), [["A1", 3], ["A2", 0], ["A3", 0]]);
  // A1 beats A2, A2 draws A3, A1 beats A3 (A3 v A1 is won by the away side).
  const table = poolTable("A", ["home", "draw", "away"]);
  assert.equal(table.winner, "A1");
  assert.equal(table.decidedBy, "points");
  assert.deepEqual(table.rows.map((row) => [row.team, row.points]), [["A1", 6], ["A2", 1], ["A3", 1]]);
});

test("two teams level after drawing each other go to the sport statistic", () => {
  // A1 and A2 draw, and both beat A3: level on 4 with no head-to-head winner.
  const drawn = poolTable("A", ["draw", "home", "away"]);
  assert.equal(drawn.winner, null);
  assert.deepEqual([...drawn.tied].sort(), ["A1", "A2"]);
});

test("across every possible pool, head-to-head never decides first place", () => {
  // With three teams, a decisive meeting between two leaders forces a three-way tie instead.
  const outcomes = ["home", "away", "draw"];
  for (const one of outcomes) for (const two of outcomes) for (const three of outcomes) {
    const table = poolTable("A", [one, two, three]);
    assert.notEqual(table.decidedBy, "head-to-head");
    assert.equal(Boolean(table.winner), table.tied.length === 0);
  }
  // Without draws a pool has one 6-point winner or a three-way tie on 3.
  for (const one of ["home", "away"]) for (const two of ["home", "away"]) for (const three of ["home", "away"]) {
    const table = poolTable("A", [one, two, three]);
    assert(table.decidedBy === "points" || table.tied.length === 3);
  }
});

test("a three-way tie skips head-to-head and goes to the sport statistic", () => {
  const circular = poolTable("A", ["home", "home", "home"]); // each team wins once
  assert.equal(circular.winner, null);
  assert.equal(circular.decidedBy, null);
  assert.equal(circular.tied.length, 3);
  const allDrawn = poolTable("B", ["draw", "draw", "draw"]);
  assert.equal(allDrawn.tied.length, 3);
});

test("every pool sport has tie-breakers and a Final rule; power lifting has no pool", () => {
  for (const rule of SPORT_RULES) {
    if (rule.sport === "Weightlifting") { assert.equal(rule.pool, undefined); continue; }
    assert(rule.pool.rankBy.length >= 1 && rule.pool.final);
  }
  assert.deepEqual(SPORT_RULES.filter((rule) => rule.pool?.draws).map((rule) => rule.sport), ["Football", "Chess"]);
});

test("Show a trick cycles four distinct tricks and wraps for repeat play", () => {
  assert.deepEqual(MASCOT_TRICKS.map((trick) => trick.action), ["dribble", "speed", "spin", "flip"]);
  for (let i = 0; i < 12; i++) {
    assert.equal(mascotTrick(i), MASCOT_TRICKS[i % 4]);
    assert(mascotTrick(i).message);
  }
  assert.equal(mascotTrick(-1).action, "flip");
});

test("sports scenes match the exact eight-sport registration lineup", () => {
  assert.deepEqual(
    [...SPORTS],
    [
      "Football",
      "Cricket",
      "Badminton",
      "Table tennis",
      "Weightlifting",
      "Chess",
      "Tug of war",
      "Dodgeball",
    ],
  );
  assert.deepEqual(MASCOT_SPORTS, SPORTS);
  assert.equal(isMascotSport("Chess"), true);
  assert.equal(isMascotSport("Basketball"), false);
  assert.equal(isMascotSport("Volleyball"), false);
});

test("every sports scene is reachable and the cycle wraps", () => {
  let current = MASCOT_SPORTS[0];
  const visited = [];
  for (let i = 0; i < MASCOT_SPORTS.length; i++) {
    visited.push(current);
    current = nextMascotSport(current);
  }
  assert.deepEqual(visited, MASCOT_SPORTS);
  assert.equal(current, "Football");
  assert.equal(pageSport("/admin"), "Chess");
  assert.equal(pageSport("/teams"), "Dodgeball");
});

test("tug pulls are equal, opposing pulls cancel and initial state is immutable", () => {
  const left = pullRope(INITIAL_TUG, "left");
  const right = pullRope(INITIAL_TUG, "right");
  assert.equal(left.position, -right.position);
  assert.equal(pullRope(left, "right").position, 0);
  assert.equal(pullRope(left, "right").pulls, 2);
  assert.equal(INITIAL_TUG.position, 0);
  assert.equal(INITIAL_TUG.pulls, 0);
});

test("both tug teams can win; a finished round ignores further pulls", () => {
  for (const side of ["left", "right"]) {
    let state = INITIAL_TUG;
    for (let i = 0; i < TUG_LIMIT; i++) state = pullRope(state, side);
    assert.equal(state.winner, side);
    assert.equal(Math.abs(state.position), TUG_LIMIT);
    assert.equal(state.pulls, TUG_LIMIT);
    assert.equal(pullRope(state, side === "left" ? "right" : "left"), state);
  }
});

test("Bolt stays outside the Auction Dome and welcomes every other page", () => {
  assert.equal(pageReaction("/auction"), null);
  assert.equal(pageReaction("/admin/auction"), null);
  assert.equal(pageReaction("/auction/live"), null);
  for (const path of [
    "/",
    "/about",
    "/rules",
    "/register",
    "/teams",
    "/admin",
    "/verify",
    "/missing-page",
  ]) {
    assert(pageReaction(path)?.message);
  }
  assert(pageReaction("/admin/auction-history"));
});

test("registration errors take priority over waiting; successful submissions celebrate", () => {
  const state = {
    step: 2,
    role: "player",
    busy: true,
    success: false,
    error: "Failed",
    sports: 2,
  };
  assert.equal(registrationReaction(state).action, "encourage");
  assert.equal(registrationReaction({ ...state, error: "" }).action, "think");
  assert.equal(
    registrationReaction({ ...state, error: "", busy: false, success: true })
      .action,
    "celebrate",
  );
  assert.equal(
    registrationReaction({ ...state, error: "", busy: false }).action,
    "point",
  );
});

test("volunteers receive volunteer guidance instead of player instructions", () => {
  const state = {
    step: 1,
    role: "volunteer",
    busy: false,
    success: false,
    error: "",
    sports: 0,
  };
  assert.match(registrationReaction(state).message, /help/);
  assert.match(
    registrationReaction({ ...state, role: "player" }).message,
    /game-face/,
  );
  assert.equal(registrationReaction({ ...state, sports: 1 }).action, "dribble");
});

test("credential privacy takes priority over a field's name", () => {
  assert.equal(fieldReaction("password", "email").action, "peek");
  assert.equal(fieldReaction("password", "name").action, "peek");
  assert.equal(fieldReaction("email", "email").action, "think");
  assert.equal(fieldReaction("file", "photo").action, "point");
  assert.equal(fieldReaction("select-one", "year").action, "point");
  assert.equal(fieldReaction("hidden", "internal"), null);
});
