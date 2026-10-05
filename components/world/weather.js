import * as THREE from "three";
import gsap from "gsap";
import { cycle } from "./dayCycle";

// ───────── Weather, after Bruno Simon's folio-2025 (MIT: Weather.js, Cycles/YearCycles.js) ─────────
// Same model as his: a year cycle (real date → winter / spring / summer / fall presets) and the
// day cycle give base values, a slow deterministic noise wanders around them, and rain / snow
// fall out of the combination:
//   rain = humidity above 0.65 × clouds above 0
//   snow = rain while below freezing, melting away above 0 °C (−1 … 1, like his)
// Everyone sees the same weather at the same moment. The HUD can force a weather ("override",
// blended in over a few seconds, like his override.start).
const remapClamp = (v, a, b, c, d) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return c + (d - c) * t;
};
const lerp = (a, b, t) => a + (b - a) * t;
const noise = (x) => Math.sin(x) * Math.sin(x * 1.678) * Math.sin(x * 2.345); // his

// Year presets and their stops (his YearCycles)
const SEASONS = {
  winter: { temperature: 5, humidity: 0.8, clouds: 0.65, wind: 0.3 },
  spring: { temperature: 15, humidity: 0.65, clouds: 0.45, wind: 0.2 },
  summer: { temperature: 25, humidity: 0.5, clouds: 0.3, wind: 0.1 },
  fall: { temperature: 15, humidity: 0.65, clouds: 0.65, wind: 0.25 },
};
const YEAR_KEYS = [["fall", -0.125], ["winter", 0.125], ["spring", 0.375], ["summer", 0.625], ["fall", 0.875], ["winter", 1.125]];
function season(p) {
  let i = 0;
  while (i < YEAR_KEYS.length - 2 && YEAR_KEYS[i + 1][1] <= p) i++;
  const [ka, sa] = YEAR_KEYS[i], [kb, sb] = YEAR_KEYS[i + 1];
  const k = THREE.MathUtils.smoothstep(p, sa, sb), a = SEASONS[ka], b = SEASONS[kb];
  return Object.fromEntries(Object.keys(a).map((key) => [key, lerp(a[key], b[key], k)]));
}

// Forced weathers for the HUD (values he'd reach in those conditions)
export const MODES = ["Auto", "Clear", "Rain", "Storm", "Snow"];
const OVERRIDES = {
  Clear: { humidity: 0.4, clouds: -0.5, electricField: 0, wind: 0.15 },
  Rain: { humidity: 0.95, clouds: 0.9, electricField: 0, wind: 0.5, temperature: 12 },
  Storm: { humidity: 1, clouds: 1, electricField: 1, wind: 0.9, temperature: 14 },
  Snow: { humidity: 0.95, clouds: 0.85, electricField: 0, wind: 0.35, temperature: -8 },
};

export const weather = {
  temperature: 15, humidity: 0.6, clouds: 0, wind: 0.3, electricField: 0,
  rain: 0, snow: -1,
  snowCover: 0,          // smoothed 0..1 ground coverage (snow settles and melts over time)
  wet: 0,                // smoothed 0..1 wet ground after rain
  storm: 0,              // lightning likelihood 0..1
  flash: 0,              // lightning flash 0..1 (decays quickly)
  mode: "Auto",
  override: { from: null, to: null, k: 1 }, // blend from a snapshot towards the forced values
};

const KEYS = ["temperature", "humidity", "clouds", "wind", "electricField"];
export function setWeatherMode(mode) {
  weather.mode = mode;
  const o = weather.override;
  o.from = Object.fromEntries(KEYS.map((k) => [k, weather[k]]));
  o.to = mode === "Auto" ? null : OVERRIDES[mode];
  o.k = 0;
  gsap.to(o, { k: 1, duration: 4, ease: "power1.inOut", overwrite: true });
}
export const nextWeatherMode = () => setWeatherMode(MODES[(MODES.indexOf(weather.mode) + 1) % MODES.length]);

let last = performance.now();
export function updateWeather() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const t = cycle.absolute;
  const yearP = (Date.now() / 1000 / (60 * 60 * 24 * 365)) % 1;
  const year = season(yearP);
  const o = weather.override;
  const mix = (key, auto) => {
    const target = o.to && o.to[key] !== undefined ? o.to[key] : auto;
    return o.from ? lerp(o.from[key], target, o.k) : target;
  };

  weather.temperature = mix("temperature", year.temperature + cycle.temperature + noise(t * 0.4) * 7.5);
  weather.humidity = mix("humidity", year.humidity + noise(t * 0.36) * 0.2);
  weather.electricField = mix("electricField", cycle.electricField * noise(t * 0.53));
  weather.clouds = mix("clouds", noise(t * 0.44));
  weather.wind = mix("wind", noise(t) * 0.5 + 0.5);
  weather.rain = remapClamp(weather.humidity, 0.65, 1, 0, 1) * remapClamp(weather.clouds, 0, 1, 0, 1);
  const rainRatio = remapClamp(weather.rain, 0.05, 0.3, 0, 1);
  const freezeRatio = remapClamp(weather.temperature, 0, -5, 0, 1);
  const meltRatio = remapClamp(weather.temperature, 0, 10, 0, -1);
  weather.snow = rainRatio * freezeRatio + meltRatio;
  weather.storm = Math.max(0, weather.clouds) * Math.max(0, weather.electricField) * weather.humidity; // his lightning chance

  // Ground: snow settles slowly while it snows and melts when it's warm; the ground dries after rain
  const target = Math.max(0, weather.snow);
  weather.snowCover += (weather.snow > 0 ? Math.min(target - weather.snowCover, dt * 0.08) : Math.max(weather.snow, -1) * dt * 0.05);
  weather.snowCover = Math.min(Math.max(weather.snowCover, 0), 1);
  const raining = weather.rain * (weather.snow > 0.2 ? 0 : 1);
  weather.wet += (raining > 0.1 ? 1 : -1) * dt * (raining > 0.1 ? 0.2 : 0.03);
  weather.wet = Math.min(Math.max(weather.wet, 0), 1);
  weather.flash *= Math.exp(-dt * 9);
  return weather;
}
