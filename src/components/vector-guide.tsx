"use client";
import { useEffect, useRef, useState } from "react";
import { Bolt } from "./icons";
type RiveInstance = {
  cleanup: () => void;
  resizeDrawingSurfaceToCanvas: () => void;
  stateMachineInputs: (
    name: string,
  ) => { name: string; value: number | boolean }[];
};
type RiveRuntime = {
  Rive: new (options: Record<string, unknown>) => RiveInstance;
};
declare global {
  interface Window {
    rive?: RiveRuntime;
  }
}
let loader: Promise<RiveRuntime> | undefined;
function loadRuntime() {
  if (!loader)
    loader = new Promise((resolve, reject) => {
      if (window.rive) {
        resolve(window.rive);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@rive-app/canvas@2.31.2/rive.js";
      script.onload = () =>
        window.rive
          ? resolve(window.rive)
          : reject(new Error("Rive runtime unavailable"));
      script.onerror = () => {
        loader = undefined;
        reject(new Error("Rive runtime unavailable"));
      };
      document.head.appendChild(script);
    });
  return loader;
}
/** Rive requires an authored .riv asset; the local vector fallback stays useful without it. */
export function VectorGuide({ step = 0 }: { step?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<RiveInstance | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const [ready, setReady] = useState(false);
  const src = process.env.NEXT_PUBLIC_RIVE_SRC;
  const machine = process.env.NEXT_PUBLIC_RIVE_STATE_MACHINE || "Guide";
  useEffect(() => {
    if (!src || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    loadRuntime()
      .then((rive) => {
        if (cancelled || !canvas.current) return;
        runtime.current = new rive.Rive({
          src,
          canvas: canvas.current,
          stateMachines: machine,
          autoplay: true,
          onLoad: () => {
            runtime.current?.resizeDrawingSurfaceToCanvas();
            const input = runtime.current
              ?.stateMachineInputs(machine)
              .find((input) => input.name === "step");
            if (input) input.value = stepRef.current;
            setReady(true);
          },
          onLoadError: () => setReady(false),
        });
        observer = new ResizeObserver(() =>
          runtime.current?.resizeDrawingSurfaceToCanvas(),
        );
        observer.observe(canvas.current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      observer?.disconnect();
      runtime.current?.cleanup();
      runtime.current = null;
    };
  }, [src, machine]);
  useEffect(() => {
    const input = runtime.current
      ?.stateMachineInputs(machine)
      .find((input) => input.name === "step");
    if (input) input.value = step;
  }, [step, machine]);
  return (
    <span className="vector-guide" aria-hidden="true">
      <Bolt />
      {src && <canvas ref={canvas} style={{ opacity: ready ? 1 : 0 }} />}
    </span>
  );
}
