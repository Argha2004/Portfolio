"use client";
import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";

const Ctx = createContext(null);

// Curtain wipe: panel slides up to cover, route changes, panel slides off the top.
export function TransitionProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const curtain = useRef();
  const label = useRef();
  const busy = useRef(false);
  const first = useRef(true);

  const navigate = (href, title = "") => {
    if (busy.current || href === pathname) return;
    busy.current = true;
    label.current.textContent = title;
    gsap.timeline()
      .set(curtain.current, { yPercent: 100, display: "flex" })
      .to(curtain.current, { yPercent: 0, duration: 0.8, ease: "expo.inOut" })
      .fromTo(label.current, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: "expo.out" }, "-=0.35")
      .add(() => router.push(href));
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const hash = window.location.hash;
    const target = hash && document.querySelector(hash);
    window.__lenis?.scrollTo(target || 0, { immediate: true, force: true, offset: target ? -72 : 0 });
    window.dispatchEvent(new CustomEvent("project-hover", { detail: -1 }));
    gsap.timeline({ delay: 0.15, onComplete: () => { busy.current = false; } })
      .to(label.current, { yPercent: -100, duration: 0.5, ease: "expo.in" })
      .to(curtain.current, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.2")
      .set(curtain.current, { display: "none" });
  }, [pathname]);

  return (
    <Ctx.Provider value={navigate}>
      {children}
      <div className="curtain" ref={curtain}>
        <span className="curtain-label"><span ref={label} /></span>
      </div>
    </Ctx.Provider>
  );
}

export function TLink({ href, title, children, ...rest }) {
  const navigate = useContext(Ctx);
  return (
    <a href={href} {...rest} onClick={(e) => {
      if (e.metaKey || e.ctrlKey || href.startsWith("#") || href.startsWith("mailto")) return;
      e.preventDefault();
      navigate(href, title);
    }}>{children}</a>
  );
}
