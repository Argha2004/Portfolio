"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

// Counts from 0 to `value` the first time it scrolls into view.
export default function CountUp({ value, decimals = 0, suffix = "" }) {
  const el = useRef();
  useEffect(() => {
    const n = { v: 0 };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      gsap.to(n, { v: value, duration: 1.8, ease: "power3.out", onUpdate: () => { el.current.textContent = n.v.toFixed(decimals) + suffix; } });
    });
    io.observe(el.current);
    return () => io.disconnect();
  }, [value, decimals, suffix]);
  return <strong ref={el}>{(0).toFixed(decimals)}{suffix}</strong>;
}
