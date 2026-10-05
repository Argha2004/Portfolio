"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TLink } from "./Transition";
import ThemeToggle from "./ThemeToggle";

// Three-part top bar: name · round logo mark · links.
// Text is cream over liquid/black sections (data-nav="light") and ink over cream ones.
export default function Nav() {
  const pathname = usePathname();
  const home = pathname === "/";
  const to = (hash) => (home ? hash : "/" + hash);
  const [light, setLight] = useState(true);

  useEffect(() => {
    const update = () => {
      if (document.documentElement.dataset.theme === "dark") return setLight(true);
      const y = 40;
      const under = [...document.querySelectorAll("main > section, main > a, main > div")].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= y && r.bottom > y;
      });
      // Pinned sections are wrapped in a GSAP pin-spacer; look at the section inside it
      const el = under?.classList.contains("pin-spacer") ? under.firstElementChild : under;
      setLight(!el || el.dataset.nav === "light");
    };
    update();
    addEventListener("scroll", update, { passive: true });
    window.addEventListener("themechange", update);
    const id = setInterval(update, 300); // catches pinned sections and route changes
    return () => { removeEventListener("scroll", update); window.removeEventListener("themechange", update); clearInterval(id); };
  }, [pathname]);

  return (
    <header className={`nav ${light ? "nav-light" : "nav-dark"}`}>
      <TLink href={home ? "#top" : "/"} title="Home" className="nav-name">Arghadeep Pakhira</TLink>
      <TLink href={home ? "#top" : "/"} title="Home" className="nav-mark" aria-label="Home">AP</TLink>
      <nav className="nav-links">
        <TLink href={to("#work")} title="Work">Work</TLink>
        <TLink href="/about" title="About">About</TLink>
        <TLink href={to("#contact")} title="Contact">Contact</TLink>
        <ThemeToggle />
      </nav>
    </header>
  );
}
