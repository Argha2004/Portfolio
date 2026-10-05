"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { pillars } from "@/lib/data";
import { TLink } from "./Transition";

// Home-page teaser; the full story lives on /about
const text = "I build *deep learning*, *Edge AI* and *LLM-powered* systems — from training CNNs on 100K+ medical images to running quantized models offline on a phone.";

export default function About() {
  const root = useRef();
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".about-text .w", { opacity: 0.15 }, { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: ".about-text", start: "top 80%", end: "bottom 45%", scrub: true } });
      gsap.from(".stack div", { y: 20, opacity: 0, stagger: 0.06, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: ".stack", start: "top 85%" } });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="about" className="about" ref={root}>
      <span className="label">About</span>
      <p className="about-text">
        {text.split(" ").map((w, i) => {
          const hl = w.startsWith("*") || w.endsWith("*");
          const clean = w.replace(/\*/g, "");
          return <span className="w" key={i}>{hl ? <em>{clean}</em> : clean}&nbsp;</span>;
        })}
      </p>
      <div className="stack">
        {pillars.map((p) => <div key={p.title}><b>{p.title}</b>{p.items}</div>)}
      </div>
      <TLink href="/about" title="About" className="about-more" data-cursor="Read">More about me →</TLink>
    </section>
  );
}
