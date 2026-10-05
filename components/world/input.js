"use client";
import { useEffect } from "react";

// Shared, mutable input state read every frame by the car (no React re-renders).
// reset = back to the spawn point; flip = put the car back on its wheels where it is
export const input = { f: 0, b: 0, l: 0, r: 0, boost: false, brake: false, joyX: 0, joyY: 0, reset: false, flip: false, teleport: null, locked: false };
// teleport = { x, z, yaw } — set by the "Race track" button to drop the car on the grid
// locked = an area (e.g. the projects board) has the keys; the car holds still
const KEYS = {
  KeyW: "f", ArrowUp: "f",
  KeyS: "b", ArrowDown: "b",
  KeyA: "l", ArrowLeft: "l",
  KeyD: "r", ArrowRight: "r",
};

export function useKeyboard(enabled) {
  useEffect(() => {
    if (!enabled) return;
    const set = (e, down) => {
      if (e.target.closest?.("input, textarea")) return;
      const k = KEYS[e.code];
      if (k) { input[k] = down ? 1 : 0; e.preventDefault(); }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.boost = down;
      if (e.code === "Space") { input.brake = down; e.preventDefault(); }
      if (e.code === "KeyR" && down) input.flip = true;
      if (e.code === "KeyH" && down && !e.repeat) input.honk = true;
    };
    const down = (e) => set(e, true);
    const up = (e) => set(e, false);
    // Releasing everything on blur stops the car driving off on its own after alt-tab
    const blur = () => Object.assign(input, { f: 0, b: 0, l: 0, r: 0, boost: false, brake: false });
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", blur);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", blur); blur(); };
  }, [enabled]);
}
