"use client";
import { forwardRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Effect, EffectAttribute, EffectPass } from "postprocessing";
import * as THREE from "three";
import { cycle } from "./dayCycle";
import { weather } from "./weather";

const FLASH = new THREE.Color(0.85, 0.9, 1.2);

// "Diorama reveal" post effect (the intro look), adapted from Bruno Simon's folio-2025 (MIT):
// only a circle of the world around the spawn is visible; everything else is a dark void with a
// purple grid. Each pixel's world position is rebuilt from the depth buffer, so anything crossing
// the circle is sliced cleanly and its cut edge glows. While assets load, a ring fills clockwise
// around the spot; animating the radius outwards reveals the whole island.
// It also draws Bruno's atmosphere: there is no sky; fog fades everything by view distance into a
// screen-space gradient (his Fog.js), and that same gradient is the background.
const fragment = /* glsl */ `
  uniform vec3 uFogA;       // gradient colour at the top-left of the screen
  uniform vec3 uFogB;       // … and towards the bottom-right
  uniform vec2 uFogRange;   // near / far view distance
  uniform float uRadius;
  uniform vec2 uCenter;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;
  uniform vec3 uCamPos;
  uniform vec3 uRimColor;   // HDR, so bloom picks it up
  uniform float uRing;      // loader progress 0..1
  uniform float uRingR;     // loader ring radius (0 once hidden)

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    // View-space ray through this pixel, then into world space
    vec4 vr = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
    vec3 viewDir = vr.xyz / vr.w;
    vec3 dir = normalize(mat3(uCamWorld) * viewDir);

    // Where the ray hits the ground plane (for the void grid and the loader ring)
    float tG = dir.y < -1e-4 ? -uCamPos.y / dir.y : 1e5;
    vec3 ground = uCamPos + dir * tG;

    // World position of whatever was drawn here: raw depth → view Z → point along the ray.
    // Background (sky) pixels use the ground point instead.
    vec3 world = ground;
    if (depth < 0.9999) {
      float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
      world = (uCamWorld * vec4(viewDir * (viewZ / viewDir.z), 1.0)).xyz;
    }
    // Atmosphere: distance fog into the screen gradient; the background is pure gradient
    vec3 fogCol = mix(uFogA, uFogB, smoothstep(0.0, 1.3, length(uv - vec2(0.0, 1.0))));
    float fog = depth < 0.9999 ? smoothstep(uFogRange.x, uFogRange.y, length(world - uCamPos)) : 1.0;
    vec3 sceneCol = mix(inputColor.rgb, fogCol, fog);
    if (uRadius > 2000.0) { outputColor = vec4(sceneCol, inputColor.a); return; }   // fully revealed

    float dObj = length(world.xz - uCenter);

    // Void: near-black with thin mauve grid lines and purple × marks, fading with distance
    vec2 g = ground.xz / 6.0;
    vec2 cell = abs(fract(g - 0.5) - 0.5);
    float aa = max(fwidth(g.x), fwidth(g.y));
    float detail = smoothstep(0.3, 0.06, aa);              // fade out where the grid gets sub-pixel
    float line = (1.0 - smoothstep(0.0, aa * 1.5, min(cell.x, cell.y))) * detail;
    vec2 c = fract(g * 2.0) - 0.5;                          // × at every half cell
    float cross = 1.0 - smoothstep(0.0, aa * 3.0, min(abs(c.x - c.y), abs(c.x + c.y)));
    cross *= step(max(abs(c.x), abs(c.y)), 0.09) * detail;
    float fade = exp(-tG * 0.012);
    // (linear colour; these are #1b191f, #675369 and #8d55ff)
    vec3 voidCol = vec3(0.0103, 0.0098, 0.0137)
      + vec3(0.133, 0.087, 0.141) * line * 0.5 * fade
      + vec3(0.266, 0.091, 1.0) * cross * 0.55 * fade;

    // Loader ring on the void floor, filling clockwise with the load progress
    vec2 rel = ground.xz - uCenter;
    float dGround = length(rel);
    float ringW = 0.06 + tG * 0.0025;
    float ring = (1.0 - smoothstep(ringW * 0.5, ringW, abs(dGround - uRingR))) * step(0.01, uRingR);
    float ang = 1.0 - (atan(rel.x, -rel.y) / 6.2831853 + 0.5);
    ring *= step(ang, uRing);
    voidCol = mix(voidCol, uRimColor, ring);

    // Inside the circle: the scene, with a solid glowing band where surfaces are cut
    float fw = max(fwidth(dObj), 0.002);
    float inside = 1.0 - smoothstep(uRadius - fw, uRadius, dObj);
    float band = smoothstep(uRadius - 0.11 - fw, uRadius - 0.11, dObj);
    vec3 col = mix(sceneCol, uRimColor, band);
    outputColor = vec4(mix(voidCol, col, inside), inputColor.a);
  }
`;

class RevealImpl extends Effect {
  constructor() {
    super("RevealEffect", fragment, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ["uRadius", new THREE.Uniform(0)],
        ["uCenter", new THREE.Uniform(new THREE.Vector2())],
        ["uProjInv", new THREE.Uniform(new THREE.Matrix4())],
        ["uCamWorld", new THREE.Uniform(new THREE.Matrix4())],
        ["uCamPos", new THREE.Uniform(new THREE.Vector3())],
        ["uRimColor", new THREE.Uniform(new THREE.Vector3())],
        ["uRing", new THREE.Uniform(0)],
        ["uRingR", new THREE.Uniform(0)],
        ["uFogA", new THREE.Uniform(new THREE.Color())],
        ["uFogB", new THREE.Uniform(new THREE.Color())],
        ["uFogRange", new THREE.Uniform(new THREE.Vector2(28, 130))],
      ]),
    });
  }
}

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();
const hit = new THREE.Vector3();

// revealRef.current = { radius, center: [x, z], ring, ringR, mouse: [ndcX, ndcY] | null }
// — animated by the World's intro
export const Reveal = forwardRef(function Reveal({ revealRef }, ref) {
  const effect = useMemo(() => new RevealImpl(), []);
  const { camera } = useThree();
  const glow = useMemo(() => ({ hover: 1, ring: 0 }), []);
  useFrame((_, dt) => {
    const u = effect.uniforms, r = revealRef.current;
    camera.updateMatrixWorld(); // the camera moved this frame; its matrix must match its position

    // Hovering the diorama brightens its rim (the pointer comes from the DOM intro overlay)
    let over = false;
    if (r.mouse && !r.started && r.radius > 1) {
      ray.setFromCamera({ x: r.mouse[0], y: r.mouse[1] }, camera);
      if (ray.ray.intersectPlane(plane, hit)) over = Math.hypot(hit.x - r.center[0], hit.z - r.center[1]) < r.radius;
    }
    r.over = over;
    glow.hover = THREE.MathUtils.damp(glow.hover, over ? 1.22 : 1, 12, dt);
    glow.ring = THREE.MathUtils.damp(glow.ring, r.ring ?? 0, 10, dt); // smoothed loader progress

    u.get("uRadius").value = r.radius;
    u.get("uCenter").value.set(r.center[0], r.center[1]);
    u.get("uProjInv").value.copy(camera.projectionMatrixInverse);
    u.get("uCamWorld").value.copy(camera.matrixWorld);
    u.get("uCamPos").value.copy(camera.position);
    // Fog gradient, fog range and rim colour follow the day / night cycle
    u.get("uFogA").value.copy(cycle.fogA);
    u.get("uFogB").value.copy(cycle.fogB);
    // rain and snow close the fog in; a lightning strike lights it up
    const murk = Math.max(weather.rain * 0.45, Math.max(weather.snow, 0) * 0.55);
    u.get("uFogRange").value.set(cycle.fogRange.x - 40 * murk, cycle.fogRange.y * (1 - murk)); // (near can be negative at night)
    if (weather.flash > 0.01) { u.get("uFogA").value.lerp(FLASH, weather.flash * 0.6); u.get("uFogB").value.lerp(FLASH, weather.flash * 0.6); }
    const k = 3 * glow.hover;
    u.get("uRimColor").value.set(cycle.reveal.r * k, cycle.reveal.g * k, cycle.reveal.b * k); // (a Vector3: copy() from a Color would give NaN)
    u.get("uRing").value = glow.ring;
    u.get("uRingR").value = r.ringR ?? 0;
  });
  // Its own pass, after the bloom pass: inside one merged pass the bloom was still added on top
  // and lights outside the intro circle glowed through the void
  const pass = useMemo(() => new EffectPass(camera, effect), [camera, effect]);
  return <primitive ref={ref} object={pass} dispose={null} />;
});
