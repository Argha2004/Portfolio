"use client";
import { usePathname } from "next/navigation";
import { TLink } from "./Transition";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  const home = usePathname() === "/";
  // Section anchors only work on the home page; elsewhere transition back first
  const to = (hash) => (home ? hash : "/" + hash);
  return (
    <header className="nav">
      <TLink href={home ? "#top" : "/"} title="Home" className="logo">AP—</TLink>
      <span className="status"><span className="dot" />Available for work</span>
      <nav>
        <TLink href={to("#work")} title="Work">Work</TLink>
        <TLink href="/about" title="About">About</TLink>
        <TLink href={to("#contact")} title="Contact">Contact</TLink>
        <ThemeToggle />
      </nav>
    </header>
  );
}
