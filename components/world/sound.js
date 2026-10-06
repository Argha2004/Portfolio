"use client";
import { cycle, onCycle } from "./dayCycle";
import { weather } from "./weather";

// ───────── Sound ─────────
// Music: Bruno Simon's three folio-2025 tracks (CC0, /public/sounds/music/LICENSE-CC0.md), played
// like his playlist: the starting song depends on the clock, each one plays through, a little
// "disc change" plays and the next starts after a short pause, with a "Now playing" notice.
//
// Effects are synthesised with the Web Audio API. (His effect files come from commercial sound
// libraries that his MIT licence can't pass on, so these cover the same palette instead.)
//   engine · skid · impact/hit (stone, wood, metal) · explosion · whoosh · chime · paper rustle
//   board click / slide · anvil strike · horn · splash · reveal swell
//   ambience: wind in the trees, bird calls by day, water lapping near ponds
//   night (his day-cycle audio): crickets, owl hoots, a wolf howl at deep night, a rooster at dawn
//   weather: rain on the leaves, thunder after lightning, wind gusting with the weather
// Browsers only allow audio after a user gesture, so start() runs from the intro click.
const SONGS = [
  { name: "Sudo", src: "/sounds/music/Sudo.mp3" },
  { name: "Boy", src: "/sounds/music/Boy.mp3" },
  { name: "Baguira", src: "/sounds/music/Baguira.mp3" },
];
const MUSIC_VOLUME = 0.2; // his playlist volume
const MASTER = 0.55;

class Sfx {
  ctx = null;
  muted = false;
  musicOn = true;
  lastImpact = 0;
  lastHit = {};
  listeners = new Set();

  start() {
    if (this.ctx) { this.ctx.resume(); this.playMusic(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER;
    this.master.connect(ctx.destination);

    // Shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Engine: a soft, low electric-toy hum instead of a buzzing combustion engine. Rounded waves
    // (triangle + sine sub, a quiet sine overtone) through a gentle low-pass, with a slow "chug"
    // tremolo; almost silent while idle so it never drones when the car is parked.
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = "lowpass"; this.engFilter.frequency.value = 300; this.engFilter.Q.value = 0.6;
    this.osc1 = ctx.createOscillator(); this.osc1.type = "triangle";
    this.osc2 = ctx.createOscillator(); this.osc2.type = "sine";      // sub, an octave down
    this.osc3 = ctx.createOscillator(); this.osc3.type = "sine";      // soft overtone
    const o3 = ctx.createGain(); o3.gain.value = 0.18;
    this.osc1.connect(this.engFilter); this.osc2.connect(this.engFilter); this.osc3.connect(o3).connect(this.engFilter);
    this.chug = ctx.createGain(); this.chug.gain.value = 1;
    this.engFilter.connect(this.chug).connect(this.engGain).connect(this.master);
    this.lfo = ctx.createOscillator(); this.lfo.type = "sine"; this.lfo.frequency.value = 9;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 0.18;
    this.lfo.connect(this.lfoDepth).connect(this.chug.gain);
    [this.osc1, this.osc2, this.osc3, this.lfo].forEach((o) => o.start());
    // Tyre / road rumble that grows with speed (soft low noise, gives a sense of motion)
    this.roadGain = this.loopNoise({ type: "lowpass", freq: 160, q: 0.5 });

    // Skid
    this.skidGain = this.loopNoise({ type: "bandpass", freq: 1800, q: 2.5 });

    // Ambience: wind (low, slowly breathing) and water lapping (only near ponds)
    this.windGain = this.loopNoise({ type: "lowpass", freq: 520, q: 0.4 });
    this.windGain.gain.value = 0.05;
    this.waterGain = this.loopNoise({ type: "bandpass", freq: 700, q: 0.8 });
    this.rainGain = this.loopNoise({ type: "bandpass", freq: 3200, q: 0.5 });
    this.water = 0;
    this.scheduleBirds();
    this.setupNight();

    this.reveal();
    this.playMusic();
  }

  loopNoise({ type, freq, q }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start(0, Math.random() * 2);
    return g;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.05);
    this.applyMusic();
  }

  // ── Music playlist ──
  onSong(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get song() { return this.current ? SONGS[this.index].name : null; }

  playMusic() {
    if (this.audio) { this.applyMusic(); return; }
    this.index = Math.floor(Date.now() / 1000 / 60 / 3) % SONGS.length; // a different song every few minutes, like his
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.addEventListener("ended", () => this.nextSong());
    this.loadSong();
  }

  loadSong() {
    const s = SONGS[this.index];
    this.audio.src = s.src;
    this.current = s;
    this.applyMusic();
    this.listeners.forEach((fn) => fn(s.name));
  }

  nextSong() {
    if (this.switching) return;
    this.switching = true;
    this.audio.pause();
    this.discChange();
    setTimeout(() => {
      this.index = (this.index + 1) % SONGS.length;
      this.loadSong();
      this.switching = false;
    }, 3000);
  }

  setMusic(on) { this.musicOn = on; this.applyMusic(); }

  applyMusic() {
    if (!this.audio) return;
    this.audio.volume = MUSIC_VOLUME;
    if (this.musicOn && !this.muted) this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  // ── Per frame (from the car) ──
  update({ speed, throttle, boost, slip, water = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = Math.min(Math.abs(speed) / 24, 1.2);
    const th = Math.abs(throttle);
    const base = 42 + s * 62 + (boost ? 14 : 0) + th * 6;
    this.osc1.frequency.setTargetAtTime(base, t, 0.12);
    this.osc2.frequency.setTargetAtTime(base * 0.5, t, 0.12);
    this.osc3.frequency.setTargetAtTime(base * 2.01, t, 0.12);
    this.lfo.frequency.setTargetAtTime(6 + s * 14, t, 0.2);              // chug speeds up with the car
    this.engFilter.frequency.setTargetAtTime(220 + s * 520 + th * 160, t, 0.15);
    const moving = Math.min(s * 4, 1);                                     // fades in as soon as it rolls
    this.engGain.gain.setTargetAtTime(0.008 + moving * (0.022 + s * 0.03) + th * 0.012, t, 0.18);
    this.roadGain.gain.setTargetAtTime(Math.min(s, 1) * 0.05, t, 0.2);
    this.skidGain.gain.setTargetAtTime(Math.min(Math.max(slip - 0.35, 0) * 0.5, 0.28), t, 0.05);
    // wind breathes slowly, a bit louder at speed
    const gust = 0.6 + weather.wind * 0.9 + Math.max(weather.snow, 0) * 0.3;
    const breath = (0.035 + 0.025 * (Math.sin(t * 0.37) * 0.5 + 0.5)) * gust + s * 0.03;
    // rain hiss (not while it snows)
    this.rainGain.gain.setTargetAtTime(weather.rain * (weather.snow > 0.2 ? 0 : 1) * 0.14, t, 0.6);
    this.windGain.gain.setTargetAtTime(breath, t, 0.5);
    // water lapping: a slow swell, only when a pond is close
    this.waterGain.gain.setTargetAtTime(water * (0.05 + 0.04 * Math.sin(t * 1.3)), t, 0.3);
  }

  // ── One-shots ──
  burst({ freq = 600, q = 1, dur = 0.25, gain = 0.4, sweepTo, type = "bandpass", delay = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur);
  }

  tone({ freq, type = "sine", dur = 0.4, gain = 0.15, delay = 0, to, attack = 0.01 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  impact(force) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastImpact < 90) return;
    this.lastImpact = now;
    const k = Math.min(force, 1);
    this.burst({ freq: 300 + Math.random() * 400, q: 0.8, dur: 0.18 + k * 0.2, gain: 0.15 + k * 0.45 });
    this.tone({ freq: 110, to: 40, dur: 0.25, gain: 0.25 * k + 0.05, attack: 0.003 });
  }

  // Objects knocked around: stone (bricks), wood (fences, benches), metal (signs, cans)
  hit(kind = "stone", force = 0.5) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - (this.lastHit[kind] || 0) < 70) return;
    this.lastHit[kind] = now;
    const k = Math.min(Math.max(force, 0.1), 1);
    if (kind === "wood") {
      this.burst({ freq: 900 + Math.random() * 300, q: 4, dur: 0.12, gain: 0.25 * k });
      this.tone({ freq: 220 + Math.random() * 60, dur: 0.12, gain: 0.12 * k, type: "triangle", attack: 0.002 });
    } else if (kind === "metal") {
      [1, 2.76, 5.4].forEach((m, i) => this.tone({ freq: 420 * m, dur: 0.5 - i * 0.12, gain: 0.08 * k / (i + 1), type: "sine", attack: 0.002 }));
    } else {
      this.burst({ freq: 500 + Math.random() * 500, q: 1.5, dur: 0.14 + k * 0.1, gain: 0.3 * k });
      this.tone({ freq: 90, to: 50, dur: 0.15, gain: 0.12 * k, attack: 0.002 });
    }
  }

  // Armed bomb: a sharp metallic tick-tick just before it blows (his trigger click)
  fuse() {
    if (!this.ctx) return;
    [0, 0.13].forEach((d) => {
      this.tone({ freq: 2600 + Math.random() * 400, dur: 0.05, gain: 0.07, type: "square", attack: 0.001, delay: d });
      this.burst({ freq: 5200, q: 6, dur: 0.03, gain: 0.12, delay: d });
    });
  }

  explosion(distance = 0) {
    if (!this.ctx) return;
    const k = Math.max(0.12, 1 - distance / 70); // quieter the further the blast is from the car
    if (k <= 0.12 && distance > 90) return;
    // sharp crack, the big boom, a long sub-bass rumble, then debris rattling down
    this.burst({ freq: 3200, q: 0.4, dur: 0.12, gain: 0.7 * k, type: "highpass" });
    this.burst({ freq: 1600, q: 0.3, dur: 1.6, gain: 0.95 * k, sweepTo: 90, type: "lowpass" });
    this.burst({ freq: 260, q: 0.6, dur: 0.8, gain: 0.6 * k });
    this.tone({ freq: 62, to: 22, dur: 1.6, gain: 0.6 * k, attack: 0.004 });
    this.tone({ freq: 110, to: 40, dur: 0.5, gain: 0.3 * k, type: "triangle", attack: 0.003 });
    this.burst({ freq: 420, q: 0.4, dur: 2.4, gain: 0.18 * k, sweepTo: 60, type: "lowpass", delay: 0.25 }); // rumble tail
    for (let i = 0; i < 7; i++) {
      const d = 0.35 + Math.random() * 1.4;
      this.burst({ freq: 700 + Math.random() * 1600, q: 3, dur: 0.06 + Math.random() * 0.06, gain: (0.08 + Math.random() * 0.1) * k, delay: d });
    }
  }

  whoosh() { if (this.ctx) this.burst({ freq: 400, q: 1.2, dur: 0.6, gain: 0.22, sweepTo: 2400 }); }

  chime() {
    if (!this.ctx) return;
    this.tone({ freq: 880, dur: 0.7, gain: 0.16, attack: 0.02 });
    this.tone({ freq: 1320, dur: 0.7, gain: 0.16, attack: 0.02, delay: 0.11 });
  }

  // Interactive point opening / closing (his paper movement sounds)
  paper(open = true) {
    if (!this.ctx) return;
    this.burst({ freq: open ? 2600 : 1800, q: 0.9, dur: 0.22, gain: 0.12, sweepTo: open ? 4200 : 1200, type: "bandpass" });
    this.burst({ freq: 5200, q: 2, dur: 0.08, gain: 0.05, delay: 0.05, type: "highpass" });
  }

  // Projects board: mechanical click + a sliding plank
  click() { if (this.ctx) { this.burst({ freq: 3200, q: 6, dur: 0.04, gain: 0.25 }); this.tone({ freq: 1800, dur: 0.05, gain: 0.05, type: "square", attack: 0.001 }); } }
  slide() { if (this.ctx) this.burst({ freq: 500, q: 1.2, dur: 0.45, gain: 0.12, sweepTo: 1300 }); }

  // Forge: anvil strike, an inharmonic metallic ring; v = 0..1 by distance
  anvil(v = 1) {
    if (!this.ctx || v <= 0.01) return;
    this.burst({ freq: 3000, q: 3, dur: 0.05, gain: 0.25 * v });
    [[1, 0.9], [2.32, 0.6], [4.25, 0.45], [6.8, 0.3]].forEach(([m, d]) => this.tone({ freq: 640 * m, dur: d, gain: 0.07 * v, attack: 0.001 }));
  }

  honk() {
    if (!this.ctx) return;
    [349, 440].forEach((f) => this.tone({ freq: f, type: "square", dur: 0.45, gain: 0.07, attack: 0.02 }));
  }

  splash(force = 0.6) {
    if (!this.ctx) return;
    const k = Math.min(force, 1);
    this.burst({ freq: 1800, q: 0.6, dur: 0.6, gain: 0.35 * k, sweepTo: 500 });
    this.burst({ freq: 4000, q: 1.5, dur: 0.35, gain: 0.12 * k, delay: 0.08, type: "highpass" });
  }

  // Intro opening: a soft rising shimmer (his "reveal" sting)
  reveal() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ freq: f, dur: 1.6, gain: 0.07, attack: 0.25, delay: i * 0.12 }));
    this.burst({ freq: 800, q: 0.8, dur: 1.4, gain: 0.08, sweepTo: 5000 });
  }

  // Playlist: the jukebox "disc change" between songs
  discChange() {
    if (!this.ctx) return;
    this.click();
    this.burst({ freq: 300, q: 2, dur: 0.9, gain: 0.08, sweepTo: 900, delay: 0.1 });
    this.click();
  }

  // ── Night ambience ──
  setupNight() {
    const ctx = this.ctx;
    // Crickets: a generated 2 s loop of high, pulsing chirps
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let c = 0; c < 6; c++) {
      const start = Math.floor(Math.random() * len * 0.8), f = 4300 + Math.random() * 600;
      for (let p = 0; p < 4; p++) for (let i = 0; i < ctx.sampleRate * 0.03; i++) {
        const k = start + p * Math.floor(ctx.sampleRate * 0.05) + i;
        if (k < len) d[k] += Math.sin((i / ctx.sampleRate) * f * Math.PI * 2) * Math.sin((i / (ctx.sampleRate * 0.03)) * Math.PI) * 0.5;
      }
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.cricketGain = ctx.createGain(); this.cricketGain.gain.value = cycle.night ? 0.12 : 0;
    src.connect(this.cricketGain).connect(this.master); src.start();

    onCycle((name, on) => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (name === "night") {
        this.cricketGain.gain.setTargetAtTime(on ? 0.12 : 0, t, 4);
        if (!on) this.rooster();
      }
      if (name === "deepNight" && on) this.wolf();
    });
    const owls = () => {
      if (cycle.night && !this.muted && Math.random() < 0.5) this.owl();
      this.owlTimer = setTimeout(owls, 30000 + Math.random() * 60000);
    };
    this.owlTimer = setTimeout(owls, 15000);
  }

  owl() {
    if (!this.ctx) return;
    [[0, 0.5], [0.65, 0.35], [1.1, 0.7]].forEach(([d, len]) => this.tone({ freq: 400, to: 360, dur: len, gain: 0.05, attack: 0.08, delay: d }));
  }

  wolf() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(320, t); o.frequency.linearRampToValueAtTime(620, t + 0.9); o.frequency.linearRampToValueAtTime(560, t + 2.2); o.frequency.linearRampToValueAtTime(420, t + 3);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 9;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
    o.connect(g).connect(this.master); o.start(t); lfo.start(t); o.stop(t + 3.2); lfo.stop(t + 3.2);
  }

  rooster() {
    if (!this.ctx || this.muted) return;
    // "cock-a-doodle-doo": four rising/falling square bursts through a vocal-ish band-pass
    const ctx = this.ctx;
    [[0, 0.15, 520, 700], [0.2, 0.15, 620, 760], [0.4, 0.2, 700, 820], [0.65, 0.7, 820, 560]].forEach(([d, len, f0, f1]) => {
      const t = ctx.currentTime + d;
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + len);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + len + 0.02);
    });
  }

  // Thunder: a crack (near) and a long low rumble; v = 0..1 closeness
  thunder(v = 0.6) {
    if (!this.ctx) return;
    const k = Math.min(Math.max(v, 0.15), 1);
    if (k > 0.55) this.burst({ freq: 1800, q: 0.4, dur: 0.35, gain: 0.35 * k, sweepTo: 300, type: "lowpass" });
    this.burst({ freq: 260, q: 0.3, dur: 2.8, gain: 0.55 * k, sweepTo: 60, type: "lowpass", delay: 0.05 });
    this.burst({ freq: 140, q: 0.6, dur: 3.4, gain: 0.35 * k, type: "lowpass", delay: 0.6 });
  }

  // Birds: a short chirp phrase every few seconds
  scheduleBirds() {
    const next = () => {
      if (!this.ctx) return;
      if (!this.muted && !cycle.night && weather.rain < 0.2) {
        const base = 2400 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone({ freq: base * (1 + Math.random() * 0.15), to: base * (1.4 + Math.random() * 0.4), dur: 0.07 + Math.random() * 0.05, gain: 0.025, delay: i * (0.09 + Math.random() * 0.05), attack: 0.005 });
      }
      this.birdTimer = setTimeout(next, 3500 + Math.random() * 6500);
    };
    this.birdTimer = setTimeout(next, 2500);
  }
}

export const sfx = new Sfx();
