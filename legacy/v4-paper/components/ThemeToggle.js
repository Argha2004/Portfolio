"use client";

// Flips data-theme on <html>. Where supported, the new theme grows out of the button as a circle.
export default function ThemeToggle() {
  const toggle = (e) => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch {}
      window.dispatchEvent(new Event("themechange"));
    };

    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();

    const { clientX: x, clientY: y } = e;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 800, easing: "cubic-bezier(.76,0,.24,1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  return <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode" />;
}
