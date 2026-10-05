"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Shown once per full page load (it lives in the root layout, so client-side navigations skip it).
export default function Preloader() {
  const root = useRef();
  const count = useRef();

  useEffect(() => {
    const done = () => {
      window.__preloaded = true;
      window.__lenis?.start();
      window.dispatchEvent(new Event("preloader-done"));
    };
    const n = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.timeline({ onComplete: done })
        .from(".pl-name span", { yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.05 })
        .to(n, {
          v: 100, duration: 1.8, ease: "power2.inOut",
          onUpdate: () => { count.current.textContent = String(Math.round(n.v)).padStart(3, "0"); },
        }, 0)
        .to(".pl-bar i", { scaleX: 1, duration: 1.8, ease: "power2.inOut" }, 0)
        .to(".pl-name span, .pl-count", { yPercent: -110, duration: 0.6, ease: "expo.in", stagger: 0.02 })
        .to(root.current, { clipPath: "inset(0 0 100% 0)", duration: 1, ease: "expo.inOut" }, "-=0.1")
        .set(root.current, { display: "none" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="preloader" ref={root}>
      <div className="pl-name">{"Arghadeep Pakhira".split("").map((c, i) => <span key={i}>{c === " " ? " " : c}</span>)}</div>
      <div className="pl-foot">
        <span className="label">Portfolio ©2026</span>
        <span className="pl-count-wrap"><span className="pl-count" ref={count}>000</span></span>
      </div>
      <div className="pl-bar"><i /></div>
    </div>
  );
}
