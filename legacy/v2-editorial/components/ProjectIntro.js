"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Shared entrance + scroll reveals for detail pages (projects and about)
export default function ProjectIntro({ children }) {
  const root = useRef();
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".project-title span", { yPercent: 110, duration: 1.3, ease: "expo.out", delay: 0.5 });
      gsap.from(".project-subtitle, .project-index", { y: 20, opacity: 0, duration: 1, ease: "expo.out", delay: 0.65 });
      gsap.from(".project-meta > div", { y: 20, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out", delay: 0.7 });
      gsap.from(".project-hero", { clipPath: "inset(30% 10% 30% 10%)", duration: 1.6, ease: "expo.inOut", delay: 0.6 });
      gsap.utils.toArray(".project-block, .project-stats > div, .reveal-up").forEach((el) =>
        gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } })
      );
    }, root);
    return () => ctx.revert();
  }, []);
  return <div ref={root}>{children}</div>;
}
