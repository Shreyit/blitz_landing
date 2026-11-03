import Link from "next/link";
import Image from "next/image";
import tissLogo from "../../img/TISS_logo.png";
import {
  ArrowDown,
  ArrowUpRight,
  MoveUpRight,
  Trophy,
  Users,
  HeartHandshake,
} from "lucide-react";
import { Mascot } from "@/components/mascot";
import { TugOfWar } from "@/components/tug-of-war";
import { SportCard } from "@/components/sport-card";
import { Bolt, SportArt } from "@/components/icons";
import { SPORTS } from "@/lib/event";
export default function Home() {
  return (
    <>
      <section className="hero page-width">
        <div className="hero-topline" data-entrance>
          <span>
            <span className="status-dot" /> TISS Mumbai, this one’s ours.
          </span>
          <span>Presented by BSASS</span>
        </div>
        <div className="hero-title" data-entrance>
          <h1>
            <span className="hero-wordmark"><span className="hero-prefix">Bachelor’s</span><span>BLITZ</span></span>
            <span className="title-star">
              <Bolt />
            </span>
          </h1>
          <span className="hero-edition">
            The campus
            <br />
            sports collective
          </span>
        </div>
        <div className="hero-grid">
          <div className="hero-copy" data-entrance>
            <h2>
              Your campus.
              <br />
              Your people.
              <br />
              Your game.
            </h2>
            <p>
              For the ones who play. The ones who cheer.
              <br className="desktop-break" /> And the ones who make it all
              happen.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="button" data-mascot-note="Suit up, teammate. Let’s get you in the game.">
                Get in the game <ArrowUpRight size={19} />
              </Link>
              <Link href="/about" className="secondary-link">
                Meet BLITZ <MoveUpRight size={17} />
              </Link>
            </div>
            <div className="host-note">
              <span className="host-mark">
                <Image src={tissLogo} alt="Tata Institute of Social Sciences" sizes="40px" />
              </span>
              <span>
                Hosted by Bachelors in Analytics
                <br />
                and Sustainability Studies, Mumbai
              </span>
            </div>
          </div>
          <div className="hero-visual" data-entrance>
            <div className="court-lines">
              <div className="court-circle" />
              <div className="court-key" />
            </div>
            <span className="hero-orbit">
              Good sports.
              <br />
              Great company.
            </span>
            <Mascot className="hero-mascot" />
            <div className="mascot-name">
              <span className="status-dot" /> Bolt · Small hero. Big game.
            </div>
            <div className="visual-sticker">
              <Bolt />
              <span>
                A little rivalry.
                <br />A lot of heart.
              </span>
            </div>
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#the-games">
            There’s a game for you <ArrowDown size={16} />
          </a>
          <span>Six teams. One campus. All in.</span>
        </div>
      </section>
      <div className="sport-ribbon" aria-hidden="true">
        <span>Show up</span>
        <Bolt />
        <span>Team up</span>
        <Bolt />
        <span>Play your heart out</span>
        <Bolt />
        <span>Show up</span>
        <Bolt />
        <span>Team up</span>
        <Bolt />
      </div>
      <section className="page-width games-section" id="the-games" data-bolt-greeting="Find your superpower. Hover over a sport and give it a spin.">
        <div className="section-heading" data-reveal>
          <div>
            <span className="section-kicker">Find your game</span>
            <h2>
              Different courts.
              <br />
              Same competitive spirit.
            </h2>
          </div>
          <p>
            A familiar favourite or a first attempt.
            <br />
            Pick your sports when you register.
          </p>
        </div>
        <div className="sports-grid">
          {SPORTS.map((sport, i) => <SportCard key={sport} sport={sport} index={i} />)}
        </div>
        <div className="sports-rulebook"><p>Eight ways to play.<span>Know your format before you step on court.</span></p><Link href="/rules" className="text-link">The rules & tournament bracket <ArrowUpRight size={17}/></Link></div>
      </section>
      <section className="spirit-section page-width" data-reveal data-bolt-greeting="Every superhero needs a team. This one’s yours.">
        <div className="spirit-art">
          <div className="spirit-word">
            ALL
            <br />
            OF US.
          </div>
          <div className="spirit-ball">
            <SportArt sport="Dodgeball" />
          </div>
          <span className="handwritten">That’s the team.</span>
        </div>
        <div className="spirit-copy">
          <span className="section-kicker">More than a match</span>
          <h2>
            A campus is better
            <br />
            when it plays together.
          </h2>
          <p>
            BLITZ brings BSASS and BSW students onto the same ground. Different
            years, new teammates, and a reason to know the person beyond the
            classroom.
          </p>
          <p>
            We’re here for honest competition, shared responsibility, and the
            kind of moments you keep talking about after the final whistle.
          </p>
          <Link href="/about" className="text-link">
            Read our preamble <ArrowUpRight size={19} />
          </Link>
        </div>
      </section>
      <TugOfWar />
      <section className="auction-invite page-width" data-reveal data-bolt-greeting="Six teams, one fair shot. Meet your next squad in the Auction Dome.">
        <div className="invite-top">
          <span>
            <span className="status-dot" /> Where teams take shape
          </span>
          <Trophy size={24} />
        </div>
        <div className="invite-main">
          <h2>
            The auction.
            <br />
            The anticipation.
            <br />
            Your next team.
          </h2>
          <div>
            <p>
              Six teams. ₹2,000 each. Every player starts with a chance.
              Follow the bids and watch your campus squads come together.
            </p>
            <Link href="/auction" className="button button-light">
              Let’s go to the Auction Dome <ArrowUpRight size={19} />
            </Link>
          </div>
        </div>
        <div className="invite-bottom">
          <span>₹20 opening bid</span>
          <span>6 team purses</span>
          <span>One fair shot for everyone</span>
        </div>
      </section>
      <section className="participate-section page-width" data-reveal data-bolt-greeting="Player or volunteer, you’ve got a place on this team.">
        <div>
          <span className="section-kicker">Your place is here</span>
          <h2>
            On the court.
            <br />
            Behind the scenes.
          </h2>
        </div>
        <Link href="/register" className="participate-option">
          <Users size={26} />
          <h3>Play for your team</h3>
          <p>Pick your sports and put your name in the auction.</p>
          <span>
            Register as a player <ArrowUpRight size={18} />
          </span>
        </Link>
        <Link href="/register?role=volunteer" className="participate-option">
          <HeartHandshake size={26} />
          <h3>Make it happen</h3>
          <p>Bring the energy that keeps the whole event moving.</p>
          <span>
            Join the volunteers <ArrowUpRight size={18} />
          </span>
        </Link>
      </section>
    </>
  );
}
