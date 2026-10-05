"use client";
import { useRef } from "react";
import gsap from "gsap";

// Pulls its child toward the cursor while hovered, then springs back.
export default function Magnetic({ children, strength = 0.35 }) {
  const el = useRef();
  const move = (e) => {
    const r = el.current.getBoundingClientRect();
    gsap.to(el.current, { x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength, duration: 0.4, ease: "power3.out" });
  };
  const leave = () => gsap.to(el.current, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, .4)" });
  return <span ref={el} className="magnetic" onPointerMove={move} onPointerLeave={leave}>{children}</span>;
}
