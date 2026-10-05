"use client";
import { usePathname } from "next/navigation";
import { TLink } from "./Transition";
import ThemeToggle from "./ThemeToggle";

// Running header, like the top of a journal page.
export default function Nav() {
  const home = usePathname() === "/";
  const to = (hash) => (home ? hash : "/" + hash);
  return (
    <header className="nav">
      <TLink href={home ? "#top" : "/"} title="Portfolio" className="nav-left">A. Pakhira · <i>Learning at the Edge</i></TLink>
      <nav>
        <TLink href={to("#sec-work")} title="Selected Work">§ Work</TLink>
        <TLink href="/about" title="About the Author">§ Author</TLink>
        <TLink href={to("#sec-contact")} title="Correspondence">§ Contact</TLink>
        <ThemeToggle />
      </nav>
    </header>
  );
}
