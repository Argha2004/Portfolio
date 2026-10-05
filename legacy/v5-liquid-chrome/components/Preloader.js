"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Liquid-fill preloader: the monogram fills from the bottom like a rising liquid while the
// counter runs, then the two halves of the screen part to reveal the site.
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
        .to(n, {
          v: 100, duration: 2.2, ease: "power2.inOut",
          onUpdate: () => {
            count.current.textContent = `${Math.round(n.v)}%`;
            root.current.style.setProperty("--fill", `${n.v}%`);
          },
        })
        .to(".pl-mark, .pl-count", { scale: 1.15, opacity: 0, duration: 0.5, ease: "power2.in" }, "+=0.1")
        .to(".pl-half-a", { yPercent: -100, duration: 1, ease: "expo.inOut" }, "-=0.15")
        .to(".pl-half-b", { yPercent: 100, duration: 1, ease: "expo.inOut" }, "<")
        .set(root.current, { display: "none" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="preloader" ref={root}>
      <span className="pl-half pl-half-a" />
      <span className="pl-half pl-half-b" />
      <div className="pl-center">
        <span className="pl-mark" data-text="AP">AP</span>
        <span className="pl-count" ref={count}>0%</span>
      </div>
    </div>
  );
}
