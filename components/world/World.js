"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import gsap from "gsap";
import { useProgress } from "@react-three/drei";
import { profile } from "@/lib/data";
import { TLink } from "../Transition";
import { input, useKeyboard } from "./input";
import { ALL_ZONE_IDS, SPAWN_POS } from "./zones";
import { FETCHED, IMAGES } from "./assets";
import { gridSpot } from "./trackData";
import { sfx } from "./sound";
import { hand } from "./fonts";
import ZonePanel from "./ZonePanel";
import { cycle, phaseName, skipPhase } from "./dayCycle";
import { weather, nextWeatherMode } from "./weather";

const Scene = dynamic(() => import("./Scene"), { ssr: false });
// The map (and the terrain code it samples) only loads once the visitor opens it
const Minimap = dynamic(() => import("./Minimap"), { ssr: false });
// Ask for the 3D scene's code as soon as this module runs, instead of after hydration
if (typeof window !== "undefined") import("./Scene");

// The home page: a drivable 3D world plus a thin DOM layer for the intro screen,
// the info panel that opens when the car parks on a pad, the HUD and the touch joystick.
export default function World() {
  // Preload tags in the server HTML, so the models download in parallel with the JavaScript
  // (three's loaders fetch in CORS mode, hence crossOrigin; three.js reuses the preloaded copies)
  FETCHED.forEach((href) => preload(href, { as: "fetch", crossOrigin: "anonymous" }));
  IMAGES.forEach((href) => preload(href, { as: "image", crossOrigin: "anonymous" }));
  const carRef = useRef(null);
  // Lap state written by the circuit and trail timers every frame (no longer shown in the HUD)
  const lapRef = useRef({ started: false, current: 0, last: null, best: null, laps: 0, sector: 0, flash: 0, onTrack: false });
  const trailRef = useRef({ started: false, current: 0, last: null, best: null, laps: 0, sector: 0, flash: 0, onTrack: false });
  const [started, setStarted] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [ready, setReady] = useState(false); // the world has loaded and the diorama is open
  const onReady = useCallback(() => setReady(true), []);
  // Intro "diorama" reveal: only a circle around the spawn is visible until the visitor clicks
  // (radius: visible circle; ring/ringR: the loader ring; zoom: intro camera distance; mouse: pointer in NDC)
  const revealRef = useRef({ radius: 0, center: [SPAWN_POS[0], SPAWN_POS[2]], started: false, ring: 0, ringR: 7.5, zoom: 1.2, mouse: null });
  const { progress } = useProgress();
  useEffect(() => {
    const r = revealRef.current;
    if (r.ring < 1) r.ring = Math.max(r.ring, (progress / 100) * 0.92); // the last bit completes when the scene mounts
  }, [progress]);
  const start = useCallback(() => {
    if (revealRef.current.started) return;
    revealRef.current.started = true;
    sfx.start();
    setStarted(true);
    setShowKeys(true);
    setTimeout(() => setShowKeys(false), 7000);
    // Pull in slightly, then burst outwards (back.in), then sweep over the whole island
    const r = revealRef.current;
    gsap.killTweensOf(r); // in case the visitor clicks while the diorama is still opening
    gsap.timeline()
      .to(r, { ringR: 0, duration: 0.2 })
      .to(r, { radius: 60, duration: 1.6, ease: "back.in(1.3)" }, 0)
      .to(r, { radius: 420, duration: 1.1, ease: "power1.out" })
      .add(() => { r.radius = 5000; });
  }, []);
  const [zone, setZone] = useState(null);
  const [touch, setTouch] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  // Time of day (Bruno's 4-minute day / night cycle), shown on a HUD chip that skips ahead
  // (starts as a fixed value: the page is prerendered, so reading the clock here would make the
  // server HTML and the first client render disagree; the interval below sets the real phase)
  const [phase, setPhase] = useState("Day");
  // Weather (Bruno's rain / snow / storms): the chip shows what it's doing and forces a weather
  const [sky, setSky] = useState({ mode: "Auto", now: "Clear" });
  useEffect(() => {
    const read = () => {
      setPhase(phaseName(cycle.progress));
      const now = weather.snow > 0.2 ? "Snow" : weather.storm > 0.25 && weather.rain > 0.2 ? "Storm" : weather.rain > 0.2 ? "Rain" : weather.clouds > 0.4 ? "Cloudy" : "Clear";
      setSky((p) => (p.mode === weather.mode && p.now === now ? p : { mode: weather.mode, now }));
    };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, []);
  // "Now playing" notice when a song starts (like Bruno's playlist notification)
  const [song, setSong] = useState(null);
  useEffect(() => {
    let timer;
    const off = sfx.onSong((name) => { setSong(name); clearTimeout(timer); timer = setTimeout(() => setSong(null), 5000); });
    return () => { off(); clearTimeout(timer); };
  }, []);
  const [quality, setQuality] = useState("high");
  // Remember the last zone so the panel keeps its content while sliding closed
  const lastZone = useRef(null);
  if (zone) lastZone.current = zone;
  // Places the visitor has parked on (drives the "Discovered" counter and the minimap dots)
  const [discovered, setDiscovered] = useState(() => new Set());
  useEffect(() => {
    if (zone && !discovered.has(zone)) setDiscovered((d) => new Set(d).add(zone));
  }, [zone, discovered]);
  // Areas without a pad (projects forge, social plinth) report themselves as discovered
  const onDiscover = useCallback((id) => setDiscovered((d) => (d.has(id) ? d : new Set(d).add(id))), []);

  useKeyboard(started);

  // Island map (M) and the settings menu (gear, top right)
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSize, setMapSize] = useState(600);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  useEffect(() => {
    if (!started) return;
    import("./Minimap"); // warm it up so the first M opens instantly
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.code === "KeyM" && !e.repeat && !input.locked) { setMapOpen((o) => !o); setSettingsOpen(false); sfx.click(); }
      if (e.code === "Escape") { setMapOpen(false); setSettingsOpen(false); setZone(null); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [started]);
  useEffect(() => {
    const fit = () => setMapSize(Math.round(Math.min(innerWidth - 32, innerHeight - 150, 760)));
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  // Clicking anywhere outside the settings menu closes it
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e) => { if (!settingsRef.current?.contains(e.target)) setSettingsOpen(false); };
    addEventListener("pointerdown", onDown);
    return () => removeEventListener("pointerdown", onDown);
  }, [settingsOpen]);

  // Enter / W / ↑ also start, once the diorama is open
  useEffect(() => {
    if (!ready || started) return;
    const onKey = (e) => { if (["Enter", "KeyW", "ArrowUp"].includes(e.code)) start(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [ready, started, start]);

  useEffect(() => {
    document.documentElement.classList.add("is-home");
    const isTouch = matchMedia("(hover: none)").matches;
    setTouch(isTouch);
    if (isTouch) setQuality("low"); // phones get fewer effects for a smooth frame rate
    return () => document.documentElement.classList.remove("is-home");
  }, []);

  return (
    <main className="world">
      <Scene carRef={carRef} lapRef={lapRef} trailRef={trailRef} revealRef={revealRef} zone={zone} setZone={setZone} onDiscover={onDiscover} onFlipped={setFlipped} onReady={onReady} quality={quality} />

      {/* HUD (hidden on the intro screen) */}
      <header className={`hud${started ? " on" : ""}`}>
        <div className="hud-name">
          <strong>{profile.name}</strong>
          <span>{profile.role}</span>
        </div>
        <div className="settings" ref={settingsRef}>
          <button type="button" className={`settings-btn${settingsOpen ? " open" : ""}`} onClick={() => setSettingsOpen((o) => !o)}
            aria-expanded={settingsOpen} aria-controls="settings-menu" aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <div id="settings-menu" className={`settings-menu${settingsOpen ? " open" : ""}`} role="menu" aria-hidden={!settingsOpen}>
            <p className="settings-title">Settings</p>
            <button type="button" className="setting" role="menuitemcheckbox" aria-checked={!muted} onClick={() => { const m = !muted; setMuted(m); sfx.setMuted(m); }}>
              <span>Sound</span><b>{muted ? "Off" : "On"}</b>
            </button>
            <button type="button" className="setting" role="menuitemcheckbox" aria-checked={musicOn} onClick={() => { const m = !musicOn; setMusicOn(m); sfx.setMusic(m); }} title="Music by Bruno Simon (CC0)">
              <span>Music</span><b>{musicOn ? "On" : "Off"}</b>
            </button>
            <button type="button" className="setting" role="menuitem" onClick={skipPhase} title="Skip to the next time of day (the cycle runs every 4 minutes)">
              <span>Time of day</span><b>{{ Day: "☀", Dusk: "◐", Night: "☾", Dawn: "◑" }[phase]} {phase}</b>
            </button>
            <button type="button" className="setting" role="menuitem" onClick={() => { nextWeatherMode(); setSky((p) => ({ ...p, mode: weather.mode })); }} title="Auto follows the weather model; click to force Clear, Rain, Storm or Snow">
              <span>Weather</span><b>{{ Clear: "☀", Cloudy: "☁", Rain: "☂", Storm: "⚡", Snow: "❄" }[sky.now]} {sky.mode === "Auto" ? `Auto · ${sky.now}` : sky.mode}</b>
            </button>
            <button type="button" className="setting" role="menuitem" onClick={() => setQuality((q) => (q === "high" ? "low" : "high"))} title="Lower effects if it runs slowly">
              <span>Quality</span><b>{quality === "high" ? "High" : "Low"}</b>
            </button>
            <hr />
            <button type="button" className="setting" role="menuitem" onClick={() => { setMapOpen(true); setSettingsOpen(false); }}>
              <span>Map</span><kbd>M</kbd>
            </button>
            <button type="button" className="setting setting-race" role="menuitem" onClick={() => { input.teleport = gridSpot(); setSettingsOpen(false); }} title="Drop the car on the starting grid">
              <span>Race track</span><b>Go</b>
            </button>
            <button type="button" className="setting" role="menuitem" onClick={() => { input.reset = true; setSettingsOpen(false); }} title="Teleport back to the start">
              <span>Respawn</span><b>↺</b>
            </button>
            <TLink href="/about" title="Classic view" className="setting setting-solid"><span>Classic view</span><b>→</b></TLink>
          </div>
        </div>
      </header>

      {started && song && musicOn && !muted && (
        <div className="now-playing" role="status">
          <span className="now-playing-note" aria-hidden="true">♪</span>
          <span>Now playing<br /><b className={hand.className}>{song}</b></span>
        </div>
      )}
      {started && mapOpen && (
        <div className="map-overlay" onClick={() => setMapOpen(false)} role="dialog" aria-modal="true" aria-label="Island map">
          <div className="map-card" onClick={(e) => e.stopPropagation()}>
            <div className="map-head">
              <strong className={hand.className}>The island</strong>
              <span>Discovered <b>{discovered.size}</b> / {ALL_ZONE_IDS.length}</span>
              <button type="button" className="map-close" onClick={() => setMapOpen(false)} aria-label="Close map">×</button>
            </div>
            <Minimap carRef={carRef} discovered={discovered} size={mapSize} />
            <p className="map-legend">
              <i className="lg-car" /> You <i className="lg-track" /> Race track <i className="lg-trail" /> Adventure trail · press <kbd>M</kbd> or <kbd>Esc</kbd> to close
            </p>
          </div>
        </div>
      )}
      {started && showKeys && <p className="hud-hint hud-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows drive · <kbd>Shift</kbd> boost · <kbd>Space</kbd> brake · <kbd>R</kbd> flip back · <kbd>H</kbd> horn · <kbd>M</kbd> map</p>}
      {started && !showKeys && !zone && !flipped && <p className="hud-hint">Explore the island · drive up to a dot and press Enter · try the ramps · mind the bombs</p>}
      {flipped && (
        <button type="button" className="flip-hint" onClick={() => { input.flip = true; }}>
          Oops, you flipped! Press <kbd>R</kbd> or tap here to flip back
        </button>
      )}

      {/* Info panel for the pad the car is parked on */}
      {/* data-lenis-prevent: the site-wide smooth scroll (Lenis) would otherwise swallow the wheel here */}
      <aside className={`panel${zone ? " open" : ""}`} aria-live="polite" data-lenis-prevent>
        {lastZone.current && <ZonePanel zone={lastZone.current} />}
      </aside>

      {touch && started && <Joystick />}

      {/* Intro: the world is a small glowing diorama; click anywhere to open it up */}
      {!started && (
        <div className="intro" onClick={start}
          onPointerMove={(e) => { revealRef.current.mouse = [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1]; }}
          onPointerLeave={() => { revealRef.current.mouse = null; }} role="button" tabIndex={0} aria-label="Click to start" onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && start()}>
          <div className={`intro-cta${ready ? " on" : ""}`}>
            <svg className="intro-arrow" viewBox="0 0 120 60" aria-hidden="true">
              <path d="M112 14 C 80 2, 40 6, 14 40" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <path d="M8 22 L 13 44 L 34 37" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={`intro-text ${hand.className}`}>Click to<br />start</span>
            <button type="button" className="intro-sound" aria-pressed={!muted} aria-label={muted ? "Sound off" : "Sound on"}
              onClick={(e) => { e.stopPropagation(); const m = !muted; setMuted(m); sfx.setMuted(m); }}>
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M5 12h5l7-6v20l-7-6H5z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
                {muted
                  ? <path d="M21 12l7 8M28 12l-7 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  : <><path d="M21 12.5c1.6 1.8 1.6 5.2 0 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><path d="M24.5 9.5c3.4 3.6 3.4 9.4 0 13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>}
              </svg>
            </button>
          </div>
          <div className="intro-foot" onClick={(e) => e.stopPropagation()}>
            <span className={hand.className}>Arghadeep Pakhira · AI/ML &amp; Edge AI Engineer</span>
            <TLink href="/about" title="Classic view" className="intro-classic">Classic view →</TLink>
          </div>
        </div>
      )}
    </main>
  );
}

// Touch controls: a thumb stick for steering/throttle and a boost button
function Joystick() {
  const base = useRef();
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const move = (e) => {
    const b = base.current.getBoundingClientRect();
    let x = (e.clientX - (b.left + b.width / 2)) / (b.width / 2);
    let y = (e.clientY - (b.top + b.height / 2)) / (b.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    input.joyX = x; input.joyY = y;
    setKnob({ x, y });
  };
  const end = () => { input.joyX = 0; input.joyY = 0; setKnob({ x: 0, y: 0 }); };
  return (
    <>
      <div ref={base} className="joy" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
        <span style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
      </div>
      <button type="button" className="boost" onPointerDown={() => { input.boost = true; input.f = 1; }} onPointerUp={() => { input.boost = false; input.f = 0; }} onPointerLeave={() => { input.boost = false; input.f = 0; }}>Boost</button>
    </>
  );
}
