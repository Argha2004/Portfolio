"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Adds .in to .reveal elements as they enter the viewport. On the very first load it waits
// for the preloader to finish so the hero animates in front of the visitor, not behind the loader.
export default function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    let io;
    const start = () => {
      io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }), { rootMargin: "0px 0px -8% 0px" });
      document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    };
    if (window.__preloaded) start();
    else window.addEventListener("preloader-done", start, { once: true });
    return () => { io?.disconnect(); window.removeEventListener("preloader-done", start); };
  }, [pathname]);
  return null;
}
