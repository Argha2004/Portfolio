"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Dot follows the pointer exactly; ring trails behind and morphs on interactive elements.
// Add data-cursor="Label" to any element to show text inside the ring.
export default function Cursor() {
  const dot = useRef();
  const ring = useRef();
  const label = useRef();

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    document.documentElement.classList.add("has-cursor");

    const dx = gsap.quickTo(dot.current, "x", { duration: 0.08, ease: "power3" });
    const dy = gsap.quickTo(dot.current, "y", { duration: 0.08, ease: "power3" });
    const rx = gsap.quickTo(ring.current, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(ring.current, "y", { duration: 0.45, ease: "power3" });

    let shown = false;
    const move = (e) => {
      if (!shown) { shown = true; gsap.to([dot.current, ring.current], { opacity: 1, duration: 0.3 }); }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    };

    const setState = (el) => {
      const r = ring.current;
      const text = el?.closest("[data-cursor]")?.dataset.cursor;
      const interactive = el?.closest("a, button");
      r.classList.toggle("is-label", !!text);
      r.classList.toggle("is-link", !text && !!interactive);
      dot.current.classList.toggle("is-hidden", !!text || !!interactive);
      if (text) label.current.textContent = text;
    };
    const over = (e) => setState(e.target);
    const leaveWindow = () => { shown = false; gsap.to([dot.current, ring.current], { opacity: 0, duration: 0.3 }); };
    const down = () => gsap.to(ring.current, { scale: 0.8, duration: 0.2 });
    const up = () => gsap.to(ring.current, { scale: 1, duration: 0.4, ease: "elastic.out(1, .5)" });

    window.addEventListener("pointermove", move);
    document.addEventListener("pointerover", over);
    document.documentElement.addEventListener("pointerleave", leaveWindow);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leaveWindow);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <>
      <div className="cursor-ring" ref={ring}><span ref={label} /></div>
      <div className="cursor-dot" ref={dot} />
    </>
  );
}
