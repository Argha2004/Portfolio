"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { pillars } from "@/lib/data";
import { TLink } from "./Transition";

// Home-page teaser; the full story lives on /about. *word* renders as serif italic.
const text = "I build *deep learning*, *Edge AI* and *LLM-powered* systems — from training CNNs on 100K+ medical images to running quantized models *offline* on a phone.";

const stats = [["1", "IEEE publication"], ["0.832", "best macro-AUC"], ["112K", "X-rays trained on"], ["18", "MCP tools shipped"]];

export default function About() {
  const root = useRef();
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".about-text .w", { opacity: 0.12 }, { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: ".about-text", start: "top 80%", end: "bottom 45%", scrub: true } });
      gsap.from(".about-stats > div, .pillar-row", { y: 30, opacity: 0, stagger: 0.07, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".about-stats", start: "top 85%" } });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="about" className="about" ref={root}>
      <header className="sec-head">
        <span className="sec-num mono">[03]</span>
        <h2>About <em>me</em></h2>
      </header>

      <p className="about-text">
        {text.split(" ").map((w, i) => {
          const hl = w.startsWith("*") || w.endsWith("*") || w.endsWith("*,");
          const clean = w.replace(/\*/g, "");
          return <span className="w" key={i}>{hl ? <em>{clean}</em> : clean} </span>;
        })}
      </p>

      <div className="about-stats">
        {stats.map(([n, l]) => <div key={l}><strong>{n}</strong><span className="mono">{l}</span></div>)}
      </div>

      <div className="pillar-list">
        {pillars.map((p, i) => (
          <div className="pillar-row" key={p.title}>
            <span className="mono">0{i + 1}</span>
            <h3>{p.title}</h3>
            <p className="mono">{p.items}</p>
          </div>
        ))}
      </div>

      <TLink href="/about" title="About" className="btn" data-cursor="Read">Full profile <i>→</i></TLink>
    </section>
  );
}
