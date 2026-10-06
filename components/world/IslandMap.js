"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ZONES, SECTIONS, SPAWN_POS, PROJECTS_SITE, SOCIAL_CENTER, sectionPoint } from "./zones";
import { gridSpot } from "./trackData";
import { trailSamples, TRAIL_START } from "./trailData";
import { requestMapShot, worldToMap } from "./mapCapture";
import { input } from "./input";
import { sfx } from "./sound";

// ───────── Island map (M), after Bruno Simon's map modal (folio-2025, MIT: Map.js, map.styl) ─────────
// A square frame holding a top-down render of the island, white diamond pins whose names pop up on
// hover, and the car's marker. Clicking a pin drives you there (his respawn-at-location).
const yawFacing = (fromX, fromZ, toX, toZ) => Math.atan2(-(toX - fromX), -(toZ - fromZ));
const atPad = (id, dz = 4.5) => { const [x, , z] = ZONES[id].pos; return { x, z: z + dz, yaw: 0 }; };

function useLocations() {
  return useMemo(() => {
    const trail = trailSamples[TRAIL_START];
    const sec = (key, id) => { const [x, z] = sectionPoint(SECTIONS[key], 0, 11); return { at: ZONES[id].pos, go: { x, z, yaw: SECTIONS[key].yaw } }; };
    return [
      { name: "Landing", at: SPAWN_POS, go: { x: SPAWN_POS[0], z: SPAWN_POS[2], yaw: 0 } },
      { name: "Projects", at: ZONES.projects.pos, go: { x: -3, z: PROJECTS_SITE[1] + 6, yaw: yawFacing(-3, PROJECTS_SITE[1] + 6, ...PROJECTS_SITE) } },
      { name: "Skills", at: ZONES.skills.pos, go: atPad("skills") },
      { name: "Research", at: ZONES.research.pos, go: atPad("research") },
      { name: "Graveyard", at: ZONES.graveyard.pos, go: atPad("graveyard") },
      { name: "About me", at: ZONES.about.pos, go: atPad("about") },
      { name: "Contact", at: [SOCIAL_CENTER[0], 0, SOCIAL_CENTER[1]], go: { x: SOCIAL_CENTER[0], z: SOCIAL_CENTER[1] + 13, yaw: 0 } },
      { name: "Circuit", at: (() => { const g = gridSpot(); return [g.x, 0, g.z]; })(), go: gridSpot() },
      { name: "Trail", at: [trail.p.x, 0, trail.p.z], go: { x: trail.p.x, z: trail.p.z, yaw: Math.atan2(-trail.t.x, -trail.t.z) } },
      { name: "Campus", ...sec("campus", "education") },
      { name: "Hall of Fame", ...sec("fame", "achievements") },
      { name: "Edge AI Lab", ...sec("lab", "interests") },
    ].map((l) => ({ ...l, map: worldToMap(l.at[0], l.at[2]) }));
  }, []);
}

export default function IslandMap({ carRef, onClose, onGo }) {
  const [src, setSrc] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const player = useRef();
  const locations = useLocations();

  // Render the island from above as the map opens
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => requestMapShot().then((url) => alive && setSrc(url)), 30); // (after the modal has painted)
    return () => { alive = false; clearTimeout(t); };
  }, []);

  // Car marker follows the car (rounded like his, so it doesn't jitter)
  useEffect(() => {
    let raf;
    const tick = () => {
      const rb = carRef.current, el = player.current;
      if (rb && el) {
        const p = rb.translation(), q = rb.rotation();
        const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
        const { u, v } = worldToMap(Math.round(p.x), Math.round(p.z));
        el.style.left = `${u * 100}%`;
        el.style.top = `${v * 100}%`;
        el.style.transform = `rotate(${Math.atan2(-Math.cos(yaw), -Math.sin(yaw))}rad)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [carRef]);

  const go = (l) => {
    input.teleport = l.go;
    onGo?.(l);
    sfx.click?.();
    onClose();
  };

  return (
    <div className="bmap-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Island map">
      <div className="bmap" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bmap-close" onClick={onClose} aria-label="Close map">
          <span className="bmap-close-inner">
            <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </span>
        </button>
        <div className="bmap-container">
          {src && <img className={`bmap-texture${loaded ? " is-visible" : ""}`} src={src} alt="" onLoad={() => setLoaded(true)} />}
          {!loaded && <span className="bmap-loading">Drawing the map…</span>}
          {locations.map((l) => (
            <button key={l.name} type="button" className="bmap-location" style={{ left: `${l.map.u * 100}%`, top: `${l.map.v * 100}%`, zIndex: Math.round(l.map.v * 1000) }} onClick={() => go(l)} aria-label={`Go to ${l.name}`}>
              <span className="bmap-pin" />
              <span className="bmap-name-container"><span className="bmap-name">{l.name}</span></span>
            </button>
          ))}
          <div ref={player} className="bmap-player" />
        </div>
      </div>
    </div>
  );
}
