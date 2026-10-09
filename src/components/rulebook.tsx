"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { SPORT_RULES, sportName, sportSlug } from "@/lib/sport-rules";
import { SportArt } from "./icons";
import { SportEventPoints } from "./event-points";
import { reactMascot } from "@/lib/mascot-behavior";

export function Rulebook() {
  const [selected, setSelected] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropPress = useRef(false);
  const rule = SPORT_RULES.find((item) => sportSlug(item.sport) === selected);
  const isOpen = selected !== null;

  const showSport = useCallback((slug: string, opener?: HTMLElement, updateHash = true) => {
    const next = SPORT_RULES.find((item) => sportSlug(item.sport) === slug);
    if (!next) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    openerRef.current = opener || null;
    setClosing(false);
    setSelected(slug);
    if (updateHash && window.location.hash !== `#${slug}`) {
      window.history.pushState(window.history.state, "", `#${slug}`);
    }
    reactMascot({
      action: "point",
      message: `${sportName(next.sport)}. Know the rules, bring your best.`,
      sport: next.sport,
    }, 2200);
  }, []);

  const closeSport = useCallback((clearHash = true) => {
    if (!dialogRef.current?.open || closeTimer.current) return;
    const finish = () => {
      closeTimer.current = null;
      dialogRef.current?.close();
      setSelected(null);
      setClosing(false);
      if (clearHash && SPORT_RULES.some((item) => `#${sportSlug(item.sport)}` === window.location.hash)) {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
      if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
    } else {
      setClosing(true);
      closeTimer.current = setTimeout(finish, 180);
    }
  }, []);

  useEffect(() => {
    const followHash = () => {
      const slug = window.location.hash.slice(1);
      if (SPORT_RULES.some((item) => sportSlug(item.sport) === slug)) showSport(slug, undefined, false);
      else closeSport(false);
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    window.addEventListener("popstate", followHash);
    return () => {
      window.removeEventListener("hashchange", followHash);
      window.removeEventListener("popstate", followHash);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [showSport, closeSport]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousGutter = root.style.scrollbarGutter;
    root.style.scrollbarGutter = "stable";
    root.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      root.style.overflow = previousOverflow;
      root.style.scrollbarGutter = previousGutter;
    };
  }, [isOpen]);

  return (
    <>
      <nav className="rules-jump" aria-label="Jump to a sport’s rules">
        {SPORT_RULES.map(({ sport }) => (
          <a key={sport} href={`#${sportSlug(sport)}`} data-mascot-sport={sport}
            aria-haspopup="dialog" aria-controls="sport-rules-dialog"
            onClick={(event) => {
              event.preventDefault();
              showSport(sportSlug(sport), event.currentTarget);
            }}>
            {sportName(sport)}
          </a>
        ))}
        <a href="#event-points">Event points <ArrowUpRight size={14} /></a>
        <a href="#knockout" className="rules-jump-bracket">Tournament bracket <ArrowUpRight size={14} /></a>
      </nav>
      <div className="rulebook-grid">
        {SPORT_RULES.map((item, index) => (
          <article className="rule-card" key={item.sport}>
            <button type="button" className="rule-card-trigger" aria-haspopup="dialog"
              aria-controls="sport-rules-dialog" aria-label={`${sportName(item.sport)} rules and format`}
              data-mascot-sport={item.sport}
              onClick={(event) => showSport(sportSlug(item.sport), event.currentTarget)}>
              <span className={`rule-art sport-${index}`}><SportArt sport={item.sport} /></span>
              <span className="rule-title">
                <span className="section-kicker">Game {String(index + 1).padStart(2, "0")}</span>
                <strong>{sportName(item.sport)}</strong>
                <span className="rule-format">{item.format}</span>
                <span className="rule-card-hint">View rules & format <ArrowUpRight size={12} /></span>
              </span>
              <ArrowUpRight className="rule-card-arrow" size={20} />
            </button>
          </article>
        ))}
      </div>
      <dialog ref={dialogRef} id="sport-rules-dialog" className="rules-modal"
        aria-labelledby="sport-rules-title" aria-describedby="sport-rules-format"
        data-closing={closing} data-lenis-prevent
        onCancel={(event) => { event.preventDefault(); closeSport(); }}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          backdropPress.current = event.target === event.currentTarget &&
            (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && backdropPress.current) closeSport();
          backdropPress.current = false;
        }}>
        {rule && (
          <div className="rules-modal-window" key={selected}>
            <div className="rules-modal-chrome">
              <span>Bachelor’s BLITZ · Rulebook</span>
              <button type="button" className="rules-modal-close" aria-label="Close sport rules" autoFocus onClick={() => closeSport()}><X size={18} /></button>
            </div>
            <div className="rules-modal-scroll">
              <div className="rules-modal-heading">
                <span className={`rule-art sport-${SPORT_RULES.indexOf(rule)}`}><SportArt sport={rule.sport} /></span>
                <div><span className="section-kicker">Sports rules & formats</span><h2 id="sport-rules-title">{sportName(rule.sport)}</h2><p id="sport-rules-format">{rule.format}</p></div>
              </div>
              <div className="rule-content">
                <dl className="rule-facts">{rule.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                {rule.sections.map((section) => (
                  <div className="rule-section" key={section.title}><h3>{section.title}</h3><ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul></div>
                ))}
                {rule.categories && <div className="rule-section"><h3>Weight categories</h3><div className="weight-categories">{rule.categories.map((category) => <span key={category}>{category}</span>)}</div></div>}
                <SportEventPoints points={rule.eventPoints} />
                <Link className="button rules-modal-register" href={`/register?sport=${encodeURIComponent(rule.sport)}`}>Register for {sportName(rule.sport)} <ArrowUpRight size={16} /></Link>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
