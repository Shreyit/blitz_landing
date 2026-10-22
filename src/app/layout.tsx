import type { Metadata, Viewport } from "next";
import { Header, Footer } from "@/components/shell";
import { Motion } from "@/components/motion";
import { MascotProvider } from "@/components/mascot-provider";
import { MascotCompanion } from "@/components/mascot-companion";
import "./globals.css";
import "./auction-dome.css";
import "./mascot.css";
import "./mobile.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const metadata: Metadata = {
  title: { default: "Bachelor’s BLITZ — Your campus. Your game.", template: "%s | Bachelor’s BLITZ" },
  description:
    "The campus sports event hosted by BSASS at TISS Mumbai. Register, meet your team, and step into the Auction Dome.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <MascotProvider>
          <Header />
          <Motion />
          <main id="main">{children}</main>
          <Footer />
          <MascotCompanion />
        </MascotProvider>
      </body>
    </html>
  );
}
