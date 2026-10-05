import * as THREE from "three";

// Draws a "website screen" poster for a project onto a canvas → texture for the 3D screens.
// Replace with real screenshots later by loading an image texture instead.
const W = 1600, H = 1000;

function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function makePoster(p, index, total, font) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const [c0, c1, c2] = p.colors;

  // Background: deep radial gradient in the project's colours
  const bg = g.createRadialGradient(W * 0.72, H * 0.3, 40, W * 0.55, H * 0.55, W * 0.95);
  bg.addColorStop(0, c0); bg.addColorStop(0.42, c1); bg.addColorStop(1, c2);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // Soft glowing orb for depth
  const orb = g.createRadialGradient(W * 0.76, H * 0.36, 10, W * 0.76, H * 0.36, 300);
  orb.addColorStop(0, "rgba(255,255,255,.55)"); orb.addColorStop(0.35, "rgba(255,255,255,.12)"); orb.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = orb; g.fillRect(0, 0, W, H);

  // Fine grid
  g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  // Grain
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";

  // Top bar, like the header of a site
  g.font = `500 24px ${font}`;
  g.globalAlpha = 0.85;
  g.fillText(`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")} — ${p.category.toUpperCase()}`, 70, 74);
  g.textAlign = "right";
  g.fillText(p.tags.toUpperCase(), W - 70, 74);
  g.textAlign = "left";
  g.globalAlpha = 0.35;
  g.fillRect(70, 100, W - 140, 1.5);
  g.globalAlpha = 1;

  // Title, sized to fit
  let size = 250;
  g.font = `700 ${size}px ${font}`;
  while (g.measureText(p.name).width > W - 160 && size > 90) { size -= 6; g.font = `700 ${size}px ${font}`; }
  if ("letterSpacing" in g) g.letterSpacing = `${-size * 0.045}px`;
  g.fillText(p.name, 64, 470);
  if ("letterSpacing" in g) g.letterSpacing = "0px";

  // Subtitle
  g.font = `400 46px ${font}`;
  g.globalAlpha = 0.88;
  wrap(g, p.subtitle, 1000).slice(0, 2).forEach((l, i) => g.fillText(l, 72, 560 + i * 58));
  g.globalAlpha = 1;

  // Stats row
  g.globalAlpha = 0.35;
  g.fillRect(70, 790, W - 140, 1.5);
  g.globalAlpha = 1;
  p.stats.forEach(([v, label], i) => {
    const x = 72 + i * 500;
    g.font = `700 74px ${font}`;
    g.fillText(v, x, 880);
    g.font = `500 22px ${font}`;
    g.globalAlpha = 0.75;
    wrap(g, label.toUpperCase(), 420).slice(0, 2).forEach((l, j) => g.fillText(l, x, 920 + j * 28));
    g.globalAlpha = 1;
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
