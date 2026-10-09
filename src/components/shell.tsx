"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Bolt } from "./icons";
export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const links = [
    { href: "/about", label: "The spirit" },
    { href: "/rules", label: "Rules & formats" },
    { href: "/register", label: "Registration" },
    { href: "/auction", label: "Auction Dome" },
    { href: "/teams", label: "The teams" },
  ];
  return (
    <header className="site-header" ref={header}>
      <div className="nav-wrap">
        <Link className="brand" href="/" aria-label="Bachelor’s BLITZ home" onClick={() => setOpen(false)}>
          <Bolt />
          <span>
            <small>Bachelor’s</small>
            BLITZ<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={open ? "main-nav is-open" : "main-nav"}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={path === link.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/register" className="button button-small nav-cta" onClick={() => setOpen(false)}>
          Get in the game <ArrowUpRight size={16} />
        </Link>
        <button
          ref={menu}
          type="button"
          className="menu-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link className="brand" href="/">
          <Bolt />
          <span><small>Bachelor’s</small>BLITZ.</span>
        </Link>
        <p>
          Made for the campus.
          <br />
          Remembered beyond the scoreboard.
        </p>
        <Link href="/register" className="text-link">
          Find your place <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>Hosted by BSASS · TISS Mumbai</span>
        <span>Play hard. Play fair. Leave a little lighter.</span>
        <Link href="/admin">Organiser access</Link>
      </div>
    </footer>
  );
}
