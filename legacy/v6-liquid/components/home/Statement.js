"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const text = "I'm Arghadeep — I train deep-learning models and ship them where they're needed: on a Raspberry Pi at the roadside, inside an Android phone in a clinic, and behind an LLM agent in your terminal.";

// Cream section; words go from faint to solid as you scroll through it.
export default function Statement() {
  const root = useRef();
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".st-w", { opacity: 0.14 }, {
        opacity: 1, stagger: 0.06, ease: "none",
        scrollTrigger: { trigger: ".st-text", start: "top 78%", end: "bottom 50%", scrub: true },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section className="statement" ref={root}>
      <span className="label">(01) Intro</span>
      <p className="st-text">
        {text.split(" ").map((w, i) => <span className="st-w" key={i}>{w} </span>)}
      </p>
    </section>
  );
}
