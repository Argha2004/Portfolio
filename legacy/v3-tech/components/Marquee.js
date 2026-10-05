"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const words = ["Deep Learning", "Edge AI", "LLM Agents", "Medical Imaging", "On-Device AI", "Android", "Computer Vision", "MCP"];

// Mono ticker; scroll velocity briefly speeds it up
export default function Marquee() {
  const track = useRef();
  useEffect(() => {
    const tween = gsap.to(track.current, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
    let last = window.scrollY;
    const onScroll = () => {
      const v = Math.min(Math.abs(window.scrollY - last), 60);
      last = window.scrollY;
      gsap.to(tween, { timeScale: 1 + v / 6, duration: 0.2, overwrite: true, onComplete: () => gsap.to(tween, { timeScale: 1, duration: 1 }) });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { tween.kill(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const set = (k) => words.map((w) => <span key={k + w}>{w}<i>/</i></span>);
  return (
    <div className="ticker mono" aria-hidden="true">
      <div className="ticker-track" ref={track}>{set("a")}{set("b")}</div>
    </div>
  );
}
