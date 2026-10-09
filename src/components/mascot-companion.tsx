"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Minus, Sparkles } from "lucide-react";
import { Bolt } from "./icons";
import { Mascot } from "./mascot";
import { useMascot } from "./mascot-provider";
import { reactMascot } from "@/lib/mascot-behavior";

export function MascotCompanion() {
  const path = usePathname();
  const { reaction, enabled, showTrick } = useMascot();
  const [collapsed, setCollapsed] = useState(false);
  const [inlineVisible, setInlineVisible] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setInlineVisible(false);
      return;
    }
    const tracked = new Map<Element, boolean>();
    const update = () => setInlineVisible([...tracked.values()].some(Boolean));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) =>
          tracked.set(
            entry.target,
            entry.isIntersecting && entry.intersectionRatio >= 0.35,
          ),
        );
        update();
      },
      { threshold: [0, 0.35] },
    );
    const discover = () => {
      for (const node of tracked.keys())
        if (!node.isConnected) {
          observer.unobserve(node);
          tracked.delete(node);
        }
      document.querySelectorAll("[data-mascot-inline]").forEach((node) => {
        if (!tracked.has(node)) {
          tracked.set(node, false);
          observer.observe(node);
        }
      });
      update();
    };
    discover();
    const mutation = new MutationObserver(discover);
    const main = document.getElementById("main");
    if (main) mutation.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [path, enabled]);
  if (!enabled) return null;
  const formPage = path === "/register" || path === "/admin";
  return (
    <aside
      className={`bolt-companion ${formPage ? "bolt-companion-left" : ""} ${collapsed ? "is-collapsed" : ""}`}
      aria-label="Bolt, your BLITZ companion"
      hidden={inlineVisible}
    >
      {collapsed ? (
        <button
          className="bolt-restore"
          aria-label="Bring Bolt back"
          onClick={() => {
            setCollapsed(false);
            reactMascot(
              { action: "wave", message: "Back on your team." },
              2400,
            );
          }}
        >
          <Bolt />
        </button>
      ) : (
        <>
          <div className="bolt-speech">
            <span>Bolt · Your little speedster</span>
            <p role="status">{reaction.message}</p>
            <button
              className="bolt-minimise"
              aria-label="Minimise Bolt"
              onClick={() => setCollapsed(true)}
            >
              <Minus size={16} />
            </button>
          </div>
          <Mascot inline={false} className="companion-mascot" />
          <div className="bolt-controls">
            <button aria-label="Show a trick" onClick={showTrick}>
              <Sparkles size={15} /> Show a trick
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
