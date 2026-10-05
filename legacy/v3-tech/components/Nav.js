"use client";
import { usePathname } from "next/navigation";
import { TLink } from "./Transition";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  const home = usePathname() === "/";
  // Section anchors only work on the home page; elsewhere transition back first
  const to = (hash) => (home ? hash : "/" + hash);
  return (
    <header className="nav mono">
      <TLink href={home ? "#top" : "/"} title="Home" className="logo">Arghadeep Pakhira<sup>©26</sup></TLink>
      <span className="status"><span className="dot" />Open to internships</span>
      <nav>
        <TLink href={to("#work")} title="Work">[ Work ]</TLink>
        <TLink href="/about" title="About">[ About ]</TLink>
        <TLink href={to("#contact")} title="Contact">[ Contact ]</TLink>
        <ThemeToggle />
      </nav>
    </header>
  );
}
