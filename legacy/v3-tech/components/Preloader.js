"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const log = [
  "initializing runtime",
  "loading weights → efficientnetv2_s.onnx",
  "quantizing → INT8",
  "compiling shaders",
  "connecting edge nodes",
  "model ready",
];

// "Boot log" preloader, shown once per full page load (it lives in the root layout).
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
      const tl = gsap.timeline({ onComplete: done });
      tl.to(n, {
        v: 100, duration: 2.4, ease: "power2.inOut",
        onUpdate: () => { count.current.textContent = String(Math.round(n.v)).padStart(3, "0"); },
      }, 0)
        .to(".pl-bar i", { scaleX: 1, duration: 2.4, ease: "power2.inOut" }, 0)
        .from(".pl-log li", { opacity: 0, x: -10, duration: 0.25, stagger: 0.36, ease: "power2.out" }, 0.1)
        .from(".pl-log li b", { opacity: 0, duration: 0.1, stagger: 0.36 }, 0.35)
        .to(".pl-inner", { opacity: 0, y: -20, duration: 0.5, ease: "power2.in" }, "+=0.15")
        .to(root.current, { clipPath: "inset(0 0 100% 0)", duration: 1, ease: "expo.inOut" }, "-=0.2")
        .set(root.current, { display: "none" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="preloader mono" ref={root}>
      <div className="pl-inner">
        <div className="pl-top"><span>Arghadeep Pakhira</span><span>Portfolio ©2026</span></div>
        <ul className="pl-log">
          {log.map((l, i) => <li key={l}><span>{String(i).padStart(2, "0")}</span> &gt; {l} <b>{i === log.length - 1 ? "✓" : "ok"}</b></li>)}
        </ul>
        <div className="pl-bottom">
          <div className="pl-bar"><i /></div>
          <span className="pl-count" ref={count}>000</span>
        </div>
      </div>
    </div>
  );
}
