"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  fieldReaction,
  MASCOT_EVENT,
  MascotAction,
  MascotReaction,
  pageReaction,
  reactMascot,
  MascotSport,
  isMascotSport,
  pageSport,
  mascotTrick,
} from "@/lib/mascot-behavior";
import { sportName } from "@/lib/sport-rules";
const REST: MascotReaction = {
  action: "idle",
  message: "Your courtside companion.",
};
// Actions a [data-mascot-move] element may request on hover.
const NOTE_ACTIONS = new Set<string>(["point", "wave", "highfive", "celebrate", "encourage", "think", "peek"]);
const Context = createContext({
  reaction: REST,
  enabled: true,
  sport: "Football" as MascotSport,
  setSport: (_sport: MascotSport) => {},
  showTrick: () => {},
});
export function useMascot() {
  return useContext(Context);
}
export function MascotProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const base = useMemo(() => pageReaction(path), [path]);
  const [reaction, setReaction] = useState<MascotReaction>(base || REST);
  const [sport, setSport] = useState<MascotSport>(() => pageSport(path));
  const baseRef = useRef(base);
  baseRef.current = base;
  const restRef = useRef(base);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const priorityUntil = useRef(0);
  const trickUntil = useRef(0);
  const trickIndex = useRef(0);
  const showTrick = () => {
    if (priorityUntil.current === Infinity) return;
    trickUntil.current = Date.now() + 3200;
    reactMascot(mascotTrick(trickIndex.current++), 3200);
  };
  useEffect(() => {
    clearTimeout(timeout.current);
    priorityUntil.current = 0;
    trickUntil.current = 0;
    restRef.current = base;
    const querySport =
      path === "/register"
        ? new URLSearchParams(window.location.search).get("sport")
        : null;
    setSport(
      querySport && isMascotSport(querySport) ? querySport : pageSport(path),
    );
    setReaction(base || REST);
    if (base)
      timeout.current = setTimeout(
        () => setReaction({ ...base, action: "idle" }),
        3000,
      );
    return () => clearTimeout(timeout.current);
  }, [base, path]);
  useEffect(() => {
    if (!base) return;
    let lastHover = "",
      lastScroll = window.scrollY,
      scrollTimer: ReturnType<typeof setTimeout>;
    const restore = () => {
      if (Date.now() < priorityUntil.current) return;
      const current = restRef.current || baseRef.current;
      if (current) setReaction({ ...current, action: "idle" });
    };
    const onReaction = (event: Event) => {
      const {
        reaction: next,
        duration,
        persistent,
      } = (
        event as CustomEvent<{
          reaction: MascotReaction;
          duration: number;
          persistent?: boolean;
        }>
      ).detail;
      // A password field holds privacy until blur, even if another event arrives.
      if (priorityUntil.current === Infinity && next.action !== "peek") return;
      if (next.sport && isMascotSport(next.sport)) setSport(next.sport);
      if (persistent) restRef.current = next;
      clearTimeout(scrollTimer);
      clearTimeout(timeout.current);
      priorityUntil.current = Date.now() + duration;
      setReaction(next);
      timeout.current = setTimeout(restore, duration);
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement
        )
      )
        return;
      const next = fieldReaction(target.type, target.name);
      if (next) reactMascot(next, 4500);
      if (target.type === "password") {
        clearTimeout(timeout.current);
        priorityUntil.current = Infinity;
      }
    };
    const blur = (event: FocusEvent) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.type === "password"
      ) {
        priorityUntil.current = 0;
        restore();
      }
    };
    const invalid = () =>
      reactMascot({
        action: "encourage",
        message: "Check the highlighted field. You’ve got this.",
      });
    const hover = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || priorityUntil.current === Infinity || Date.now() < trickUntil.current)
        return;
      const card = target.closest<HTMLElement>("[data-mascot-sport]");
      if (card && card.dataset.mascotSport !== lastHover) {
        lastHover = card.dataset.mascotSport || "";
        if (isMascotSport(lastHover)) setSport(lastHover);
        reactMascot(
          {
            action: lastHover === "Football" ? "dribble" : "point",
            message: `${sportName(lastHover)}? Let’s see your game face.`,
          },
          2400,
        );
      }
      if (!card) lastHover = "";
      const note = target.closest<HTMLElement>("[data-mascot-note]");
      if (note && note.dataset.mascotNote !== lastHover) {
        lastHover = note.dataset.mascotNote || "";
        const action = note.dataset.mascotMove;
        reactMascot(
          {
            action: action && NOTE_ACTIONS.has(action) ? (action as MascotAction) : "point",
            message: lastHover,
          },
          2200,
        );
      }
    };
    const scroll = () => {
      const delta = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      if (
        delta < 3 ||
        Date.now() < priorityUntil.current ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      setReaction((current) =>
        current.action === "run"
          ? current
          : { ...current, action: "run", message: "Keeping up with you." },
      );
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(restore, 180);
    };
    window.addEventListener(MASCOT_EVENT, onReaction);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("pointerover", hover);
    document.addEventListener("focusin", hover);
    const sections = new IntersectionObserver((entries) => {
      const entry = entries.find((item) => item.isIntersecting);
      if (!entry || Date.now() < priorityUntil.current) return;
      const message = (entry.target as HTMLElement).dataset.boltGreeting;
      if (message) {
        restRef.current = { action: "idle", message };
        reactMascot({ action: "wave", message }, 1800);
      }
    }, { rootMargin: "-20% 0px -35% 0px", threshold: 0 });
    document.querySelectorAll("[data-bolt-greeting]").forEach((node) => sections.observe(node));
    return () => {
      clearTimeout(timeout.current);
      clearTimeout(scrollTimer);
      window.removeEventListener(MASCOT_EVENT, onReaction);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("pointerover", hover);
      document.removeEventListener("focusin", hover);
      sections.disconnect();
    };
  }, [base]);
  return (
    <Context.Provider
      value={{ reaction, enabled: base !== null, sport, setSport, showTrick }}
    >
      {children}
    </Context.Provider>
  );
}
