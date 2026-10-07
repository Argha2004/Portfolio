import * as THREE from "three";
import gsap from "gsap";

// ───────── Day / night cycle, after Bruno Simon's folio-2025 (MIT: Cycles/DayCycles.js) ─────────
// Same four presets and the same keyframes over a 10-minute loop that follows the clock, so every
// visitor at the same moment sees the same time of day:
//   day (0 – 0.15) → dusk (0.25) → night (0.35 – 0.6) → dawn (0.8) → day (0.9)
// Each preset sets the light colour + intensity, the shadow tint, the fog gradient and fog range,
// and the intro reveal colour. "night" (0.25 – 0.7) and "deepNight" (0.35 – 0.6) are intervals
// other parts listen to (pole lights, fireflies, night sounds).
const C = (hex) => new THREE.Color(hex);
export const PRESETS = {
  day: { reveal: C("#5f7dff"), light: C("#ffd2c2"), lightIntensity: 1.2, shadow: C("#6d3fff"), fogA: C("#00ffff"), fogB: C("#9b89ff"), fogNear: 0.315, fogFar: 1.25, temperature: 5, electricField: 0 },
  dusk: { reveal: C("#ff86d9"), light: C("#ff8181"), lightIntensity: 1.2, shadow: C("#4e009c"), fogA: C("#3e53ff"), fogB: C("#ff4ce4"), fogNear: 0, fogFar: 1.25, temperature: 0, electricField: 0.25 },
  night: { reveal: C("#b678ff"), light: C("#3240ff"), lightIntensity: 3.8, shadow: C("#2f00db"), fogA: C("#10266f"), fogB: C("#490a42"), fogNear: -0.85, fogFar: 1, temperature: -7.5, electricField: 1 },
  dawn: { reveal: C("#ff9d9d"), light: C("#ffa882"), lightIntensity: 1.2, shadow: C("#db004f"), fogA: C("#f885ff"), fogB: C("#ff7d24"), fogNear: 0.3, fogFar: 1.25, temperature: 0, electricField: 0.25 },
};
const KEYS = [
  ["day", 0.0], ["day", 0.15], ["dusk", 0.25], ["night", 0.35], ["night", 0.6], ["dawn", 0.8], ["day", 0.9], ["day", 1.0],
];
export const DURATION = 10 * 60; // seconds (his is 4 min; slower here so a visit isn't mostly night)

// His fog distances are ratios of a near→far span; these map his dawn values onto the
// 28 m → 130 m range this world was tuned with.
const FOG_BASE = -4.2, FOG_SPAN = 107.4;

// Shared, mutable state read by the renderer every frame (no React re-renders)
export const cycle = {
  progress: 0,
  offset: 0,                 // skip ahead (the HUD's time button)
  light: new THREE.Color(), lightIntensity: 1, shadow: new THREE.Color(),
  fogA: new THREE.Color(), fogB: new THREE.Color(), fogRange: new THREE.Vector2(),
  reveal: new THREE.Color(),
  temperature: 0, electricField: 0,  // read by the weather
  absolute: 0,                        // ever-increasing progress (the weather noise runs on it)
  night: false, deepNight: false, nightAmount: 0,
  sunDir: new THREE.Vector3(),
  listeners: new Set(),
};

export const phaseName = (p) => (p < 0.2 ? "Day" : p < 0.3 ? "Dusk" : p < 0.7 ? "Night" : p < 0.85 ? "Dawn" : "Day");

// Jump to the start of the next phase (day → dusk → night → dawn)
const PHASE_STARTS = [0.0, 0.2, 0.3, 0.72, 1.0];
export function skipPhase() {
  const p = cycle.progress;
  const next = PHASE_STARTS.find((s) => s > p + 0.01) ?? 1;
  // a quick, smooth time-lapse to it rather than a cut
  gsap.to(cycle, { offset: cycle.offset + (next - p), duration: 2.5, ease: "power2.inOut", overwrite: true });
}

const lerpProp = (a, b, k, key) => (a[key].isColor ? a[key].clone().lerp(b[key], k) : a[key] + (b[key] - a[key]) * k);

export function updateCycle() {
  cycle.absolute = Date.now() / 1000 / DURATION + cycle.offset;
  const p = ((cycle.absolute % 1) + 1) % 1;
  cycle.progress = p;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][1] <= p) i++;
  const [ka, sa] = KEYS[i], [kb, sb] = KEYS[i + 1];
  const k = THREE.MathUtils.smoothstep(p, sa, sb);
  const a = PRESETS[ka], b = PRESETS[kb];
  cycle.light.copy(lerpProp(a, b, k, "light"));
  cycle.lightIntensity = lerpProp(a, b, k, "lightIntensity");
  cycle.shadow.copy(lerpProp(a, b, k, "shadow"));
  cycle.fogA.copy(lerpProp(a, b, k, "fogA"));
  cycle.fogB.copy(lerpProp(a, b, k, "fogB"));
  cycle.reveal.copy(lerpProp(a, b, k, "reveal"));
  cycle.temperature = lerpProp(a, b, k, "temperature");
  cycle.electricField = lerpProp(a, b, k, "electricField");
  cycle.fogRange.set(FOG_BASE + lerpProp(a, b, k, "fogNear") * FOG_SPAN, FOG_BASE + lerpProp(a, b, k, "fogFar") * FOG_SPAN);

  // Sun path (his Lighting.update): swings around and dips with the cycle
  const t = -(p + 9 / 16) * Math.PI * 2;
  const theta = 2.29 + Math.sin(t) * 1.25, phi = 0.66 + Math.cos(t) * 0.5 * 0.62;
  cycle.sunDir.setFromSphericalCoords(1, phi, theta);

  // Intervals + a smooth 0..1 for things that fade in at night
  const night = p > 0.25 && p < 0.7, deepNight = p > 0.35 && p < 0.6;
  cycle.nightAmount = THREE.MathUtils.smoothstep(p, 0.22, 0.32) * (1 - THREE.MathUtils.smoothstep(p, 0.66, 0.76));
  if (night !== cycle.night) { cycle.night = night; cycle.listeners.forEach((fn) => fn("night", night)); }
  if (deepNight !== cycle.deepNight) { cycle.deepNight = deepNight; cycle.listeners.forEach((fn) => fn("deepNight", deepNight)); }
  return cycle;
}
updateCycle();

export const onCycle = (fn) => { cycle.listeners.add(fn); return () => cycle.listeners.delete(fn); };
