"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const words = ["Deep Learning", "Edge AI", "LLM Agents", "Medical Imaging", "On-Device AI", "Android"];

export default function Marquee() {
  const track = useRef();
  useEffect(() => {
    const tween = gsap.to(track.current, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
    // Speed up briefly based on scroll velocity
    let last = window.scrollY;
    const onScroll = () => {
      const v = Math.min(Math.abs(window.scrollY - last), 60);
      last = window.scrollY;
      gsap.to(tween, { timeScale: 1 + v / 8, duration: 0.2, overwrite: true, onComplete: () => gsap.to(tween, { timeScale: 1, duration: 1 }) });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { tween.kill(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const set = words.flatMap((w) => [<span key={w}>{w}</span>, <i key={w + "*"}>✺</i>]);
  return (
    <div className="marquee">
      <div className="marquee-track" ref={track}>{set}{set.map((el, i) => ({ ...el, key: "b" + i }))}</div>
    </div>
  );
}
