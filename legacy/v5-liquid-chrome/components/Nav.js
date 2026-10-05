"use client";
import { usePathname } from "next/navigation";
import { TLink } from "./Transition";
import ThemeToggle from "./ThemeToggle";

// Floating glass pill navigation
export default function Nav() {
  const home = usePathname() === "/";
  const to = (hash) => (home ? hash : "/" + hash);
  return (
    <header className="nav">
      <TLink href={home ? "#top" : "/"} title="Home" className="nav-logo" data-cursor="Home">AP<span>.</span></TLink>
      <nav className="nav-pill">
        <TLink href={to("#work")} title="Work">Work</TLink>
        <TLink href="/about" title="About">About</TLink>
        <TLink href={to("#contact")} title="Contact">Contact</TLink>
        <ThemeToggle />
      </nav>
    </header>
  );
}
