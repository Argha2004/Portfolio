"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects, gradient } from "@/lib/projects";
import { TLink } from "../Transition";

// Black section that pins and scrolls sideways: one large panel per project.
export default function Work() {
  const root = useRef();
  const track = useRef();

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 861px)", () => {
      const distance = () => track.current.scrollWidth - innerWidth;
      const tween = gsap.to(track.current, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: root.current, start: "top top", end: () => `+=${distance()}`,
          pin: true, scrub: 0.8, invalidateOnRefresh: true,
          onUpdate: (s) => gsap.set(".work-bar i", { scaleX: s.progress }),
        },
      });
      // Poster art drifts inside its frame for parallax
      gsap.utils.toArray(".panel-art-inner").forEach((el) =>
        gsap.fromTo(el, { xPercent: -10 }, { xPercent: 10, ease: "none", scrollTrigger: { trigger: el, containerAnimation: tween, start: "left right", end: "right left", scrub: true } })
      );
    });
    const ro = new ResizeObserver(() => ScrollTrigger.refresh());
    ro.observe(track.current);
    return () => { mm.revert(); ro.disconnect(); };
  }, []);

  return (
    <section id="work" className="work" data-nav="light" ref={root}>
      <div className="work-track" ref={track}>
        <div className="work-intro">
          <span className="label">(02) Selected work</span>
          <h2 className="display">Work</h2>
          <p>Five systems — from on-device vision to LLM agents. Scroll to move through them.</p>
        </div>
        {projects.map((p, i) => (
          <TLink key={p.slug} href={`/work/${p.slug}`} title={p.name} className="panel" data-cursor="View">
            <div className="panel-art">
              <div className="panel-art-inner" style={{ background: gradient(p.colors) }} />
              <span className="panel-index">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="panel-meta">
              <h3>{p.name}</h3>
              <span>{p.category}</span>
            </div>
            <p className="panel-sub">{p.subtitle}</p>
          </TLink>
        ))}
      </div>
      <div className="work-bar"><i /></div>
    </section>
  );
}
