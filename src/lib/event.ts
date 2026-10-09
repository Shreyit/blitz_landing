export const SPORTS = [
  "Football",
  "Cricket",
  "Badminton",
  "Table tennis",
  "Weightlifting",
  "Chess",
  "Tug of war",
  "Dodgeball",
] as const;
export const TEAMS = [
  { id: 1, name: "Court Kings", color: "#4c7051", symbol: "CK" },
  { id: 2, name: "The Strikers", color: "#bd6039", symbol: "ST" },
  { id: 3, name: "Blue Wolves", color: "#466da3", symbol: "BW" },
  { id: 4, name: "Wild Aces", color: "#9671a5", symbol: "WA" },
  { id: 5, name: "Red Hawks", color: "#b04f51", symbol: "RH" },
  { id: 6, name: "Trailblazers", color: "#9b7929", symbol: "TB" },
  { id: 7, name: "The Mavericks", color: "#3c8a88", symbol: "MV" },
  { id: 8, name: "Thunder Club", color: "#6e638c", symbol: "TC" },
];
export const ROUND_NAMES = [
  "Normal round",
  "Rapid fire · ₹10",
  "Rapid fire · ₹2",
  "Rapid fire · ₹1",
];
export type Player = {
  id: string;
  name: string;
  programme: string;
  year: number;
  sports: string[];
  photo: string | null;
  role?: string;
  email?: string;
  verified?: boolean;
};
export type Team = (typeof TEAMS)[number] & {
  purse: number;
  players: (Player & { price: number; source: string })[];
};
export type AuctionState = {
  phase: string;
  round: number;
  version: number;
  current: Player | null;
  bid: number;
  leader: number | null;
  next_bid: number;
  remaining: number;
  sold: number;
  total: number;
  teams: Team[];
  history: { name: string; team: string; price: number; source: string }[];
};
export const PREVIEW: AuctionState = {
  phase: "preview",
  round: 0,
  version: 0,
  current: {
    id: "preview",
    name: "Your next teammate",
    programme: "BSASS",
    year: 2,
    sports: ["Football", "Cricket"],
    photo: null,
  },
  bid: 0,
  leader: null,
  next_bid: 20,
  remaining: 0,
  sold: 0,
  total: 0,
  teams: TEAMS.map((t) => ({ ...t, purse: 2000, players: [] })),
  history: [],
};
