"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";
gsap.registerPlugin(ScrollTrigger);
export function Motion() {
  const path = usePathname();
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      // Touch devices retain native scrolling, including keyboard and dialog scrolling.
      const lenis = window.matchMedia("(hover: hover) and (pointer: fine)").matches ? new Lenis({
        duration: 1.05,
        smoothWheel: true,
        anchors: true,
      }) : null;
      lenis?.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis?.raf(time * 1000);
      if (lenis) {
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      }
      const context = gsap.context(() => {
        gsap.fromTo(
          "[data-entrance]",
          { y: 35, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.09,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "all",
          },
        );
        document
          .querySelectorAll("[data-reveal]")
          .forEach((element) =>
            gsap.fromTo(
              element,
              { y: 24, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.65,
                clearProps: "all",
                scrollTrigger: {
                  trigger: element,
                  start: "top 91%",
                  once: true,
                },
              },
            ),
          );
        if (document.querySelector(".hero-orbit"))
          gsap.to(".hero-orbit", {
            rotation: 32,
            ease: "none",
            scrollTrigger: {
              trigger: ".hero",
              start: "top top",
              end: "bottom top",
              scrub: 1,
            },
          });
      });
      const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 300);
      return () => {
        clearTimeout(refresh);
        context.revert();
        gsap.ticker.remove(tick);
        lenis?.destroy();
      };
    });
    return () => media.revert();
  }, [path]);
  return null;
}
