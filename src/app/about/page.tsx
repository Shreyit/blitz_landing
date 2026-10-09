import Link from "next/link";
import { ArrowUpRight, Flag, HeartHandshake, Leaf } from "lucide-react";
import { Mascot } from "@/components/mascot";
import { Bolt } from "@/components/icons";
export const metadata = { title: "The spirit" };
export default function About() {
  return (
    <div className="page-width about-page">
      <div className="page-intro" data-entrance>
        <span className="section-kicker">About & preamble</span>
        <h1>
          Good games.
          <br />
          Better connections.
        </h1>
        <p>
          BLITZ is a campus sports event hosted by the Bachelors in Analytics
          and Sustainability Studies programme at TISS Mumbai.
        </p>
      </div>
      <div className="about-feature" data-reveal>
        <div className="about-feature-copy">
          <span className="section-kicker">The team comes first</span>
          <h2>
            We share a campus.
            <br />
            Let’s share a team.
          </h2>
          <p>
            Across BSASS and BSW, across years and classrooms, sport gives us a
            common starting point. BLITZ is a place to compete with care,
            support people you’ve just met, and take part in something built
            together.
          </p>
          <p>
            Players bring their game. Volunteers keep the event moving. Everyone
            has a role in making the ground feel welcoming.
          </p>
          <Link href="/register" className="button">
            Find your role <ArrowUpRight size={18} />
          </Link>
        </div>
        <aside className="about-mascot" aria-label="Bolt’s corner">
          <div className="spirit-mascot-heading">
            <span className="spirit-bolt-mark"><Bolt /></span>
            <div><span>Bolt’s corner</span><h3>Everybody belongs.</h3></div>
          </div>
          <Mascot layout="panel" className="spirit-mascot" />
        </aside>
      </div>
      <section className="preamble" data-reveal>
        <span className="section-kicker">Our preamble · working draft</span>
        <h2>
          Competition with care.
          <br />
          Participation with purpose.
        </h2>
        <p>
          We come together in the spirit of fair play, mutual respect, and
          collective responsibility. We recognise the contribution of every
          player, volunteer, and supporter. We commit to an event that welcomes
          different abilities, respects our shared spaces, and celebrates effort
          alongside achievement.
        </p>
        <p>
          May BLITZ give us stronger teams, new friendships, and a campus
          culture that carries beyond the field.
        </p>
        <span className="muted">
          Final wording will be confirmed by the organising team.
        </span>
      </section>
      <div className="values-grid" data-reveal>
        {[
          {
            icon: Flag,
            title: "Play fair",
            text: "Respect the rules, your teammates, and the person on the other side.",
          },
          {
            icon: HeartHandshake,
            title: "Show up for each other",
            text: "A good event is a collective effort. Every contribution counts.",
          },
          {
            icon: Leaf,
            title: "Care for the campus",
            text: "Use shared spaces thoughtfully and leave the ground ready for the next game.",
          },
        ].map((v) => (
          <article key={v.title}>
            <v.icon size={27} />
            <h3>{v.title}</h3>
            <p>{v.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
