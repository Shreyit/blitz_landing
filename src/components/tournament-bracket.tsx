"use client";

import { useState } from "react";
import { Trophy, ArrowRight } from "lucide-react";
import { QUARTERFINALS, SEMIFINALS } from "@/lib/sport-rules";
import { reactMascot } from "@/lib/mascot-behavior";

function BracketConnectors({ stage, selected }: { stage: "teams" | "quarterfinals" | "semifinals"; selected: number | null }) {
  const paths = stage === "teams"
    ? QUARTERFINALS.map((_, index) => {
        const center = 55 + index * 110;
        return `M0 ${center - 16}H22V${center + 16}H0M22 ${center}H44`;
      })
    : stage === "quarterfinals"
      ? QUARTERFINALS.map((_, index) => `M0 ${55 + index * 110}H22V${index < 2 ? 110 : 330}H44`)
      : SEMIFINALS.map((_, index) => `M0 ${110 + index * 220}H22V220H44`);
  const active = selected === null ? null : stage === "semifinals" ? Math.floor(selected / 2) : selected;
  return (
    <svg className="bracket-connectors" viewBox="0 0 44 440" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((path, index) => <path key={index} d={path} vectorEffect="non-scaling-stroke" />)}
      {active !== null && <path d={paths[active]} data-active="true" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export function TournamentBracket() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <section id="knockout" className="knockout-section" data-bolt-greeting="Win and advance. Four quarterfinals, two semifinals, one champion.">
      <div className="section-heading"><div><span className="section-kicker">The 8-team knockout format</span><h2>One bracket.<br/>One champion.</h2></div><p>Every knockout match is single elimination.<br/>The winner advances. The losing team is eliminated.</p></div>
      <div className="tournament-pools">
        <div><span>Pool A</span><strong>A1 · A2 · A3 · A4</strong></div>
        <span className="pool-divider">8 teams<br/>2 pools</span>
        <div><span>Pool B</span><strong>B1 · B2 · B3 · B4</strong></div>
      </div>
      <p className="bracket-caption">Four teams in each pool. A1–A4 and B1–B4 identify the teams by pool position/ranking. Select a quarterfinal to follow its route.</p>
      <p className="bracket-scroll-hint">Swipe or scroll sideways to follow the bracket.</p>
      <div className="bracket-scroll" role="region" aria-label="Tournament bracket: quarterfinals to champion" tabIndex={0}>
      <div className="tournament-bracket">
        <div className="bracket-round quarterfinal-round"><h3>Quarterfinals <span>8 teams</span></h3><div className="bracket-matches">
          {QUARTERFINALS.map((match, index) => <button key={match.id} type="button" className="bracket-match bracket-team-pair" aria-label={`${match.id} ${match.teams.join(" vs ")}`} aria-pressed={selected === index} onClick={() => {
            setSelected(selected === index ? null : index);
            reactMascot({ action: "point", message: `${match.teams.join(" vs ")} → ${index < 2 ? "Semifinal 1" : "Semifinal 2"} → Final. That’s the route!` }, 2400);
          }}><span>{match.id}</span><strong><span>{match.teams[0]}</span><span>{match.teams[1]}</span></strong><ArrowRight size={15}/></button>)}
          <BracketConnectors stage="teams" selected={selected} />
        </div></div>
        <div className="bracket-round quarterfinal-winners-round"><h3>Quarterfinal winners <span>4 teams</span></h3><div className="bracket-matches">
          {QUARTERFINALS.map((match, index) => <div key={match.id} className="bracket-match bracket-winner" data-active={selected === index}><span>{match.id}</span><strong>Winner of {match.id}</strong></div>)}
          <BracketConnectors stage="quarterfinals" selected={selected} />
        </div></div>
        <div className="bracket-round semifinal-round"><h3>Semifinals <span>4 winners</span></h3><div className="bracket-matches">
          {SEMIFINALS.map((match,index) => <div key={match.id} className="bracket-match bracket-semifinal" style={{ gridRow: `${index * 2 + 1} / span 2` }} data-active={selected !== null && Math.floor(selected / 2) === index}><span>{match.id}</span><span className="bracket-feeders">{match.teams[0]}<small>vs</small>{match.teams[1]}</span><strong>Winner of {match.id}</strong></div>)}
          <BracketConnectors stage="semifinals" selected={selected} />
        </div></div>
        <div className="bracket-round final-round"><h3>Final <span>2 winners</span></h3><div className="bracket-matches"><div className="bracket-champion" data-active={selected !== null}><span className="bracket-feeders">Winner of SF1<small>vs</small>Winner of SF2</span><Trophy size={26}/><span>Tournament champion</span><strong>Winner of the Final</strong></div></div></div>
      </div>
      </div>
      <div className="knockout-notes"><span>Starts at the quarterfinals</span><span>No loser bracket</span><span>No third-place or bronze-medal match</span></div>
    </section>
  );
}
