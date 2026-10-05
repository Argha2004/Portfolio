"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects, gradient } from "@/lib/projects";
import { TLink } from "../Transition";
import SplitText from "../fx/SplitText";
import Tilt from "../fx/Tilt";

const N = projects.length;
const STEP = 360 / N;

// Projects sit on a 3D cylinder. Scrolling (while the section is pinned) turns the cylinder
// so each card swings to the front in turn.
export default function Work() {
  const root = useRef();
  const ring = useRef();
  const counter = useRef();
  const nameEl = useRef();

  useEffect(() => {
    const items = [...ring.current.querySelectorAll(".ring-item")];
    const setRadius = () => {
      const w = items[0].offsetWidth;
      ring.current.style.setProperty("--r", `${Math.round((w / 2 / Math.tan(Math.PI / N)) * 1.22)}px`);
    };
    // Fade/blur cards by how far they face away from the viewer
    const paint = (rot) => {
      let best = 0, bestCos = -2;
      items.forEach((el, i) => {
        const c = Math.cos(((i * STEP + rot) * Math.PI) / 180);
        el.style.opacity = (0.08 + Math.max(0, c) * 0.92).toFixed(2);
        el.style.filter = `blur(${((1 - Math.max(0, c)) * 4).toFixed(1)}px)`;
        el.style.pointerEvents = c > 0.8 ? "auto" : "none";
        if (c > bestCos) { bestCos = c; best = i; }
      });
      counter.current.textContent = `0${best + 1} / 0${N}`;
      nameEl.current.textContent = projects[best].name;
    };
    setRadius();
    paint(0);

    const mm = gsap.matchMedia();
    mm.add("(min-width: 761px)", () => {
      const state = { rot: 0 };
      gsap.to(state, {
        rot: -STEP * (N - 1),
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${innerHeight * (N - 0.4)}`, pin: true, scrub: 1, invalidateOnRefresh: true },
        onUpdate: () => { ring.current.style.setProperty("--rot", `${state.rot}deg`); paint(state.rot); },
      });
      // Idle sway so the ring feels alive even before scrolling
      const sway = gsap.to(ring.current, { "--tilt": "6deg", duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut" });
      return () => sway.kill();
    });
    // Re-measure whenever the card size actually changes (stylesheet load, resize, font swap)
    const ro = new ResizeObserver(() => { setRadius(); ScrollTrigger.refresh(); });
    ro.observe(items[0]);
    return () => { mm.revert(); ro.disconnect(); };
  }, []);

  return (
    <section id="work" className="work" data-blob="work" ref={root}>
      <header className="work-head">
        <span className="eyebrow">(02) — Selected work</span>
        <SplitText as="h2" text="Things I've built" className="h-xl" />
      </header>

      <div className="ring-stage">
        <div className="ring" ref={ring}>
          {projects.map((p, i) => (
            <div className="ring-item" key={p.slug} style={{ "--a": `${i * STEP}deg` }}>
              <Tilt className="pcard-tilt">
                <TLink href={`/work/${p.slug}`} title={p.name} className="pcard" data-cursor="Open">
                  <span className="pcard-art" style={{ background: gradient(p.colors) }}>
                    <span className="pcard-num">0{i + 1}</span>
                  </span>
                  <span className="pcard-body">
                    <span className="pcard-cat">{p.category}</span>
                    <span className="pcard-name">{p.name}</span>
                    <span className="pcard-sub">{p.subtitle}</span>
                    <span className="pcard-stat"><b>{p.stats[0][0]}</b> {p.stats[0][1]}</span>
                  </span>
                </TLink>
              </Tilt>
            </div>
          ))}
        </div>
      </div>

      <footer className="work-foot">
        <span className="work-counter" ref={counter}>01 / 0{N}</span>
        <span className="work-name" ref={nameEl}>{projects[0].name}</span>
        <span className="work-hint">Scroll to rotate ↻</span>
      </footer>
    </section>
  );
}
