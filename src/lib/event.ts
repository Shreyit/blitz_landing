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
  { id: 1, name: "The Monarchs", color: "#3f6e5a", symbol: "MO" },
  { id: 3, name: "Shell Mates", color: "#6b4a2e", symbol: "SM" },
  { id: 5, name: "X Force United", color: "#c4242b", symbol: "XF" },
  { id: 4, name: "SlytherWins", color: "#1f7a3a", symbol: "SW" },
  { id: 6, name: "Vikings", color: "#8f1d2a", symbol: "VK" },
  { id: 7, name: "Shadow Strikers", color: "#2b2b30", symbol: "SS" },
];
/** Display order by team id, used everywhere teams are listed. Ids stay fixed in the database. */
const TEAM_ORDER = TEAMS.map((team) => team.id);
export function orderTeams<T extends { id: number }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => TEAM_ORDER.indexOf(a.id) - TEAM_ORDER.indexOf(b.id));
}
/**
 * Confirmed team identities, keyed by team id. Teams without an entry keep the shield.
 * Logos are square images used as given, filling the card's square emblem.
 * `logoBg` shows behind the logo while it loads. `nameSoon` hides a placeholder team name
 * on the Teams page until the real one is confirmed.
 */
export const TEAM_BRANDING: Record<
  number,
  { logo?: string; logoBg?: string; owner?: string; nameSoon?: boolean }
> = {
  1: { logo: "/teams/the-monarchs.webp", logoBg: "#e6dfcf", owner: "Monalisa Murmu" },
  3: { logo: "/teams/shell-mates.webp", logoBg: "#2e1910", owner: "Eesha Mishra" },
  4: { logo: "/teams/slytherwins.webp", logoBg: "#768262", owner: "Merry Geordy" },
  5: { logo: "/teams/x-force-united.webp", logoBg: "#000000", owner: "Wali Abidi" },
  6: { logo: "/teams/vikings.webp", logoBg: "#52030a", owner: "Rhea Tripathi" },
  7: { logo: "/teams/shadow-strikers.webp", logoBg: "#0a0a0a", owner: "Aditya Gupta" },
};
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
