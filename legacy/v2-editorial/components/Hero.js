"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { profile } from "@/lib/data";

const Blob = dynamic(() => import("./Blob"), { ssr: false });

export default function Hero() {
  const root = useRef();
  useEffect(() => {
    let intro;
    const ctx = gsap.context(() => {
      // Intro waits for the preloader on first load; plays right away after client navigation
      intro = gsap.timeline({ paused: !window.__preloaded })
        .from(".hero-title .row > span", { yPercent: 110, duration: 1.5, ease: "expo.out", stagger: 0.1 }, 0.15)
        .from(".hero-foot > *", { y: 30, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.1 }, 0.6)
        .from(".hero-canvas", { scale: 0.6, opacity: 0, duration: 1.8, ease: "expo.out" }, 0);
      gsap.to(".hero-title", { yPercent: 25, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
    }, root);
    const play = () => intro.play();
    window.addEventListener("preloader-done", play);
    return () => { window.removeEventListener("preloader-done", play); ctx.revert(); };
  }, []);

  return (
    <section id="top" className="hero" ref={root}>
      <div className="hero-canvas"><Blob /></div>
      <h1 className="hero-title">
        <span className="row"><span>Arghadeep</span></span>
        <span className="row"><span>Pakhira</span></span>
      </h1>
      <div className="hero-foot">
        <p>{profile.tagline}</p>
        <span className="label">{profile.role} — West Bengal, India ↓</span>
      </div>
    </section>
  );
}
