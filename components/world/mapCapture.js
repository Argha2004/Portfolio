"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ISLAND_R } from "./zones";

// ───────── Map picture, like Bruno Simon's (folio-2025, MIT: Map.js) ─────────
// His map modal shows a top-down render of his world (a day and a night version). Ours is
// rendered from the live scene when the map opens: an orthographic camera straight above the
// island, north up, so it always matches the time of day, the weather and whatever got blown up.
// Things flagged `userData.noMap` (rain lines, lightning) are hidden for the shot.
export const MAP_HALF = ISLAND_R + 25;          // the picture covers ±MAP_HALF metres
const SIZE = 1024;
const SAT = 0.7;                               // saturation kept in the picture

let shoot = null;
export const requestMapShot = () => (shoot ? shoot() : Promise.resolve(null));
export const worldToMap = (x, z) => ({ u: Math.min(Math.max(x / (2 * MAP_HALF) + 0.5, 0), 1), v: Math.min(Math.max(z / (2 * MAP_HALF) + 0.5, 0), 1) });

export function MapCapture() {
  const { gl, scene } = useThree();
  useEffect(() => {
    // float target: keeps the HDR range so the tone curve below handles bright spots like the game does
    const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4, type: THREE.FloatType });
    const cam = new THREE.OrthographicCamera(-MAP_HALF, MAP_HALF, MAP_HALF, -MAP_HALF, 1, 800);
    cam.position.set(0, 400, 0);
    cam.up.set(0, 0, -1);                         // north (−Z) at the top
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const pixels = new Float32Array(SIZE * SIZE * 4);
    // the render target holds linear colour without tone mapping: apply the same ACES filmic curve
    // the game uses (Narkowicz fit, per channel) and the sRGB transfer for the image
    const aces = (x) => Math.min(Math.max((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0), 1);
    // (as a lookup table over 0…4 in linear light, so a million pixels convert quickly)
    const LUT_N = 4096, LUT_MAX = 4, lut = new Uint8ClampedArray(LUT_N);
    for (let i = 0; i < LUT_N; i++) { const t = aces((i / (LUT_N - 1)) * LUT_MAX * 0.8); lut[i] = 255 * (t <= 0.0031308 ? 12.92 * t : 1.055 * Math.pow(t, 1 / 2.4) - 0.055); }
    const toSRGB = (x) => lut[Math.min(LUT_N - 1, Math.max(0, (x * ((LUT_N - 1) / LUT_MAX)) | 0))];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    shoot = () => new Promise((resolve) => {
      const hidden = [];
      scene.traverse((o) => { if (o.userData.noMap && o.visible) { o.visible = false; hidden.push(o); } });
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, cam);
      gl.setRenderTarget(prev);
      hidden.forEach((o) => (o.visible = true));
      gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
      const img = ctx.createImageData(SIZE, SIZE), d = img.data;
      for (let y = 0; y < SIZE; y++) {                 // rows come bottom-up
        const src = (SIZE - 1 - y) * SIZE * 4, dst = y * SIZE * 4;
        for (let x = 0; x < SIZE * 4; x += 4) {
          // (the game's fog and grade mute colours; without them the raw render is too saturated)
          const r = pixels[src + x], g = pixels[src + x + 1], b = pixels[src + x + 2], l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          d[dst + x] = toSRGB(l + (r - l) * SAT); d[dst + x + 1] = toSRGB(l + (g - l) * SAT); d[dst + x + 2] = toSRGB(l + (b - l) * SAT); d[dst + x + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    });
    return () => { shoot = null; target.dispose(); };
  }, [gl, scene]);
  return null;
}
