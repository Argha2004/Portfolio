import { useGLTF, useTexture } from "@react-three/drei";
import { MODELS, TEXTURES, PROJECT_SHOTS } from "./assets";

// Every model and texture the world needs, fetched in parallel the moment the scene code loads
// (like Bruno Simon's resources loader). Without this each component only asks for its model
// when it first renders, so the loads chain one after another behind Suspense: ~60 round trips
// plus a re-render each, which kept the intro ring filling for a long time.
// The page's HTML already started these downloads (World.js), so most come from the preload cache.
let started = false;
export function preloadWorld() {
  if (started || typeof window === "undefined") return;
  started = true;
  useGLTF.setDecoderPath("/draco/");
  MODELS.forEach((url) => useGLTF.preload(url));
  TEXTURES.forEach((url) => useTexture.preload(url));
  useTexture.preload(PROJECT_SHOTS); // (same array key as the projects board's useTexture)
}
