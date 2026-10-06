import * as THREE from "three";

// ───────── Graphics card selection ─────────
// A web page can't pick a GPU itself; it can only ask. Every WebGL context here asks for the
// "high-performance" GPU (the dedicated card on laptops with two), and the browser falls back to
// the integrated one when there's no dedicated card. If even that request fails (old drivers,
// blocklisted GPU), the renderer retries with default settings instead of showing nothing.

export const GPU_REQUEST = { powerPreference: "high-performance", failIfMajorPerformanceCaveat: false };

// Renderer factory for <Canvas gl={createRenderer}>: dedicated GPU first, then the default one
export function createRenderer(defaults) {
  try {
    return new THREE.WebGLRenderer({ ...defaults, ...GPU_REQUEST, antialias: false });
  } catch (e) {
    console.warn("High-performance WebGL context failed, falling back to the default GPU.", e);
    return new THREE.WebGLRenderer({ ...defaults, antialias: false, powerPreference: "default" });
  }
}

// Which GPU the browser actually gives us, and whether it's a dedicated card.
// Uses a throwaway context (released straight away) with the same request as the renderer.
const INTEGRATED = /(intel|uhd|iris|hd graphics|apple|mali|adreno|powervr|videocore|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|llvmpipe|swiftshader|software|microsoft basic)/i;
const DEDICATED = /(nvidia|geforce|rtx|gtx|quadro|tesla|radeon (rx|pro|r\d|hd \d{4}m?)|radeon\(tm\) (rx|pro)|firepro|intel\(r\) arc|\barc a\d)/i;

export function detectGpu() {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", GPU_REQUEST) || canvas.getContext("webgl", GPU_REQUEST);
    if (!gl) return { name: "No WebGL", dedicated: false, known: false };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    // "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x…) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3060 Laptop GPU"
    const angle = raw.match(/ANGLE \([^,]*,\s*([^,(]+(?:\([^)]*\)[^,(]*)*)/);
    const name = (angle ? angle[1] : raw).replace(/^ANGLE Metal Renderer:\s*/i, "").replace(/\s*\(0x[0-9a-f]+\)/i, "").replace(/\s+(Direct3D|OpenGL|Vulkan|Metal).*$/i, "").trim() || "Unknown GPU";
    const dedicated = DEDICATED.test(raw) && !/radeon\(tm\) graphics/i.test(raw);
    const known = dedicated || INTEGRATED.test(raw);
    // lowPower: integrated graphics that should start on lighter settings (Apple Silicon copes fine)
    return { name, dedicated, known, lowPower: known && !dedicated && !/apple/i.test(raw) };
  } catch {
    return null;
  }
}
