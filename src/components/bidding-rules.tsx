import { Gavel, Shuffle, TimerReset, Wallet } from "lucide-react";
import { ROUND_NAMES, type AuctionState } from "@/lib/event";

/** Mirrors blitz.next_bid in the database so the examples match the live auction. */
function nextBid(round: number, current: number) {
  if (round === 0)
    return current === 0 ? 20 : current < 100 ? current + 5 : current < 200 ? current + 10 : current + 25;
  if (round === 1) return current === 0 ? 10 : current + 5;
  if (round === 2) return current === 0 ? 2 : current + 2;
  return current + 1;
}
function ladder(round: number, upTo: number) {
  const steps: number[] = [];
  for (let bid = nextBid(round, 0); bid <= upTo; bid = nextBid(round, bid)) steps.push(bid);
  return steps;
}

const ROUNDS = [
  { open: 20, step: "+5 · +10 · +25", who: "Every registered player, one by one, in a random order." },
  { open: 10, step: "+5", who: "Players who got no bid in the normal round." },
  { open: 2, step: "+2", who: "Players still unsold after Rapid fire 1." },
  { open: 1, step: "+1", who: "The last chance before random allocation." },
];
const BANDS = [
  { from: 20, to: 100, step: 5 },
  { from: 100, to: 200, step: 10 },
  { from: 200, to: null, step: 25 },
];
const LOT_STEPS = [
  { title: "On the floor", text: "The next player appears with their photo, course, year and sports." },
  { title: "Teams bid", text: "Each bid raises the price by one step. A team can’t outbid itself or bid beyond its purse." },
  { title: "Sold", text: "The hammer falls for the leading team. The price leaves their purse and the next player is up." },
  { title: "No bids?", text: "The player is marked unsold and returns in the next, cheaper rapid-fire round." },
];

export function BiddingRules({ state }: { state: AuctionState }) {
  const live = state.phase === "active" ? state.round : null;
  const example = ladder(0, 250);
  return (
    <section className="rules" aria-labelledby="rules-title">
      <header className="rules-intro">
        <span className="section-kicker">How bidding works</span>
        <h2 id="rules-title">Four rounds. Every bid, one step up.</h2>
        <p>
          Owners call their bids and the auctioneer records them. The price always moves by a fixed
          step, so everyone in the Dome knows exactly what the next bid costs.
        </p>
      </header>

      <ol className="rules-rounds">
        {ROUNDS.map((round, i) => (
          <li key={ROUND_NAMES[i]} className={live === i ? "rules-round is-live" : "rules-round"}>
            <div className="rules-round-top">
              <span className="rules-round-no">{i === 0 ? "Round 1" : `Rapid ${i}`}</span>
              {live === i && <span className="rules-live-tag">Live now</span>}
            </div>
            <h3>{i === 0 ? "Normal round" : `Rapid fire ${i}`}</h3>
            <div className="rules-figures">
              <div>
                <small>Opening bid</small>
                <strong>₹{round.open}</strong>
              </div>
              <div>
                <small>Each next bid</small>
                <strong>{round.step}</strong>
              </div>
            </div>
            <p>{round.who}</p>
          </li>
        ))}
      </ol>

      <div className="rules-ladder">
        <div className="rules-ladder-head">
          <h3>The normal-round price ladder</h3>
          <p>Steps get bigger as the price climbs, so bidding stays quick at every level.</p>
        </div>
        <div className="rules-bands">
          {BANDS.map((band) => (
            <div key={band.from} className="rules-band">
              <span className="rules-band-step">+{band.step}</span>
              <span className="rules-band-range">
                {band.to ? `₹${band.from} → ₹${band.to}` : `Above ₹${band.from}`}
              </span>
            </div>
          ))}
        </div>
        <p className="rules-example-label">A bidding war, step by step</p>
        <div className="rules-example" aria-label={`Example bids: ${example.join(", ")} rupees`}>
          {example.map((bid) => (
            <span key={bid} className={bid === 100 || bid === 200 ? "is-turn" : undefined}>
              ₹{bid}
            </span>
          ))}
          <span className="rules-example-more" aria-hidden="true">…</span>
        </div>
      </div>

      <div className="rules-lot">
        <h3>How each player’s lot plays out</h3>
        <ol>
          {LOT_STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="rules-lot-no">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rules-facts">
        <div>
          <Wallet size={22} />
          <strong>₹2,000 per team</strong>
          <p>One purse for the whole auction. Whatever is left carries into every rapid round.</p>
        </div>
        <div>
          <TimerReset size={22} />
          <strong>Unsold isn’t out</strong>
          <p>Unsold players come back in the next rapid round, at a lower opening price.</p>
        </div>
        <div>
          <Shuffle size={22} />
          <strong>Final allocation · ₹0</strong>
          <p>Anyone unsold after Rapid fire 3 is shared out at random, one per team in turn, so squads stay even.</p>
        </div>
        <div>
          <Gavel size={22} />
          <strong>The hammer is final</strong>
          <p>Bids can be cleared before the sale. Once a player is sold, they belong to that team.</p>
        </div>
      </div>
    </section>
  );
}
