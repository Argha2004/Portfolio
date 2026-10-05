"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Glass ring that trails the pointer and grows over links. data-cursor="Label" shows text inside.
export default function Cursor() {
  const dot = useRef();
  const ring = useRef();
  const label = useRef();

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    document.documentElement.classList.add("has-cursor");
    const dx = gsap.quickTo(dot.current, "x", { duration: 0.06, ease: "power3" });
    const dy = gsap.quickTo(dot.current, "y", { duration: 0.06, ease: "power3" });
    const rx = gsap.quickTo(ring.current, "x", { duration: 0.5, ease: "power3" });
    const ry = gsap.quickTo(ring.current, "y", { duration: 0.5, ease: "power3" });
    let shown = false;
    const move = (e) => {
      if (!shown) { shown = true; gsap.to([dot.current, ring.current], { opacity: 1, duration: 0.3 }); }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      over(e); // re-check every move: 3D hover changes data-cursor without a new pointerover
    };
    const over = (e) => {
      const text = e.target.closest?.("[data-cursor]")?.dataset.cursor;
      const link = e.target.closest?.("a, button");
      ring.current.classList.toggle("is-label", !!text);
      ring.current.classList.toggle("is-link", !text && !!link);
      if (text) label.current.textContent = text;
    };
    const leave = () => { shown = false; gsap.to([dot.current, ring.current], { opacity: 0, duration: 0.3 }); };
    addEventListener("pointermove", move);
    document.addEventListener("pointerover", over);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.documentElement.classList.remove("has-cursor");
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <>
      <div className="cursor-ring" ref={ring}><span ref={label} /></div>
      <div className="cursor-dot" ref={dot} />
    </>
  );
}
