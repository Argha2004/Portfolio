"use client";
import { useEffect, useRef } from "react";

// Tags distributed on a sphere (Fibonacci lattice) and projected with CSS 3D.
// It spins on its own; the cursor steers the spin while hovering.
export default function SkillGlobe({ tags }) {
  const root = useRef();
  useEffect(() => {
    const el = root.current;
    const nodes = [...el.querySelectorAll(".globe-tag")];
    const n = nodes.length;
    const pts = nodes.map((_, i) => {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    let ax = 0.3, ay = 0, vx = 0.0015, vy = 0.004, raf, visible = false;
    const onMove = (e) => {
      const b = el.getBoundingClientRect();
      vy = ((e.clientX - b.left) / b.width - 0.5) * 0.03;
      vx = -((e.clientY - b.top) / b.height - 0.5) * 0.03;
    };
    const onLeave = () => { vx = 0.0015; vy = 0.004; };
    const frame = () => {
      ax += vx; ay += vy;
      const R = el.clientWidth * 0.4;
      const sx = Math.sin(ax), cx = Math.cos(ax), sy = Math.sin(ay), cy = Math.cos(ay);
      pts.forEach(([x, y, z], i) => {
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        const depth = (z2 + 1) / 2; // 0 back → 1 front
        const s = nodes[i].style;
        s.transform = `translate(-50%, -50%) translate3d(${x1 * R}px, ${y2 * R}px, ${z2 * R}px)`;
        s.opacity = (0.18 + depth * 0.82).toFixed(2);
        s.zIndex = Math.round(depth * 100);
      });
      if (visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(el);
    frame();
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => { io.disconnect(); cancelAnimationFrame(raf); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); };
  }, []);

  return (
    <div className="globe" ref={root} aria-label={`Skills: ${tags.join(", ")}`}>
      {tags.map((t) => <span className="globe-tag" key={t} aria-hidden="true">{t}</span>)}
    </div>
  );
}
