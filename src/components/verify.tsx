import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

// Preserve the URL for links already sent before confirmation-only registration.
export function Verify() {
  return <div className="verify-page">
    <CheckCircle2 size={35} />
    <h1>No extra step needed.</h1>
    <p>If you’ve submitted the form, your BLITZ registration is complete. You don’t need to verify your email. Your confirmation email contains your submitted details.</p>
    <Link className="button" href="/teams">Meet the teams</Link>
  </div>;
}
