import { Trophy } from "lucide-react";
import { SPORT_RULES, sportName, type EventPoints } from "@/lib/sport-rules";

export function SportEventPoints({ points }: { points: EventPoints }) {
  return (
    <section className="rule-section sport-event-points" aria-label="Event points">
      <h3>Event points</h3>
      <p className="points-description">Each category awards points to the winner’s and runner-up’s teams.</p>
      <table className="points-table">
        <caption className="visually-hidden">Team points for each category</caption>
        <thead><tr><th scope="col">Category</th><th scope="col">Winner</th><th scope="col">Runner-up</th></tr></thead>
        <tbody>{points.categories.map((category) => (
          <tr key={category}><th scope="row">{category}</th><td><strong>{points.winner}</strong><span> pts</span></td><td>{points.runnerUp}<span> pts</span></td></tr>
        ))}</tbody>
      </table>
      {points.note && <p className="points-description points-note">{points.note}</p>}
    </section>
  );
}

export function EventPointsOverview() {
  return (
    <section id="event-points" className="event-points-section" aria-labelledby="event-points-title">
      <div className="section-heading"><div><span className="section-kicker">The overall standings</span><h2 id="event-points-title">Every sport counts.<br/>Every point adds up.</h2></div><p>Sport and category winners earn points for their teams. Add them across all eight sports: the team with the highest total becomes the overall BLITZ champion.</p></div>
      <div className="event-points-summary"><Trophy size={22} aria-hidden="true"/><p><strong>One team total. An entire event’s effort.</strong><span>These are points for final placings, separate from goals, runs, sets, and other match scores. Men’s, women’s, mixed, and weight categories award points separately.</span></p></div>
      <div className="event-points-table-wrap">
        <table className="points-table event-points-table">
          <caption className="visually-hidden">BLITZ team points by sport and category</caption>
          <thead><tr><th scope="col">Sport & categories</th><th scope="col">Winner</th><th scope="col">Runner-up</th></tr></thead>
          <tbody>{SPORT_RULES.map(({ sport, eventPoints }) => (
            <tr key={sport}>
              <th scope="row"><strong>{sportName(sport)}</strong><span>{eventPoints.categories.join(" · ")}{sport === "Weightlifting" && " · men’s and women’s separately"}</span></th>
              <td><strong>{eventPoints.winner}</strong><span> pts</span></td><td>{eventPoints.runnerUp}<span> pts</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="points-description points-note">Each sport and category also has its own winner. Points from individual players and doubles pairs count towards the team they represent.</p>
    </section>
  );
}
