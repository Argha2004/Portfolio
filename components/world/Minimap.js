"use client";
import { useEffect, useRef } from "react";
import { CELL, AVENUE, ISLAND_R, DISTRICTS, ZONES } from "./zones";
import { samples, START_INDEX } from "./trackData";
import { trailSamples, TRAIL_START, TRAIL_WIDTH } from "./trailData";
import { terrain } from "./terrain";

// 2D map of the island drawn on a canvas each frame: terrain, circuit, trail, avenues, districts,
// places (pulsing until discovered) and the car (arrow). Purely visual, so it reads straight from
// the physics body. Drawn in a fixed 170-unit space and scaled to `size`; `px` converts screen
// pixels into that space so labels, dots and the arrow keep their on-screen size.
const BASE = 170;
const S = BASE / (ISLAND_R * 2 + 20);
const toMap = (x, z) => [BASE / 2 + x * S, BASE / 2 + z * S];

// The terrain (sand, grass, ponds, sea) painted once into an offscreen canvas, in the floor's colours
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const DIRT = hex("#ffa94e"), TEAL = hex("#5bc2b9"), DEEP = hex("#13375f"), GRASS = hex("#b8b62e"), SLAB = hex("#ffe1b8");
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(Math.max(t, 0), 1));
function terrainImage(n) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d"), img = g.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n * BASE - BASE / 2) / S, z = ((j + 0.5) / n * BASE - BASE / 2) / S;
    const b = terrain.depth(x, z);
    let col = mixc(DIRT, TEAL, (b - 0.1) / 0.2);
    col = mixc(col, DEEP, (b - 0.3) / 0.6);
    col = mixc(col, GRASS, terrain.grass(x, z));
    col = mixc(col, SLAB, terrain.slab(x, z));
    img.data.set([...col, 255], (j * n + i) * 4);
  }
  g.putImageData(img, 0, 0);
  return c;
}

const path = (g, pts, closed) => {
  g.beginPath();
  pts.forEach((sm, i) => { const [mx, mz] = toMap(sm.p.x, sm.p.z); i ? g.lineTo(mx, mz) : g.moveTo(mx, mz); });
  if (closed) g.closePath();
};

export default function Minimap({ carRef, discovered, size = BASE }) {
  const canvas = useRef();
  const found = useRef(discovered);
  found.current = discovered;

  useEffect(() => {
    const c = canvas.current, g = c.getContext("2d");
    const dpr = Math.min(devicePixelRatio, 2), k = size / BASE, px = 1 / k;
    c.width = size * dpr; c.height = size * dpr;
    g.scale(dpr * k, dpr * k);
    const ground = terrainImage(Math.min(Math.round(size * dpr), 900));
    const spots = Object.values(ZONES);
    let raf;
    const draw = () => {
      g.clearRect(0, 0, BASE, BASE);
      g.save(); g.beginPath(); g.arc(BASE / 2, BASE / 2, BASE / 2, 0, Math.PI * 2); g.clip();
      g.drawImage(ground, 0, 0, BASE, BASE);
      g.lineJoin = "round"; g.lineCap = "round";
      // Adventure trail (dirt track, dashed)
      g.strokeStyle = "rgba(122,74,40,.55)"; g.lineWidth = TRAIL_WIDTH * S;
      path(g, trailSamples, true); g.stroke();
      g.strokeStyle = "#fff4e2"; g.lineWidth = 1.2 * px; g.setLineDash([4 * px, 4 * px]); g.stroke(); g.setLineDash([]);
      // F1 circuit (with a chequered start mark) + avenues
      g.strokeStyle = "#4a474f"; g.lineWidth = Math.max(4.5 * px, 12 * S);
      path(g, samples, true); g.stroke();
      g.strokeStyle = "#d8231c"; g.lineWidth = 1.2 * px; g.setLineDash([2 * px, 2 * px]); g.stroke(); g.setLineDash([]);
      const st = samples[START_INDEX], [sx, sz] = toMap(st.p.x, st.p.z);
      g.fillStyle = "#fff"; g.fillRect(sx - 1.5 * px, sz - 4 * px, 3 * px, 8 * px);
      const ts = trailSamples[TRAIL_START], [tx, tz] = toMap(ts.p.x, ts.p.z);
      g.fillStyle = "#7a4a28"; g.beginPath(); g.arc(tx, tz, 3 * px, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#6f6a78"; g.lineWidth = Math.max(3 * px, 8 * S);
      const r = AVENUE * CELL;
      g.beginPath(); g.moveTo(...toMap(0, -r)); g.lineTo(...toMap(0, r)); g.moveTo(...toMap(-r, 0)); g.lineTo(...toMap(r, 0)); g.stroke();
      g.beginPath(); g.arc(BASE / 2, BASE / 2, 12 * S, 0, Math.PI * 2); g.stroke();
      g.restore();
      // district names
      g.fillStyle = "rgba(59,31,29,.75)"; g.font = `600 ${(k > 2 ? 12 : 8) * px}px system-ui`; g.textAlign = "center";
      Object.values(DISTRICTS).forEach((d) => { const [mx, mz] = toMap(...d.center); g.fillText(d.name.replace("The ", "").toUpperCase(), mx, mz + 3 * px); });
      // places: filled once discovered, pulsing ring while undiscovered; labelled on the big map
      const t = performance.now() / 400, dot = (k > 2 ? 6 : 3.2) * px;
      spots.forEach((s) => {
        const [mx, mz] = toMap(s.pos[0], s.pos[2]);
        const done = found.current.has(s.id);
        g.fillStyle = done ? s.color : "#fff7f0";
        g.beginPath(); g.arc(mx, mz, dot, 0, Math.PI * 2); g.fill();
        g.strokeStyle = s.color; g.lineWidth = 2 * px;
        g.stroke();
        if (!done) { g.beginPath(); g.arc(mx, mz, dot + (Math.sin(t) + 1) * 2.5 * px, 0, Math.PI * 2); g.stroke(); }
        if (k > 2) {
          g.font = `700 ${11 * px}px system-ui`;
          const w = g.measureText(s.label).width + 10 * px;
          g.fillStyle = "rgba(30,22,26,.82)";
          g.beginPath(); g.roundRect(mx - w / 2, mz - dot - 22 * px, w, 16 * px, 8 * px); g.fill();
          g.fillStyle = "#fff3ea"; g.fillText(s.label, mx, mz - dot - 10 * px);
        }
      });
      // car
      const rb = carRef.current;
      if (rb) {
        const p = rb.translation(), q = rb.rotation();
        const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
        const [mx, mz] = toMap(p.x, p.z);
        g.save(); g.translate(mx, mz); g.rotate(-yaw); g.scale(px * (k > 2 ? 1.6 : 1), px * (k > 2 ? 1.6 : 1));
        g.fillStyle = "#e5423a"; g.strokeStyle = "#fff"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [carRef, size]);

  return <canvas ref={canvas} className="minimap" style={{ width: size, height: size }} aria-label="Map of the island" />;
}
