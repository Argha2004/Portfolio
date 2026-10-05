"use client";
import { usePathname } from "next/navigation";
import { profile } from "@/lib/data";
import { TLink } from "./Transition";

// Corner navigation for inner pages (the home page is the drivable world with its own HUD).
export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <header className="corners">
      <TLink href="/" title="Home" className="corner tl">Arghadeep Pakhira</TLink>
      <TLink href="/" title="Home" className="corner tr">Close</TLink>
      <TLink href="/" title="Drive" className="corner bl">← Back to the world</TLink>
      <a className="corner br" href={`mailto:${profile.email}`}>Contact</a>
    </header>
  );
}
