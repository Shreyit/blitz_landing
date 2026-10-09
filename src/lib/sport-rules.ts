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

export type SportRules = {
  sport: (typeof SPORTS)[number];
  format: string;
  facts: [string, string][];
  sections: { title: string; points: string[] }[];
  categories?: string[];
  eventPoints: EventPoints;
};

export const SPORT_RULES: SportRules[] = [
  {
    sport: "Football", format: "5-a-side · two groups of four",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Team event"] },
    facts: [["Teams", "8 × 5 players"], ["Match", "2 × 10 minutes"], ["Halftime", "3 minutes"]],
    sections: [
      { title: "Team & match format", points: ["Eight teams, with five players per team. A female player must be on the field at all times.", "Matches last 20 minutes: two 10-minute halves with a 3-minute halftime.", "Rolling substitutions are allowed."] },
      { title: "League stage", points: ["Teams are split into two groups of four for the league stage."] },
    ],
  },
  {
    sport: "Cricket", format: "6-a-side · 6-over innings",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Team event"] },
    facts: [["Teams", "8 × 6 players"], ["Innings", "6 overs"], ["Venue", "OC Basketball Court"]],
    sections: [
      { title: "Teams & ground", points: ["Eight teams, with six players per team. A female player must be on the field at all times.", "Six-over innings on the OC Basketball Court, with nets in play."] },
      { title: "Scoring", points: ["Designated areas score 1–2 runs.", "A bounce hitting or crossing the front net scores 4 runs.", "A direct hit to the front net or beyond scores 6 runs."] },
      { title: "Bowling & ties", points: ["Each bowler may bowl up to two overs. At least one over must be bowled by a female player.", "Overarm bowling is mandatory. A no-ball awards one extra run and a free hit.", "Tied matches are decided by a Super Over."] },
    ],
  },
  {
    sport: "Badminton", format: "Doubles · best of three",
    eventPoints: { winner: 30, runnerUp: 20, categories: ["Men’s doubles", "Women’s doubles", "Mixed doubles"] },
    facts: [["Events", "Men’s, women’s & mixed"], ["Format", "Best of 3"], ["Points", "15 · final round 21"]],
    sections: [
      { title: "Events & scoring", points: ["Men’s doubles, women’s doubles, and mixed doubles.", "Best of three format. Rounds are played to 15 points; the final round is played to 21 points."] },
      { title: "Substitutions", points: ["Substitutions are allowed only before matches, or for injuries approved by the committee."] },
    ],
  },
  {
    sport: "Table tennis", format: "Doubles · best of three sets",
    eventPoints: { winner: 30, runnerUp: 20, categories: ["Men’s doubles", "Women’s doubles", "Mixed doubles"] },
    facts: [["Events", "Men’s, women’s & mixed"], ["Format", "Best of 3 sets"], ["Points", "15 · final round 21"]],
    sections: [
      { title: "Events & scoring", points: ["Men’s doubles, women’s doubles, and mixed doubles.", "Best of three sets. Rounds are played to 15 points; the final round is played to 21 points."] },
      { title: "Substitutions", points: ["Substitutions are allowed only before matches, or for injuries approved by the committee."] },
    ],
  },
  {
    sport: "Weightlifting", format: "Deadlift · six weight categories",
    eventPoints: {
      winner: 15, runnerUp: 10,
      categories: ["Under 53 kg", "Under 59 kg", "Under 66 kg", "Under 74 kg", "Under 79 kg", "Open"],
      note: "Points are awarded separately in the men’s and women’s events for each weight category.",
    },
    facts: [["Lift", "Deadlift"], ["Attempts", "3 rounds per category"], ["Categories", "6 · event-day weigh-in"]],
    sections: [
      { title: "Entry & categories", points: ["Deadlift for male and female participants. Weight categories are determined by weigh-ins on event day.", "Each team may enter one male player and one female player in each category."] },
      { title: "Attempts & winner", points: ["Declare and lock the weight before each lift. Once locked, the weight cannot be lowered in a later round, even after an unsuccessful lift.", "Each category has three rounds. The participant with the highest weight lifted wins that category."] },
    ],
    categories: ["Under 53 kg", "Under 59 kg", "Under 66 kg", "Under 74 kg", "Under 79 kg", "Open"],
  },
  {
    sport: "Chess", format: "Swiss rounds · top four advance",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Individual event"], note: "Players earn these points for their team." },
    facts: [["Swiss stage", "4 rounds"], ["Time control", "10 minutes per player"], ["Qualifiers", "Top 4 players"]],
    sections: [
      { title: "Swiss stage", points: ["Four rounds with 10 minutes per player. Buchholz and Cumulative systems are used for tiebreakers.", "The top four players advance to the semifinals."] },
      { title: "Semifinals", points: ["Two matches per player, with the same 10-minute time control.", "Ties are decided by a knockout match with 3 minutes plus a 2-second increment."] },
      { title: "Final", points: ["Three matches with a 10-minute time control.", "If tied, a knockout match with 3 minutes plus a 2-second increment determines the champion."] },
    ],
  },
  {
    sport: "Tug of war", format: "Male & female groups · best of three",
    eventPoints: { winner: 45, runnerUp: 30, categories: ["Men’s", "Women’s"] },
    facts: [["Male group", "8 members per team"], ["Female group", "5 members per team"], ["Round", "30 seconds"]],
    sections: [
      { title: "Teams & rounds", points: ["Each team has a male group of eight members and a female group of five members.", "Three rounds are played, with the best of three counting. Each round lasts 30 seconds.", "If neither team wins within 30 seconds, the round is a draw and is repeated."] },
      { title: "Pulling rules", points: ["Do not tie the rope around your body. The rope must be pulled underarm.", "Players’ elbows must not go below their knees; doing so is a foul.", "A referee validates every successful pull."] },
    ],
  },
  {
    sport: "Dodgeball", format: "8-player squads · 4 on court",
    eventPoints: { winner: 90, runnerUp: 60, categories: ["Team event"] },
    facts: [["Squad", "8 players · 3 female"], ["On court", "4 per team · 1 ball"], ["Attack period", "7 minutes"]],
    sections: [
      { title: "Teams & play", points: ["Each team has eight players, including a mandatory three female players in the squad.", "Four players from each team compete at a time, using a single ball.", "The objective is to eliminate opposing players within a 7-minute attack period."] },
    ],
  },
];

export const QUARTERFINALS = [
  { id: "QF1", teams: ["A1", "B4"] },
  { id: "QF2", teams: ["A2", "B3"] },
  { id: "QF3", teams: ["B1", "A4"] },
  { id: "QF4", teams: ["B2", "A3"] },
] as const;

export const SEMIFINALS = [
  { id: "SF1", teams: ["Winner of QF1", "Winner of QF2"] },
  { id: "SF2", teams: ["Winner of QF3", "Winner of QF4"] },
] as const;
