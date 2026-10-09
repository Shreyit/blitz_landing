"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PointerEvent } from "react";
import { SportArt } from "./icons";
import { sportName, sportSlug } from "@/lib/sport-rules";

const DETAILS: Record<string, [string, string]> = {
  Football: ["On the pitch", "Find your feet."],
  Cricket: ["At the crease", "Make it count."],
  Badminton: ["Above the net", "Own the air."],
  "Table tennis": ["Across the table", "Quick hands. Big game."],
  Weightlifting: ["On the platform", "Raise your limit."],
  Chess: ["Over the board", "Your next move."],
  "Tug of war": ["On the same side", "Pull together."],
  Dodgeball: ["In the action", "Catch the moment."],
};

export function SportCard({ sport, index }: { sport: string; index: number }) {
  const move = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty("--sport-tilt-x", `${-y * 9}deg`);
    card.style.setProperty("--sport-tilt-y", `${x * 12}deg`);
    card.style.setProperty("--sport-light-x", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--sport-light-y", `${(y + 0.5) * 100}%`);
  };
  return (
    <article className={`sport-card sport-${index}`} data-mascot-sport={sport} data-reveal>
    <Link
      href={`/register?sport=${encodeURIComponent(sport)}`}
      className="sport-card-link"
      data-mascot-sport={sport}
      onPointerMove={move}
      onPointerLeave={(event) => {
        event.currentTarget.style.removeProperty("--sport-tilt-x");
        event.currentTarget.style.removeProperty("--sport-tilt-y");
        event.currentTarget.style.removeProperty("--sport-light-x");
        event.currentTarget.style.removeProperty("--sport-light-y");
      }}
    >
      <div className="sport-art">
        <div className="sport-art-label"><span>{String(index + 1).padStart(2, "0")}</span><span>{DETAILS[sport]?.[0]}</span></div>
        <SportArt sport={sport} />
        <span className="sport-arrow"><ArrowUpRight size={19} /></span>
      </div>
      <div className="sport-caption"><h3>{sportName(sport)}</h3><span>{DETAILS[sport]?.[1]}</span></div>
    </Link>
    <Link className="sport-rules-link" href={`/rules#${sportSlug(sport)}`} aria-label={`${sportName(sport)} rules and format`}>Rules & format <ArrowUpRight size={12}/></Link>
    </article>
  );
}
