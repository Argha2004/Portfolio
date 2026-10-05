"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { profile } from "@/lib/data";
import Clock from "./Clock";

const Particles = dynamic(() => import("./Particles"), { ssr: false });

export default function Hero() {
  const root = useRef();
  useEffect(() => {
    let intro;
    const ctx = gsap.context(() => {
      // Intro waits for the preloader on first load; plays right away after client navigation
      intro = gsap.timeline({ paused: !window.__preloaded })
        .from(".hero-canvas", { opacity: 0, scale: 0.85, duration: 2.2, ease: "expo.out" }, 0)
        .from(".hero-title .hl > span", { yPercent: 105, duration: 1.4, ease: "expo.out", stagger: 0.12 }, 0.1)
        .from(".hero-meta > *, .hero-foot > *", { y: 16, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.05 }, 0.5);
      gsap.to(".hero-title", { yPercent: 30, opacity: 0.2, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero-canvas", { yPercent: 18, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
    }, root);
    const play = () => intro.play();
    window.addEventListener("preloader-done", play);
    return () => { window.removeEventListener("preloader-done", play); ctx.revert(); };
  }, []);

  return (
    <section id="top" className="hero" ref={root}>
      <div className="hero-canvas"><Particles /></div>

      <div className="hero-meta mono">
        <span>[ Portfolio ©2026 ]</span>
        <span>{profile.role}</span>
        <span>22.3° N, 87.9° E</span>
        <Clock />
      </div>

      <h1 className="hero-title">
        <span className="hl"><span>Arghadeep</span></span>
        <span className="hl"><span><em>Pakhira</em></span></span>
      </h1>

      <div className="hero-foot">
        <p>{profile.tagline}</p>
        <ul className="hero-focus mono">{profile.focus.map((f) => <li key={f}>{f}</li>)}</ul>
        <span className="scroll-cue mono">Scroll <i>↓</i></span>
      </div>
    </section>
  );
}
