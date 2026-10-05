"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { projects } from "@/lib/projects";
import { profile, socials, publication } from "@/lib/data";
import { TLink, useNavigate } from "../Transition";

const Gallery = dynamic(() => import("./Gallery"), { ssr: false });

// Home = one fullscreen 3D room. The only UI is four corners, a caption for the centred screen,
// a "Full" index view, and the profile (bio inside a glass ring).
export default function Home() {
  const navigate = useNavigate();
  const [view, setView] = useState("featured");
  const [profileOpen, setProfileOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const [centre, setCentre] = useState(0);
  const [hoverName, setHoverName] = useState(null);
  const state = useRef({ offset: 0, target: 0, wave: 0, profile: false, full: false, dragged: false, centre: -1, hoverName: null });

  state.current.onCentre = setCentre;
  state.current.profile = profileOpen;
  state.current.full = view === "full";

  // Keep the glass ring mounted until its closing animation finishes
  useEffect(() => {
    if (profileOpen) { setRing(true); return; }
    const t = setTimeout(() => setRing(false), 900);
    return () => clearTimeout(t);
  }, [profileOpen]);

  // Mirror 3D hover into the DOM so the cursor can show "View"
  useEffect(() => {
    const id = setInterval(() => setHoverName(state.current.hoverName), 60);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setProfileOpen(false); setView("featured"); } };
    addEventListener("keydown", onKey);
    document.documentElement.classList.add("is-home");
    return () => { removeEventListener("keydown", onKey); document.documentElement.classList.remove("is-home"); };
  }, []);

  const open = useCallback((p) => navigate(`/work/${p.slug}`, p.name), [navigate]);
  const p = projects[centre];

  return (
    <main className="home" data-cursor={hoverName && !profileOpen ? "View" : undefined}>
      <Gallery state={state} onOpen={open} ring={ring} />

      {/* Corners */}
      <TLink href="/about" title="About" className="corner tl">Arghadeep Pakhira</TLink>
      <button type="button" className="corner tr" onClick={() => { setProfileOpen((o) => !o); setView("featured"); }}>
        {profileOpen ? "Close" : "Profile"}
      </button>
      <div className="corner bl">
        <button type="button" className={view === "featured" ? "on" : ""} onClick={() => setView("featured")}>Featured</button>
        <span>/</span>
        <button type="button" className={view === "full" ? "on" : ""} onClick={() => { setView("full"); setProfileOpen(false); }}>Full</button>
      </div>
      <a className="corner br" href={`mailto:${profile.email}`}>Contact</a>

      {/* Caption for the centred screen */}
      <div className={`caption${view === "featured" && !profileOpen ? " show" : ""}`} aria-live="polite">
        <span className="caption-n">{String(centre + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
        <TLink href={`/work/${p.slug}`} title={p.name} className="caption-name">{p.name}</TLink>
        <span className="caption-cat">{p.category}</span>
      </div>
      <p className={`hint${view === "featured" && !profileOpen ? " show" : ""}`}>Scroll or drag to explore · Click a screen to open</p>

      {/* Full index */}
      <div className={`full${view === "full" ? " show" : ""}`} aria-hidden={view !== "full"}>
        <ul>
          {projects.map((x, i) => (
            <li key={x.slug} style={{ "--i": i }}>
              <TLink href={`/work/${x.slug}`} title={x.name} data-cursor="Open">
                <span className="full-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="full-name">{x.name}</span>
                <span className="full-sub">{x.subtitle}</span>
                <span className="full-cat">{x.category}</span>
              </TLink>
            </li>
          ))}
        </ul>
      </div>

      {/* Profile: bio centred inside the glass ring */}
      <div className={`profile${profileOpen ? " show" : ""}`} aria-hidden={!profileOpen}>
        <p>
          Arghadeep Pakhira, AI/ML &amp; Edge AI engineer from West Bengal, India.
          B.Tech (CSBS) undergraduate building deep-learning models, on-device AI and LLM-powered tools, and co-author of an IEEE COMSNETS 2026 paper.
        </p>
        <p className="profile-meta">1 IEEE publication — {projects.length} projects — 0.832 macro-AUC</p>
        <p className="profile-links">
          {socials.map((s, i) => (
            <span key={s.label}>{i > 0 && <i>×</i>}<a href={s.href} target="_blank" rel="noreferrer">{s.label}</a></span>
          ))}
          <span><i>×</i><a href={publication.href} target="_blank" rel="noreferrer">IEEE</a></span>
        </p>
        <TLink href="/about" title="About" className="profile-more">Full profile →</TLink>
      </div>
    </main>
  );
}
