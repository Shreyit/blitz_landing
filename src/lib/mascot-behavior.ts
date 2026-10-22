export type MascotAction =
  | "idle"
  | "wave"
  | "run"
  | "point"
  | "think"
  | "peek"
  | "encourage"
  | "celebrate"
  | "highfive"
  | "dribble"
  | "speed"
  | "spin"
  | "flip";
export type MascotReaction = {
  action: MascotAction;
  message: string;
  accent?: string;
  sport?: string;
};
export const MASCOT_SPORTS = [
  "Football",
  "Cricket",
  "Badminton",
  "Table tennis",
  "Weightlifting",
  "Chess",
  "Tug of war",
  "Dodgeball",
] as const;
export type MascotSport = (typeof MASCOT_SPORTS)[number];
export function isMascotSport(sport: string): sport is MascotSport {
  return MASCOT_SPORTS.some((item) => item === sport);
}
export function pageSport(path: string): MascotSport {
  return (
    (
      {
        "/about": "Cricket",
        "/register": "Football",
        "/teams": "Dodgeball",
        "/admin": "Chess",
        "/verify": "Badminton",
        "/rules": "Chess",
      } as Record<string, MascotSport>
    )[path] || "Football"
  );
}
export function nextMascotSport(sport: MascotSport): MascotSport {
  return MASCOT_SPORTS[
    (MASCOT_SPORTS.indexOf(sport) + 1) % MASCOT_SPORTS.length
  ];
}
export const MASCOT_EVENT = "blitz:mascot";
export const MASCOT_TRICKS: readonly MascotReaction[] = [
  { action: "dribble", message: "Keep-ups. Easy feet, big energy." },
  { action: "speed", message: "Blink and you’ll miss me. Lightning lap!" },
  { action: "spin", message: "A little victory spin. Your turn!" },
  { action: "flip", message: "One superhero landing, coming right up." },
];
export function mascotTrick(index: number): MascotReaction {
  return MASCOT_TRICKS[((index % MASCOT_TRICKS.length) + MASCOT_TRICKS.length) % MASCOT_TRICKS.length];
}
export function pageReaction(path: string): MascotReaction | null {
  // The Dome needs every pixel (and the bid bar must stay clear), so Bolt sits out.
  if (path === "/auction" || path.startsWith("/auction/") || path === "/admin/auction") return null;
  if (path === "/register")
    return {
      action: "wave",
      message: "Player or volunteer? I’m here for both.",
    };
  if (path === "/teams")
    return {
      action: "wave",
      message: "Eight squads. Open one to meet your people.",
    };
  if (path === "/admin")
    return {
      action: "think",
      message: "You run the event. I’ll keep you company.",
    };
  if (path === "/verify")
    return {
      action: "point",
      message: "Your registration is complete. Welcome to BLITZ.",
    };
  if (path === "/about")
    return {
      action: "wave",
      message: "Player, volunteer, or cheering from the side. You belong here.",
    };
  if (path === "/rules")
    return { action: "point", message: "Know the rules. Find your sport, then follow the bracket." };
  return { action: "wave", message: "Hey, I’m Bolt. Give me a high-five!" };
}
export function registrationReaction({
  step,
  role,
  busy,
  success,
  error,
  sports,
}: {
  step: number;
  role: string;
  busy: boolean;
  success: boolean;
  error: string;
  sports: number;
}): MascotReaction {
  if (error)
    return {
      action: "encourage",
      message: "A little correction, then we’re back in the game.",
    };
  if (success)
    return {
      action: "celebrate",
      message: "You’re registered! Your inbox is the next stop.",
    };
  if (busy)
    return {
      action: "think",
      message: "Sending your registration. Nearly there…",
    };
  if (step === 2)
    return {
      action: "point",
      message: "Check your details, then make it official.",
    };
  if (step === 1)
    return {
      action: sports ? "dribble" : "point",
      message:
        role === "volunteer"
          ? "Choose one department and tell us how you can help."
          : "Choose your sports and a clear game-face photo.",
    };
  return {
    action: "wave",
    message:
      role === "volunteer"
        ? "The crew behind every great game. Welcome!"
        : "First, introduce yourself with your TISS email.",
  };
}
export function fieldReaction(
  type: string,
  name: string,
): MascotReaction | null {
  // Inspect field types, never values or private credentials.
  if (type === "password")
    return {
      action: "peek",
      message: "Your password is your business. Looking away!",
    };
  if (type === "email" || name === "email")
    return {
      action: "think",
      message: "Your TISS email keeps this a campus affair.",
    };
  if (type === "file")
    return {
      action: "point",
      message: "A clear photo. Keep your face near the centre.",
    };
  if (name === "name")
    return { action: "wave", message: "Nice to meet you, teammate." };
  if (name === "programme" || name === "year")
    return {
      action: "point",
      message: "Your programme and year help your new teammates find you.",
    };
  return null;
}
export function reactMascot(
  reaction: MascotReaction,
  duration = 3500,
  persistent = false,
) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(MASCOT_EVENT, {
        detail: { reaction, duration, persistent },
      }),
    );
}
