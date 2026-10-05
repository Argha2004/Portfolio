"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";

// Full-screen glossy liquid surface (raw WebGL).
// Height field = domain-warped fBm + ripples dropped by the cursor; normals come from finite
// differences and are lit with diffuse + specular + fresnel, which reads as molten satin.
// Only sections marked [data-liquid] are transparent, so it shows through the hero and contact.
const MAX_RIPPLES = 12;
const DEFAULT_COLOR = "#d6321d";

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uColor;
uniform vec4 uRipples[${MAX_RIPPLES}]; // xy = position (0..1), z = start time, w = strength

vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1. + 2. * fract(sin(p) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p; a *= .5; } return v; }

float height(vec2 uv){
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.) * 1.6;
  float t = uTime * .08;
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2) + t * 1.2), fbm(p + 2.2 * q + vec2(8.3, 2.8) - t));
  float h = fbm(p + 2.4 * r);
  // Ripples from the cursor
  for (int i = 0; i < ${MAX_RIPPLES}; i++){
    vec4 rp = uRipples[i];
    if (rp.w <= 0.) continue;
    float age = uTime - rp.z;
    vec2 d = (uv - rp.xy) * vec2(uRes.x / uRes.y, 1.);
    float dist = length(d);
    h += rp.w * sin(38. * dist - 9. * age) * exp(-7. * dist) * exp(-1.4 * age) * smoothstep(0., .15, age);
  }
  return h;
}

void main(){
  vec2 e = vec2(1.5 / uRes.y, 0.);
  float h = height(vUv);
  // Forward differences: 3 height samples per pixel instead of 5
  float hx = (height(vUv + e.xy) - h) * 2.;
  float hy = (height(vUv + e.yx) - h) * 2.;
  vec3 n = normalize(vec3(-hx * 26., -hy * 26., 1.));
  vec3 l = normalize(vec3(-.45, .55, .7));
  vec3 v = vec3(0., 0., 1.);
  float diff = clamp(dot(n, l), 0., 1.);
  float spec = pow(max(dot(reflect(-l, n), v), 0.), 70.);
  float spec2 = pow(max(dot(reflect(-normalize(vec3(.6, -.3, .8)), n), v), 0.), 18.) * .25;
  float fres = pow(1. - max(n.z, 0.), 2.);
  vec3 base = uColor * (.28 + .9 * diff) * (.75 + h * .6);
  vec3 col = base + vec3(1., .96, .92) * (spec * .9 + spec2) + uColor * fres * .6;
  // Vignette + a touch of grain so it never looks like flat CG
  col *= 1. - .35 * length(vUv - .5);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453) - .5) * .035;
  gl_FragColor = vec4(col, 1.);
}`;

export default function Liquid() {
  const ref = useRef();
  const pathname = usePathname();
  const color = useRef({ r: 0.84, g: 0.2, b: 0.11 });

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) { canvas.style.display = "none"; return; }

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "p");
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(["uTime", "uRes", "uColor", "uRipples"].map((k) => [k, gl.getUniformLocation(prog, k)]));

    // The liquid is smooth, so render below native resolution and let CSS upscale it
    const SCALE = 0.55;
    const resize = () => {
      canvas.width = Math.round(innerWidth * SCALE);
      canvas.height = Math.round(innerHeight * SCALE);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
    };
    resize();
    addEventListener("resize", resize);

    const ripples = new Float32Array(MAX_RIPPLES * 4);
    let next = 0, lastDrop = 0, last = null;
    const start = performance.now();
    const now = () => (performance.now() - start) / 1000;
    const drop = (x, y, strength) => {
      ripples.set([x, y, now(), strength], next * 4);
      next = (next + 1) % MAX_RIPPLES;
    };
    const onMove = (e) => {
      const x = e.clientX / innerWidth, y = 1 - e.clientY / innerHeight;
      const t = now();
      if (last && t - lastDrop > 0.07) {
        const speed = Math.hypot(x - last[0], y - last[1]);
        if (speed > 0.002) { drop(x, y, Math.min(0.02 + speed * 0.9, 0.09)); lastDrop = t; }
      }
      last = [x, y];
    };
    const onDown = (e) => drop(e.clientX / innerWidth, 1 - e.clientY / innerHeight, 0.16);
    addEventListener("pointermove", onMove);
    addEventListener("pointerdown", onDown);

    // Only render while a liquid section is on screen
    let visible = true, raf;
    const watch = () => {
      const io = new IntersectionObserver((entries) => {
        visible = [...document.querySelectorAll("[data-liquid]")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight;
        });
      });
      document.querySelectorAll("[data-liquid]").forEach((el) => io.observe(el));
      return io;
    };
    let io = watch();
    const rewatch = () => { io.disconnect(); io = watch(); };
    window.addEventListener("liquid:rescan", rewatch);

    const frame = () => {
      if (visible) {
        gl.uniform1f(U.uTime, now());
        gl.uniform3f(U.uColor, color.current.r, color.current.g, color.current.b);
        gl.uniform4fv(U.uRipples, ripples);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      window.removeEventListener("liquid:rescan", rewatch);
    };
  }, []);

  // Each page can tint the liquid with data-liquid-color; tween to it on navigation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const hex = document.querySelector("[data-liquid-color]")?.dataset.liquidColor || DEFAULT_COLOR;
      const n = parseInt(hex.slice(1), 16);
      gsap.to(color.current, { r: (n >> 16) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, duration: 1.2, ease: "power2.out" });
      window.dispatchEvent(new Event("liquid:rescan"));
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return <canvas ref={ref} className="liquid" aria-hidden="true" />;
}
