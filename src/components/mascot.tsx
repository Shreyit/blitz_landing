"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  MascotAction,
  reactMascot,
} from "@/lib/mascot-behavior";
import { useMascot } from "./mascot-provider";
import { MascotBackdrop } from "./mascot-backdrop";
import { FootballBall } from "./football-art";
type Controller = ReturnType<typeof import("./mascot-scene").createMascotScene>;

export function BoltPortrait({
  pull = false,
  football = true,
}: {
  pull?: boolean;
  football?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={pull ? "bolt-tug-portrait" : "mascot-fallback"} width="300" height="340" viewBox="0 0 300 340" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-suit`} cx="30%" cy="20%" r="85%"><stop stopColor="#608466"/><stop offset=".6" stopColor="var(--bolt-jersey,#315a36)"/><stop offset="1" stopColor="#193920"/></radialGradient>
        <radialGradient id={`${id}-lime`} cx="30%" cy="20%" r="85%"><stop stopColor="#f3ffaf"/><stop offset=".55" stopColor="#d9f46b"/><stop offset="1" stopColor="#9bb945"/></radialGradient>
        <radialGradient id={`${id}-cream`} cx="30%" cy="20%" r="85%"><stop stopColor="#fffff5"/><stop offset="1" stopColor="#dfe6c9"/></radialGradient>
      </defs>
      <ellipse cx="150" cy="310" rx="67" ry="9" fill="#193920" opacity=".13"/>
      <g className={`bolt-body ${pull ? "bolt-pulling" : ""}`}>
        <g className="bolt-leg bolt-leg-left">
          <path d="M132 245v42" stroke={`url(#${id}-suit)`} strokeWidth="22" strokeLinecap="round"/>
          <path d="M121 273h22v13h-22z" fill="#d9f46b"/>
          <path d="M143 282c-21-3-44 7-44 18q0 10 44 6z" fill={`url(#${id}-lime)`} stroke="#9bb945" strokeWidth="1.5"/>
          <path d="M100 303h43" stroke="#fffff5" strokeWidth="5" strokeLinecap="round"/>
          <path d="m118 286 6 7 8-10" stroke="#fffff5" strokeWidth="3" fill="none"/>
        </g>
        <g className="bolt-leg bolt-leg-right">
          <path d="M170 245v42" stroke={`url(#${id}-suit)`} strokeWidth="22" strokeLinecap="round"/>
          <path d="M159 273h22v13h-22z" fill="#d9f46b"/>
          <path d="M159 282c21-3 44 7 44 18q0 10-44 6z" fill={`url(#${id}-lime)`} stroke="#9bb945" strokeWidth="1.5"/>
          <path d="M160 303h42" stroke="#fffff5" strokeWidth="5" strokeLinecap="round"/>
          <path d="m171 286 6 7 8-10" stroke="#fffff5" strokeWidth="3" fill="none"/>
        </g>
        {!pull && <>
          <g className="bolt-arm bolt-arm-left">
            <path d="M111 198q-24 15-22 44" stroke={`url(#${id}-suit)`} strokeWidth="24" fill="none" strokeLinecap="round"/>
            <path d="m87 223 16 4" stroke="#d9f46b" strokeWidth="9"/>
            <ellipse cx="90" cy="245" rx="14" ry="17" fill={`url(#${id}-lime)`}/>
            <path d="m80 241 7-4" stroke="#fffff5" strokeWidth="2" opacity=".65"/>
          </g>
          <g className="bolt-arm bolt-arm-right">
            <path d="M189 198q24 15 22 44" stroke={`url(#${id}-suit)`} strokeWidth="24" fill="none" strokeLinecap="round"/>
            <path d="m199 227 16-4" stroke="#d9f46b" strokeWidth="9"/>
            <ellipse cx="210" cy="245" rx="14" ry="17" fill={`url(#${id}-lime)`}/>
            <path d="m201 239 7-3" stroke="#fffff5" strokeWidth="2" opacity=".65"/>
          </g>
        </>}
        <path d="M116 183q34-13 68 0c17 17 19 47 12 68q-46 18-92 0c-7-21-5-51 12-68z" fill={`url(#${id}-suit)`}/>
        <path d="m113 194 15 21m59-21-15 21" stroke="#739760" strokeWidth="3" fill="none"/>
        <path d="m105 243 24 4 12-7h18l12 7 24-4" stroke="#d9f46b" strokeWidth="7" fill="none"/>
        <circle cx="150" cy="214" r="22" fill="#fffff5" stroke="#d9f46b" strokeWidth="3"/>
        <path d="m156 194-21 25h14l-5 17 23-26h-14z" fill="#315a36"/>
        {pull && <g className="bolt-pull-arms" strokeLinecap="round">
          <path d="M112 201q20 19 91 16M188 201l21 11 25 5" stroke="var(--bolt-jersey,#315a36)" strokeWidth="22" fill="none"/>
          <ellipse cx="214" cy="217" rx="14" ry="12" fill={`url(#${id}-lime)`}/><ellipse cx="238" cy="217" rx="14" ry="12" fill={`url(#${id}-lime)`}/>
        </g>}
        <g className="bolt-head">
          <path d="m85 95-29-16 12 21-13 1 30 25m130-31 29-16-12 21 13 1-30 25" fill={`url(#${id}-lime)`} stroke="#9bb945" strokeWidth="1.5"/>
          <ellipse cx="150" cy="121" rx="76" ry="72" fill={`url(#${id}-suit)`}/>
          <path d="M103 65q20-15 43-13" stroke="#89a77e" strokeWidth="4" strokeLinecap="round" opacity=".7" fill="none"/>
          <path d="m157 60-24 32h17l-6 22 27-36h-17z" fill={`url(#${id}-lime)`}/>
          <path d="M91 130q15-24 32-20l27 13 27-13q17-4 32 20l-11 33q-48 44-96 0z" fill={`url(#${id}-cream)`}/>
          <g className="bolt-eyes">
            <ellipse cx="121" cy="127" rx="18" ry="23" fill="#fffff5" stroke="#24452a" strokeWidth="3"/>
            <ellipse cx="179" cy="127" rx="18" ry="23" fill="#fffff5" stroke="#24452a" strokeWidth="3"/>
            <g className="bolt-pupils">
              <ellipse cx="123" cy="130" rx="10" ry="15" fill="#202820"/><ellipse cx="177" cy="130" rx="10" ry="15" fill="#202820"/>
              <circle cx="119" cy="124" r="4" fill="#fffff5"/><circle cx="173" cy="124" r="4" fill="#fffff5"/>
              <circle cx="127" cy="136" r="2" fill="#d9f46b"/><circle cx="181" cy="136" r="2" fill="#d9f46b"/>
            </g>
          </g>
          <path d="m106 101 25 5m37 0 25-5" stroke="#d9f46b" strokeWidth="4" strokeLinecap="round"/>
          <ellipse cx="101" cy="151" rx="9" ry="4" fill="#e68b61" opacity=".65"/><ellipse cx="199" cy="151" rx="9" ry="4" fill="#e68b61" opacity=".65"/>
          <path d="M137 160q13 16 26 0" fill="#202820"/><path d="M140 161h20" stroke="#fffff5" strokeWidth="3" strokeLinecap="round"/>
        </g>
      </g>
      {football && <g className="bolt-ball"><g transform="translate(242 286) rotate(-18) scale(.25)"><FootballBall/></g></g>}
    </svg>
  );
}

export function Mascot({
  className = "",
  mood,
  inline = true,
  layout = "scene",
}: {
  className?: string;
  mood?: MascotAction;
  inline?: boolean;
  layout?: "scene" | "panel";
}) {
  const { reaction, enabled, sport, showTrick } = useMascot();
  const action = mood || reaction.action;
  const ref = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const latest = useRef({ action, accent: reaction.accent });
  latest.current = { action, accent: reaction.accent };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const release = () => {
      controller.current?.dispose();
      controller.current = null;
      setReady(false);
    };
    const setup = () => {
      release();
      if (preference.matches) return;
      import("./mascot-scene")
        .then(({ createMascotScene }) => {
          if (
            cancelled ||
            preference.matches ||
            !ref.current ||
            controller.current
          )
            return;
          try {
            controller.current = createMascotScene(
              ref.current,
              latest.current.action,
            );
            controller.current.setAction(
              latest.current.action,
              latest.current.accent,
            );
            setReady(true);
          } catch {
            release();
          }
        })
        .catch(() => {
          if (!cancelled) release();
        });
    };
    setup();
    preference.addEventListener("change", setup);
    return () => {
      cancelled = true;
      preference.removeEventListener("change", setup);
      controller.current?.dispose();
      controller.current = null;
    };
  }, [enabled]);
  useEffect(() => {
    controller.current?.setAction(action, reaction.accent);
  }, [action, reaction.accent]);
  useEffect(() => {
    if (
      ready ||
      !enabled ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const gaze = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      portraitRef.current?.style.setProperty(
        "--bolt-look-x",
        `${(event.clientX / innerWidth - 0.5) * 6}px`,
      );
      portraitRef.current?.style.setProperty(
        "--bolt-look-y",
        `${(event.clientY / innerHeight - 0.5) * 4}px`,
      );
    };
    window.addEventListener("pointermove", gaze, { passive: true });
    return () => window.removeEventListener("pointermove", gaze);
  }, [ready, enabled]);
  if (!enabled) return null;
  return (
    <div
      className={`mascot ${className}`}
      ref={portraitRef}
      data-mascot-inline={inline ? "" : undefined}
      data-mascot-action={action}
      data-bolt-sport={sport}
      data-mascot-layout={layout}
      style={
        { "--bolt-jersey": reaction.accent || "#315a36" } as React.CSSProperties
      }
    >
      {inline && <p className="bolt-inline-speech" role="status">{reaction.message}</p>}
      <div className="mascot-stage">
        {inline && <MascotBackdrop sport={sport} />}
        <div className="mascot-canvas" ref={ref} aria-hidden="true" />
        {!ready && <BoltPortrait />}
        <span className="bolt-speed-trails" aria-hidden="true"><i/><i/><i/></span>
        <span className="mascot-sparkles" aria-hidden="true">
          ✦ <span>✧</span> ✦
        </span>
        <button
          type="button"
          className="mascot-hit-target"
          aria-label="Give Bolt a high-five"
          title="Give Bolt a high-five"
          onClick={() =>
            reactMascot(
              {
                action: "highfive",
                message: "Right back at you! Ready to play?",
              },
              2400,
            )
          }
        />
      </div>
      {inline && (
        <div className="bolt-inline-controls">
          <button
            type="button"
            aria-label="Show a trick"
            onClick={showTrick}
          >
            Show a trick ↗
          </button>
          {layout === "panel" && <span className="bolt-interaction-hint">Tap Bolt for a high-five.</span>}
        </div>
      )}
    </div>
  );
}
