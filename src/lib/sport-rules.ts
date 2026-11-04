import type { SPORTS } from "./event";

export function sportName(sport: string) {
  return sport === "Weightlifting" ? "Power lifting" : sport;
}
export function sportSlug(sport: string) {
  return sportName(sport).toLowerCase().replaceAll(" ", "-");
}

export type EventPoints = {
  winner: number;
  runnerUp: number;
  categories: string[];
  note?: string;
};

/** How a sport runs the two pools. Power lifting has none: it is decided by weight category. */
export type PoolRules = {
  /** A pool match can end level and earn each side one ranking point. */
  draws: boolean;
  /** What separates teams after ranking points and head-to-head, in order. */
  rankBy: string[];
  /** How a level result is handled in a pool match, when draws are not allowed. */
  levelMatch?: string;
  final: string;
};

export type SportRules = {
  sport: (typeof SPORTS)[number];
  format: string;
  facts: [string, string][];
  sections: { title: string; points: string[] }[];
  categories?: string[];
  eventPoints: EventPoints;
  pool?: PoolRules;
};

const RANKING = "Win 3 ranking points, loss 0.";
const SUBSTITUTIONS = { title: "Substitutions", points: ["Allowed only before a rubber begins or for an injury, with committee approval. No free substitutions during a rubber."] };

export const SPORT_RULES: SportRules[] = [
  {
    sport: "Football", format: "5-a-side · two pools of three",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Team event"] },
    facts: [["On the field", "5 per team"], ["Match", "2 × 10 minutes"], ["Halftime", "3 minutes"]],
    pool: {
      draws: true,
      rankBy: ["Goal difference", "Goals scored", "Deciding procedure"],
      final: "Same match length. If level, a penalty shootout: three penalties each, then sudden death.",
    },
    sections: [
      { title: "Team & substitutions", points: ["Five players per team at a time. At least one female player must be on the field throughout the match.", "Rolling substitutions from registered substitutes. A female player coming off must be replaced by another female player.", "The referee controls timekeeping, stoppages and substitutions."] },
      { title: "Pool stage", points: ["Win 3 ranking points, draw 1 each, loss 0. Draws are allowed in pool matches.", "Level teams are separated by head-to-head (two-team tie), then goal difference, then goals scored, then a deciding procedure announced in advance.", "Goal difference = goals scored − goals conceded."] },
      { title: "Final", points: ["Pool A winner vs Pool B winner, with the same two 10-minute halves and 3-minute halftime.", "If the Final ends level, each team takes three penalties, followed by sudden-death penalties if needed."] },
    ],
  },
  {
    sport: "Cricket", format: "6-a-side · 6-over innings",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Team event"] },
    facts: [["Team", "6 players"], ["Innings", "6 overs · 5 wickets"], ["Venue", "OC Basketball Court"]],
    pool: {
      draws: false,
      rankBy: ["Net run rate", "Deciding contest"],
      levelMatch: "Tied matches go to a Super Over.",
      final: "Same six-over rules. A tie is settled by a Super Over.",
    },
    sections: [
      { title: "Team & match", points: ["Six registered players. At least one female player must be in the playing six and stay on the field, subject to an approved injury replacement.", "Two innings of up to six overs, with six legal deliveries per over. An innings also ends when five wickets have fallen."] },
      { title: "Bowling", points: ["Overarm bowling is mandatory. A bowler may bowl no more than two overs per innings, so at least three bowlers are needed.", "At least one complete over must be bowled by a female player.", "A no-ball awards one extra run and a free hit on the next legal delivery.", "Proposed: a wide awards one extra run and is rebowled. Wides and no-balls are not legal deliveries."] },
      { title: "Court scoring", points: ["Designated areas score 1 or 2 runs.", "A ball that bounces before hitting or crossing the front net scores 4.", "A ball that directly hits the front net, or goes beyond the front boundary without bouncing, scores 6.", "Use the relevant zone award for a stroke. Overlapping awards are not added together."] },
      { title: "Pool stage & Super Over", points: [`${RANKING} A tied match goes to a Super Over.`, "Super Over: each team bats one over, two wickets end the innings, and more runs wins. If tied again, further Super Overs are played.", "Level teams are separated by head-to-head (two-team tie), then net run rate, then a deciding contest."] },
      { title: "Net run rate", points: ["NRR = (total runs scored ÷ total overs faced) − (total runs conceded ÷ total overs bowled), summed across both pool matches.", "A team bowled out early counts the full six overs. A successful chase counts the legal deliveries actually faced.", "4.3 overs means 4 overs and 3 balls, which is 4.5 decimal overs. Super Overs are excluded."] },
      { title: "Final", points: ["Pool A winner vs Pool B winner under the same rules. A tie is settled by the announced Super Over procedure."] },
    ],
  },
  {
    sport: "Badminton", format: "Doubles only · three rubbers per encounter",
    eventPoints: { winner: 30, runnerUp: 20, categories: ["Men’s doubles", "Women’s doubles", "Mixed doubles"] },
    facts: [["Rubbers", "Men’s, women’s & mixed"], ["Each rubber", "Best of 3 games"], ["Game to", "15 pools · 21 Final"]],
    pool: {
      draws: false,
      rankBy: ["Rubber difference", "Game difference", "Point difference", "Deciding contest"],
      final: "Three rubbers, each best of three games to 21. Two rubbers wins the title.",
    },
    sections: [
      { title: "Encounter format", points: ["No singles. Each team encounter is men’s doubles, women’s doubles and mixed doubles.", "The team winning at least two rubbers wins the encounter. All three rubbers are completed in pool encounters, so every team has comparable statistics.", "A team needs at least two registered men and two registered women."] },
      { title: "Scoring", points: ["Pool stage: best of three games to 15 points, winning by at least 2.", "Final: best of three games to 21 points, winning by at least 2.", "The 15-point pool game is a custom rule for this event."] },
      { title: "Pool stage", points: [`${RANKING}`, "Level teams are separated by head-to-head (two-team tie), then rubber difference, game difference, point difference, then a deciding contest.", "Every game score is recorded, including those in lost rubbers."] },
      SUBSTITUTIONS,
    ],
  },
  {
    sport: "Table tennis", format: "Doubles only · three rubbers per encounter",
    eventPoints: { winner: 30, runnerUp: 20, categories: ["Men’s doubles", "Women’s doubles", "Mixed doubles"] },
    facts: [["Rubbers", "Men’s, women’s & mixed"], ["Each rubber", "Best of 3 games"], ["Game to", "15 pools · 21 Final"]],
    pool: {
      draws: false,
      rankBy: ["Rubber difference", "Game difference", "Point difference", "Deciding contest"],
      final: "Three rubbers, each best of three games to 21. Two rubbers wins the title.",
    },
    sections: [
      { title: "Encounter format", points: ["No singles. Each team encounter is men’s doubles, women’s doubles and mixed doubles.", "The side winning two or three rubbers wins the encounter. All three rubbers are completed in pool encounters.", "A team needs at least two men and two women."] },
      { title: "Scoring", points: ["Pool stage: best of three games to 15 points, winning by 2.", "Final: best of three games to 21 points, winning by 2.", "These are custom event rules and differ from standard 11-point games. Standard doubles serving order, alternating returns and fault rules apply unless changed locally."] },
      { title: "Pool stage", points: [`${RANKING}`, "Level teams are separated by head-to-head (two-team tie), then rubber difference, game difference, point difference, then a deciding contest."] },
      { title: "Substitutions", points: ["Only before a rubber starts with committee approval, or for an approved injury."] },
    ],
  },
  {
    sport: "Weightlifting", format: "Deadlift · six weight categories",
    eventPoints: {
      winner: 15, runnerUp: 10,
      categories: ["Under 53 kg", "Under 59 kg", "Under 66 kg", "Under 74 kg", "Under 79 kg", "Open"],
      note: "Points are awarded separately in the men’s and women’s events for each weight category.",
    },
    facts: [["Lift", "Deadlift only"], ["Attempts", "3 per lifter"], ["Champions", "Up to 12 categories"]],
    sections: [
      { title: "Format", points: ["A separate individual strength competition, not a pool event. There is no Pool A vs Pool B Final.", "Separate men’s and women’s divisions. Weight categories are set by the official event-day weigh-in.", "Each team may register at most one male and one female lifter in each category."] },
      { title: "Attempts", points: ["Every lifter gets three attempts. Declare and lock the weight before each lift.", "Attempts 2 and 3 may be the same or heavier, never lower, even after a failed lift.", "A lifter with no successful attempt has no valid result."] },
      { title: "A valid deadlift", points: ["The bar starts on the floor and is lifted under control until fully upright, with knees and hips locked out.", "Wait for the referee’s down command, then lower the bar under control. The referee decides validity."] },
      { title: "Winner & tie-breaks", points: ["The highest successful deadlift wins each category.", "If tied, the lighter lifter at the official weigh-in ranks higher. If body weights are equal, the lifter who reached the weight first ranks higher."] },
    ],
    categories: ["Under 53 kg", "Under 59 kg", "Under 66 kg", "Under 74 kg", "Under 79 kg", "Open"],
  },
  {
    sport: "Chess", format: "One player per team · two pools of three",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Individual event"], note: "Players earn these points for their team." },
    facts: [["Per team", "1 player"], ["Time control", "10 minutes per player"], ["Final", "3-game series"]],
    pool: {
      draws: true,
      rankBy: ["Chess tie-break playoff"],
      final: "A three-game series at 10 minutes per player. If tied, two 3+2 games, then Armageddon.",
    },
    sections: [
      { title: "Pool stage", points: ["Each player plays the other two players in their pool, with 10 minutes per player and no increment.", "Win 3 ranking points, draw 1, loss 0.", "Level players are separated by head-to-head (two-player tie), then a chess playoff."] },
      { title: "Tie-break playoffs", points: ["Two players: two blitz games at 3 minutes plus a 2-second increment, alternating colours. If still tied, an Armageddon game; under the proposed rule, Black advances on a draw.", "Three players: a blitz round robin. The highest scorer qualifies. If the top rank stays tied, a pre-announced playoff continues until one player qualifies."] },
      { title: "Final", points: ["Pool A winner vs Pool B winner over three games at 10 minutes per player. Win 1 game point, draw 0.5, loss 0.", "The highest combined score is Champion. If tied, two games at 3 minutes plus a 2-second increment, then an Armageddon game if needed."] },
    ],
  },
  {
    sport: "Tug of war", format: "Men’s & women’s events · best of three pulls",
    eventPoints: { winner: 45, runnerUp: 30, categories: ["Men’s", "Women’s"] },
    facts: [["Men’s team", "8 men"], ["Women’s team", "5 women"], ["Each pull", "30 seconds max"]],
    pool: {
      draws: false,
      rankBy: ["Pull difference", "Pulls won", "Deciding encounter"],
      levelMatch: "A pull with no winner in 30 seconds is repeated.",
      final: "Best of three valid pulls, with a separate men’s Final and women’s Final.",
    },
    sections: [
      { title: "Encounter format", points: ["Men and women compete in separate pools, with separate Finals.", "Each encounter is best of three valid pulls. The first team to win two pulls wins.", "If neither team wins within 30 seconds, the pull is a draw and is repeated, with adequate rest. Repeated pulls do not count as wins or losses."] },
      { title: "Pulling rules", points: ["The rope must not be tied, knotted or locked around a participant’s body. Pull with the prescribed underarm technique.", "Elbows may not drop below knees. Dangerous falls, illegal grips and unsafe conduct can be a foul.", "A referee validates every successful pull and may order a replay, warn participants or award a pull."] },
      { title: "Pool stage", points: [`Encounter win 3 ranking points, loss 0.`, "Level teams are separated by head-to-head (two-team tie), then pull difference, total pulls won, then a deciding encounter.", "Pull difference = pulls won − pulls lost."] },
    ],
  },
  {
    sport: "Dodgeball", format: "8-player squads · 4 on court",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Team event"] },
    facts: [["Squad", "8 players · 3 female"], ["On court", "4 per team · 1 ball"], ["Play period", "7 minutes"]],
    pool: {
      draws: false,
      rankBy: ["Elimination difference", "Total eliminations", "Deciding match"],
      levelMatch: "Proposed: level at full time goes to sudden death.",
      final: "Same seven-minute period and proposed sudden-death rule.",
    },
    sections: [
      { title: "Team & match", points: ["Each team registers eight players, including at least three female players. Four play at a time, with one ball.", "A team wins at once by legally eliminating all four active opponents.", "Proposed: at full time, the team with more surviving players wins. If level, sudden death: the first valid elimination decides it."] },
      { title: "Proposed elimination & safety rules", points: ["A player hit by a legally thrown ball before it touches the ground is out. A clean catch eliminates the thrower.", "Deliberate headshots and physical contact with an opponent are prohibited. Stepping outside the court may mean elimination.", "Eliminated players cannot re-enter the same match, except to correct a referee error."] },
      { title: "Pool stage", points: [`${RANKING}`, "Level teams are separated by head-to-head (two-team tie), then elimination difference across both pool matches, total opponents eliminated, then a deciding match.", "Elimination difference = opponents eliminated − own players eliminated."] },
    ],
  },
];
