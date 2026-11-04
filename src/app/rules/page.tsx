import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Rulebook } from "@/components/rulebook";
import { TournamentFormat } from "@/components/tournament-format";
import { EventPointsOverview } from "@/components/event-points";
import "./rules.css";

export const metadata = { title: "Sports rules & formats", description: "Bachelor’s BLITZ rules for all eight sports, match formats, team points, the overall championship, and the six-team, two-pool tournament format." };

export default function RulesPage() {
  return (
    <div className="page-width rules-page">
      <div className="page-intro" data-entrance><span className="section-kicker">Sports rules & formats</span><h1>Know the game.<br/>Bring your best.</h1><p>Team sizes, match formats, event points, and the route to the final. Select a sport to open its rulebook.</p></div>
      <Rulebook/>
      <EventPointsOverview/>
      <TournamentFormat/>
      <div className="rules-register"><div><span className="section-kicker">Ready when you are</span><h2>Your next move is yours.</h2></div><Link href="/register" className="button" data-mascot-note="You’ve got the rules. Now let’s get you on the team.">Get in the game <ArrowUpRight size={18}/></Link></div>
    </div>
  );
}
