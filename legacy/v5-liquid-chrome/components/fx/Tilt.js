"use client";
import { useRef } from "react";

// 3D hover tilt with a moving glare. Writes CSS variables only, so it never re-renders React.
// The transform lives on an inner element so it doesn't fight reveal animations on the wrapper.
export default function Tilt({ children, className = "", max = 12 }) {
  const el = useRef();
  const set = (k, v) => el.current.style.setProperty(k, v);
  const move = (e) => {
    const r = el.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    set("--ry", `${(x - 0.5) * max * 2}deg`);
    set("--rx", `${(0.5 - y) * max * 2}deg`);
    set("--gx", `${x * 100}%`);
    set("--gy", `${y * 100}%`);
  };
  const leave = () => { set("--rx", "0deg"); set("--ry", "0deg"); };
  return (
    <div ref={el} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <div className="tilt-inner">
        {children}
        <span className="tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
}
