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
import { SPORT_RULES, sportName, sportSlug, QUARTERFINALS, SEMIFINALS } from "../src/lib/sport-rules.ts";

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

test("all eight pool positions play once in the specified quarterfinals and feed the correct semifinals", () => {
  assert.deepEqual(QUARTERFINALS.map((match) => [...match.teams]), [
    ["A1", "B4"], ["A2", "B3"], ["B1", "A4"], ["B2", "A3"],
  ]);
  assert.equal(new Set(QUARTERFINALS.flatMap((match) => [...match.teams])).size, 8);
  assert.deepEqual(SEMIFINALS.map((match) => [...match.teams]), [
    ["Winner of QF1", "Winner of QF2"], ["Winner of QF3", "Winner of QF4"],
  ]);
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
