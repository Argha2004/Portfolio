"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { projects, gradient } from "@/lib/projects";
import { TLink } from "./Transition";

const HoverPreview = dynamic(() => import("./HoverPreview"), { ssr: false });
const hover = (i) => window.dispatchEvent(new CustomEvent("project-hover", { detail: i }));

export default function Work() {
  const root = useRef();
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".work-head h2", { yPercent: 40, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".work-head", start: "top 85%" } });
      gsap.utils.toArray(".proj-item").forEach((el) =>
        gsap.from(el, { yPercent: 60, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } })
      );
    }, root);
    return () => { ctx.revert(); hover(-1); };
  }, []);

  return (
    <section id="work" className="work" ref={root}>
      <HoverPreview />
      <div className="work-head">
        <h2>Selected<br />Work</h2>
        <span className="label">(0{projects.length})</span>
      </div>
      <ul className="projs" onMouseLeave={() => hover(-1)}>
        {projects.map((p, i) => (
          <li key={p.slug} className="proj-item">
            <TLink href={`/work/${p.slug}`} title={p.name} className="proj" data-cursor="View" onMouseEnter={() => hover(i)}>
              <span className="proj-num">0{i + 1}</span>
              <span className="proj-name">{p.name}</span>
              <span className="proj-tags">{p.tags}</span>
              <span className="proj-year">{p.category}</span>
              <span className="proj-thumb" style={{ background: gradient(p.colors) }} />
            </TLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
