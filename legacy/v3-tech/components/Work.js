"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects, gradient } from "@/lib/projects";
import { socials } from "@/lib/data";
import { TLink } from "./Transition";

const github = socials.find((s) => s.label === "GitHub")?.href;

export default function Work() {
  const root = useRef();
  const track = useRef();

  useEffect(() => {
    const mm = gsap.matchMedia(root);
    // Desktop: pin the section and translate the track sideways as you scroll down
    mm.add("(min-width: 761px)", () => {
      const distance = () => track.current.scrollWidth - window.innerWidth;
      const tween = gsap.to(track.current, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: ".work-pin",
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(".work-progress i", { scaleX: self.progress }),
        },
      });
      // Cards drift in their own lane for a little parallax
      gsap.utils.toArray(".card-visual-inner").forEach((el) =>
        gsap.fromTo(el, { xPercent: -8 }, { xPercent: 8, ease: "none", scrollTrigger: { trigger: el, containerAnimation: tween, start: "left right", end: "right left", scrub: true } })
      );
    });
    mm.add("(max-width: 760px)", () => {
      gsap.utils.toArray(".card").forEach((el) =>
        gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } })
      );
    });
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    return () => mm.revert();
  }, []);

  return (
    <section id="work" className="work" ref={root}>
      <div className="work-pin">
        <header className="sec-head">
          <span className="sec-num mono">[02]</span>
          <h2>Selected <em>work</em></h2>
          <span className="mono sec-aside">0{projects.length} projects — scroll →</span>
        </header>

        <div className="work-track" ref={track}>
          {projects.map((p, i) => (
            <TLink key={p.slug} href={`/work/${p.slug}`} title={p.name} className="card" data-cursor="View">
              <div className="card-top mono"><span>{String(i + 1).padStart(2, "0")}</span><span>{p.category}</span></div>
              <div className="card-visual">
                <div className="card-visual-inner" style={{ background: gradient(p.colors) }} />
                <span className="card-stat"><strong>{p.stats[0][0]}</strong><span className="mono">{p.stats[0][1]}</span></span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.subtitle}</p>
              <span className="card-tags mono">{p.tags}</span>
            </TLink>
          ))}
          <a className="card card-end" href={github} target="_blank" rel="noreferrer" data-cursor="GitHub">
            <span className="mono">More on GitHub</span>
            <strong>Argha2004 <em>↗</em></strong>
          </a>
        </div>

        <div className="work-progress"><i /></div>
      </div>
    </section>
  );
}
