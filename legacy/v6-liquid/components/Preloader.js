"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Black screen with a small centred percentage; at 100% the AP mark appears and the page
// opens out of it through an expanding circular hole in the black.
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
    const hole = { r: 0 };
    const setHole = () => root.current.style.setProperty("--hole", `${hole.r}vmax`);
    const ctx = gsap.context(() => {
      gsap.timeline({ onComplete: done })
        .to(n, { v: 100, duration: 2, ease: "power2.inOut", onUpdate: () => { count.current.textContent = `${Math.round(n.v)}%`; } })
        .to(".pl-count", { opacity: 0, y: -8, duration: 0.3 })
        .fromTo(".pl-mark", { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.8, ease: "back.out(1.6)" }, "-=0.1")
        .to(hole, { r: 3.2, duration: 0.5, ease: "power2.out", onUpdate: setHole }, "+=0.15")
        .to(".pl-mark", { scale: 0.6, opacity: 0, duration: 0.5, ease: "power2.in" }, "<0.2")
        .to(hole, { r: 120, duration: 1.2, ease: "expo.in", onUpdate: setHole }, "-=0.2")
        .set(root.current, { display: "none" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="preloader" ref={root}>
      <span className="pl-count" ref={count}>0%</span>
      <span className="pl-mark">AP</span>
    </div>
  );
}
