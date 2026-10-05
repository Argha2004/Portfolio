"use client";
import { useEffect, useRef } from "react";

// Reading progress: a hairline across the top plus "p. n / N" in the corner (pages = viewport heights).
export default function Progress() {
  const bar = useRef();
  const page = useRef();
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      bar.current.style.transform = `scaleX(${p})`;
      const total = Math.max(1, Math.ceil(document.documentElement.scrollHeight / innerHeight));
      page.current.textContent = `p. ${Math.min(total, Math.floor(scrollY / innerHeight) + 1)} / ${total}`;
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => { removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, []);
  return (
    <>
      <div className="progress"><i ref={bar} /></div>
      <span className="page-no" ref={page} />
    </>
  );
}
