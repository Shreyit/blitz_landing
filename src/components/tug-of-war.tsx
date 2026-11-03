"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { BoltPortrait } from "./mascot";
import { TEAMS } from "@/lib/event";
import {
  INITIAL_TUG,
  pullRope,
  TUG_LIMIT,
  type TugSide,
} from "@/lib/tug-of-war";
import { reactMascot } from "@/lib/mascot-behavior";

export function TugOfWar() {
  const [state, setState] = useState(INITIAL_TUG);
  const [leftId, setLeftId] = useState(2);
  const [rightId, setRightId] = useState(5);
  const [pulling, setPulling] = useState<TugSide | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const left = TEAMS.find((team) => team.id === leftId)!;
  const right = TEAMS.find((team) => team.id === rightId)!;
  const winner =
    state.winner === "left" ? left : state.winner === "right" ? right : null;
  const reset = () => {
    clearTimeout(timer.current);
    setState(INITIAL_TUG);
    setPulling(null);
  };
  const pull = (side: TugSide) => {
    if (state.winner) return;
    const next = pullRope(state, side);
    setState(next);
    setPulling(side);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPulling(null), 400);
    reactMascot(
      {
        action: next.winner ? "celebrate" : "encourage",
        message: next.winner
          ? "Teamwork takes the win. Rematch?"
          : "Dig those heels in. Pull together!",
        sport: "Tug of war",
      },
      1800,
    );
  };
  return (
    <section
      className="tug-section page-width"
      id="tug-of-war"
      data-mascot-sport="Tug of war"
    >
      <div className="section-heading" data-reveal>
        <div>
          <span className="section-kicker">A little courtside rivalry</span>
          <h2>
            Same Bolt.
            <br />
            Different sides.
          </h2>
        </div>
        <p>
          Six teammates. One rope. Pick a side and pull.
          <br />A friendly warm-up, not an official event score.
        </p>
      </div>
      <div
        className="tug-arena"
        data-pulling={pulling || "none"}
        data-winner={state.winner || "none"}
      >
        <div className="tug-team-labels">
          {(["left", "right"] as const).map((side) => (
            <label
              key={side}
              style={
                {
                  "--team-color": (side === "left" ? left : right).color,
                } as React.CSSProperties
              }
            >
              <span className="tug-team-dot" />
              {side === "left" ? "Left squad" : "Right squad"}
              <select
                aria-label={`${side === "left" ? "Left" : "Right"} tug team`}
                value={side === "left" ? leftId : rightId}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (side === "left") setLeftId(id);
                  else setRightId(id);
                  reset();
                }}
              >
                {TEAMS.filter(
                  (team) => team.id !== (side === "left" ? rightId : leftId),
                ).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <svg className="tug-ground" viewBox="0 0 1000 340" aria-hidden="true">
          <path d="M0 235q220-70 500-26t500-8v139H0z" fill="#d8e5b6" />
          <path d="M0 291h1000M500 229v91" stroke="#fffff5" strokeWidth="3" />
          <path d="M488 320h24" stroke="#315a36" strokeWidth="3" />
          <g
            className="tug-rope-group"
            style={{ transform: `translateX(${state.position * 8}px)` }}
          >
            <path
              d="M90 242q410-5 820 0"
              stroke="#987445"
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M90 242q410-5 820 0"
              stroke="#ead0a0"
              strokeWidth="3"
              strokeDasharray="3 7"
              fill="none"
            />
            {(["left", "right"] as const).map((side) => (
              <g
                key={side}
                className={`tug-squad tug-squad-${side}`}
                style={
                  {
                    "--bolt-jersey": (side === "left" ? left : right).color,
                  } as React.CSSProperties
                }
              >
                {[0, 1, 2].map((index) => (
                  <g
                    key={index}
                    className="tug-athlete"
                    transform={
                      side === "left"
                        ? `translate(${40 + index * 125} 128) scale(.54)`
                        : `translate(${960 - index * 125} 128) scale(-.54 .54)`
                    }
                  >
                    <BoltPortrait pull football={false} />
                  </g>
                ))}
              </g>
            ))}
            <path d="M500 237v35l14-7-6-28z" fill="#bd6039" />
            <path d="M500 237v35l-10-5 2-30z" fill="#f6b6a2" />
          </g>
          <path
            d="m21 281 6-14 7 14m931 0 7-14 7 14"
            fill="none"
            stroke="#869d57"
            strokeWidth="2"
          />
        </svg>
        <div className="tug-score" role="status" aria-live="polite">
          {winner
            ? `${winner.name} takes the rope!`
            : state.pulls
              ? `${Math.abs(state.position)} pull${Math.abs(state.position) === 1 ? "" : "s"} ${state.position < 0 ? "to the left" : state.position > 0 ? "to the right" : "— all square"}`
              : "All square. Who’s pulling first?"}
        </div>
        <div
          className="tug-meter"
          role="meter"
          aria-label="Rope position: left to right"
          aria-valuemin={-TUG_LIMIT}
          aria-valuemax={TUG_LIMIT}
          aria-valuenow={state.position}
          aria-valuetext={
            winner
              ? `${winner.name} wins`
              : `${Math.abs(state.position)} pulls ${state.position < 0 ? "left" : "right"}`
          }
        >
          <span
            style={{ left: `${50 + (state.position / TUG_LIMIT) * 46}%` }}
          />
        </div>
        <div className="tug-controls">
          <button
            className="button"
            style={{ "--team-color": left.color } as React.CSSProperties}
            disabled={!!winner}
            onClick={() => pull("left")}
          >
            <ArrowLeft size={18} /> Pull for {left.name}
          </button>
          <button
            className="tug-reset"
            aria-label="Reset tug of war"
            onClick={reset}
          >
            <RotateCcw size={18} />
            <span>Rematch</span>
          </button>
          <button
            className="button"
            style={{ "--team-color": right.color } as React.CSSProperties}
            disabled={!!winner}
            onClick={() => pull("right")}
          >
            Pull for {right.name} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
