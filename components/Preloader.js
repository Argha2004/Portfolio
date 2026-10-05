"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Black screen with a thin progress bar in the centre, then it fades into the room.
export default function Preloader() {
  const root = useRef();

  useEffect(() => {
    const done = () => {
      window.__preloaded = true;
      window.__lenis?.start();
      window.dispatchEvent(new Event("preloader-done"));
    };
    const ctx = gsap.context(() => {
      gsap.timeline({ onComplete: done })
        .to(".pl-bar i", { scaleX: 1, duration: 1.8, ease: "power2.inOut" })
        .to(".pl-bar", { scaleX: 0, transformOrigin: "right", duration: 0.5, ease: "power2.in" })
        .to(root.current, { opacity: 0, duration: 0.8, ease: "power2.out" })
        .set(root.current, { display: "none" });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="preloader" ref={root}>
      <span className="pl-bar"><i /></span>
    </div>
  );
}
