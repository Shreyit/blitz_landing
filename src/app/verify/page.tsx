import { Suspense } from "react";
import { Verify } from "@/components/verify";
export default function VerifyPage() {
  return (
    <Suspense
      fallback={<div className="verify-page">Preparing verification…</div>}
    >
      <Verify />
    </Suspense>
  );
}
