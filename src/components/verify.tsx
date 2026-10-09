"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { command } from "@/lib/api";
import { reactMascot } from "@/lib/mascot-behavior";
export function Verify() {
  const params = useSearchParams();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="verify-page">
      <h1>One last introduction.</h1>
      <p>
        Verify your institutional email to complete your BLITZ registration.
      </p>
      {done ? (
        <>
          <CheckCircle2 size={35} />
          <p>{status}</p>
          <Link className="button" href="/teams">
            Meet the teams
          </Link>
        </>
      ) : (
        <>
          <button
            className="button"
            disabled={busy || !params.get("token")}
            onClick={async () => {
              setBusy(true);
              reactMascot(
                { action: "think", message: "Checking your registration…" },
                15000,
                true,
              );
              try {
                const result = await command<{ message: string }>(
                  "/registrations/verify",
                  { token: params.get("token") },
                );
                setStatus(result.message);
                setDone(true);
                reactMascot(
                  {
                    action: "celebrate",
                    message: "Verified! Welcome to the BLITZ crew.",
                  },
                  6000,
                  true,
                );
              } catch (error) {
                setStatus((error as Error).message);
                reactMascot(
                  {
                    action: "encourage",
                    message:
                      "Check the verification message. We’ll get you there.",
                  },
                  3500,
                  true,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Verifying…" : "Verify my email"}
          </button>
          {status && (
            <p className="field-error" role="alert">
              {status}
            </p>
          )}
          {!params.get("token") && (
            <p className="field-error">
              Open the complete verification link from your email.
            </p>
          )}
        </>
      )}
    </div>
  );
}
