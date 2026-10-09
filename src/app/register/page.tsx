import { Suspense } from "react";
import { Registration } from "@/components/registration";
export const metadata = { title: "Registration" };
export default function RegisterPage() {
  return (
    <div className="page-width">
      <Suspense
        fallback={
          <div className="page-intro">
            <h1>A place for your game.</h1>
          </div>
        }
      >
        <Registration />
      </Suspense>
    </div>
  );
}
