"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const log = [
  "$ pdflatex portfolio.tex",
  "(./sections/introduction.tex)",
  "(./figures/neural-network.tikz)",
  "(./sections/selected-work.tex [2] [3] [4])",
  "(./references.bib)",
  "Output written on portfolio.pdf.",
];

// "Compiling the paper" preloader, shown once per full page load (it lives in the root layout).
export default function Preloader() {
  const root = useRef();
  const pass = useRef();

  useEffect(() => {
    const done = () => {
      window.__preloaded = true;
      window.__lenis?.start();
      window.dispatchEvent(new Event("preloader-done"));
    };
    const n = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.timeline({ onComplete: done })
        .from(".pl-log li", { opacity: 0, duration: 0.01, stagger: 0.28 }, 0)
        .to(n, { v: 100, duration: 1.8, ease: "power1.inOut", onUpdate: () => { pass.current.textContent = `${Math.round(n.v)}%`; } }, 0)
        .to(".pl-bar i", { scaleX: 1, duration: 1.8, ease: "power1.inOut" }, 0)
        .to(root.current, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "+=0.25")
        .set(root.current, { display: "none" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="preloader" ref={root}>
      <div className="pl-inner">
        <ul className="pl-log">{log.map((l) => <li key={l}>{l}</li>)}</ul>
        <div className="pl-bar"><i /></div>
        <span className="pl-pass" ref={pass}>0%</span>
      </div>
    </div>
  );
}
