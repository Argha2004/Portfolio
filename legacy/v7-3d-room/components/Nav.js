"use client";
import { usePathname } from "next/navigation";
import { profile } from "@/lib/data";
import { TLink } from "./Transition";

// Corner navigation for inner pages (the home page renders its own corners over the 3D room).
export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <header className="corners">
      <TLink href="/" title="Home" className="corner tl">Arghadeep Pakhira</TLink>
      <TLink href="/" title="Home" className="corner tr">Close</TLink>
      <TLink href={pathname === "/about" ? "/" : "/about"} title={pathname === "/about" ? "Home" : "Profile"} className="corner bl">
        {pathname === "/about" ? "Featured" : "Profile"}
      </TLink>
      <a className="corner br" href={`mailto:${profile.email}`}>Contact</a>
    </header>
  );
}
