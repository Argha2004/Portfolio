"use client";
import "./brunoShading"; // must run before any material compiles
import { preloadWorld } from "./preload";
import { Suspense, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, N8AO, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { globeTags, profile } from "@/lib/data";
import Car, { SPAWN } from "./Car";
import { CAM_OFFSET, SUN_DIR, PROJECTS_SITE, SOCIAL_CENTER } from "./zones";
import { ProjectsArea, SocialArea } from "./areas";
import { GroundText, Letters } from "./Props";
import { Floor, WaterSurface, TerrainCollider } from "./terrain";
import { Particles } from "./Atmosphere";
import { BladeGrass } from "./grass";
import Roads from "./Roads";
import Circuit from "./Circuit";
import Trail from "./Trail";
import { SkillsCamp, ResearchArena, DesignGraveyard, Village, Outskirts, SpawnGarden } from "./Districts";
import { Reveal } from "./Reveal";
import { sfx } from "./sound";
import { view } from "./view";
import { cycle, updateCycle } from "./dayCycle";
import { weather, updateWeather } from "./weather";
import Precipitation from "./Precipitation";

preloadWorld(); // start every model download at once instead of one after another

const OFFSET = new THREE.Vector3(...CAM_OFFSET);

// Camera follows the car from a fixed, slightly isometric angle (like a toy diorama),
// pulling back a little at speed.
function Follow({ carRef, revealRef }) {
  const look = useRef(new THREE.Vector3(...SPAWN));
  const want = useMemo(() => new THREE.Vector3(), []);
  const zoom = useRef(1.2);
  useFrame((st, dt) => {
    const rb = carRef.current;
    if (!rb) return;
    const t = rb.translation();
    const v = rb.linvel();
    // Close-up diorama framing on the intro screen, normal chase view once driving
    const r = revealRef.current;
    const base = r.started ? 1 : r.zoom ?? 1.05;
    zoom.current = THREE.MathUtils.damp(zoom.current, base + Math.min(Math.hypot(v.x, v.z) / 26, 1) * 0.3, r.started ? 1.4 : 6, dt);
    // An area's cinematic shot (projects board) overrides the chase camera
    const cine = view.cinematic;
    const k = 1 - Math.exp(-(cine ? 2.2 : 6) * dt);
    if (cine) look.current.lerp(want.set(...cine.target), k);
    else look.current.lerp(want.set(t.x, Math.max(t.y, 0), t.z), k);
    const camTarget = cine ? want.set(...cine.position) : want.copy(OFFSET).multiplyScalar(zoom.current).add(look.current);
    st.camera.position.lerp(camTarget, 1 - Math.exp(-(cine ? 2.2 : 4) * dt));
    st.camera.lookAt(look.current);
  });
  return null;
}

// Mounts once everything inside the Suspense has loaded. Intro sequence (after Bruno Simon's
// folio-2025): the loader ring completes, shrinks away, then the diorama springs open from a point
// while the camera eases back to frame it.

function Ready({ revealRef, onReady }) {
  useEffect(() => {
    const r = revealRef.current;
    if (r.started) { onReady?.(); return; }
    r.ring = 1;
    const tl = gsap.timeline({ delay: 0.35 });
    tl.to(r, { ringR: 0, duration: 1.2, ease: "power4.in" })
      .add(() => onReady?.())
      .to(r, { radius: 7.5, duration: 2, ease: "back.out(1.7)" })
      .to(r, { zoom: 1.05, duration: 1.25, ease: "power1.inOut" }, "<");
    return () => tl.kill();
  }, [revealRef, onReady]);
  return null;
}

// Day / night cycle: advance it first each frame, then light the world from it.
// The sun's colour × intensity is the "light" and the hemisphere light's ground colour is the
// "shadow" tint of the Bruno shading patch (brunoShading.js).
function CycleDriver() {
  useFrame(() => { updateCycle(); updateWeather(); });
  return null;
}

// Shadow camera follows the car so shadows stay crisp everywhere on the island;
// the sun swings around and dips with the cycle (his Lighting.update)
const SUN_DIST = Math.hypot(...SUN_DIR);
function Sun({ carRef }) {
  const light = useRef(), hemi = useRef();
  useFrame(() => {
    // ground colour = shadow tint; sky colour carries the weather (x snow cover, y wet) to the shading patch
    if (hemi.current) { hemi.current.groundColor.copy(cycle.shadow); hemi.current.color.setRGB(weather.snowCover, weather.wet, 0); }
    const rb = carRef.current;
    if (!light.current) return;
    light.current.color.copy(cycle.light);
    light.current.intensity = cycle.lightIntensity * (1 + weather.flash * 2.5); // lightning flash
    if (!rb) return;
    const t = rb.translation(), d = cycle.sunDir;
    light.current.position.set(t.x + d.x * SUN_DIST, d.y * SUN_DIST, t.z + d.z * SUN_DIST);
    light.current.target.position.set(t.x, 0, t.z);
    light.current.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight ref={hemi} intensity={1} />
      <directionalLight ref={light} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.03}
        shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-far={100} />
    </>
  );
}

export default function Scene({ carRef, lapRef, trailRef, revealRef, zone, setZone, onDiscover, onFlipped, onReady, quality = "high" }) {
  const enter = (id) => { setZone(id); sfx.chime(); };
  const exit = (id) => setZone((z) => (z === id ? null : z));
  const high = quality === "high";
  const zp = { zone, onEnter: enter, onExit: exit };

  return (
    <Canvas shadows="soft" dpr={high ? [1, 1.5] : [1, 1]} camera={{ fov: 42, position: [SPAWN[0] + 9 * 1.2, 12 * 1.2, SPAWN[2] + 15 * 1.2], near: 0.5, far: 700 }} onCreated={({ camera }) => camera.lookAt(SPAWN[0], 0, SPAWN[2])} gl={{ antialias: false, powerPreference: "high-performance" }}>
      <CycleDriver />
      <Sun carRef={carRef} />

      <Suspense fallback={null}>

        {/* Bruno-style terrain: displaced, coloured floor + water surface (see terrain.js) */}
        <Floor />
        <WaterSurface />
        <BladeGrass focusRef={carRef} />

        <Physics gravity={[0, -20, 0]}>
          <TerrainCollider />
          <Roads />
          <SpawnGarden center={[SPAWN[0], SPAWN[2]]} />
          <Circuit carRef={carRef} lapRef={lapRef} />
          <Trail carRef={carRef} trailRef={trailRef} />

          {/* Spawn: name in physics letters on the grass beside the south avenue */}
          <Letters x={-17} z={22} />
          <GroundText position={[0, 0, 40]} size={0.5} opacity={0.6}>W A S D  /  ARROWS   ·   SHIFT BOOST   ·   SPACE BRAKE   ·   R FLIP BACK</GroundText>
          <GroundText position={[0, 0, -18]} size={0.9}>PROJECTS</GroundText>
          <GroundText position={[-30, 0, -6.5]} size={0.7}>SKILLS CAMP</GroundText>
          <GroundText position={[30, 0, -6.5]} size={0.7}>RESEARCH ARENA</GroundText>
          <GroundText position={[-30, 0, 6.5]} size={0.7}>GRAVEYARD</GroundText>
          <GroundText position={[30, 0, 6.5]} size={0.7}>THE VILLAGE</GroundText>

          {/* Bruno's projects forge and social plinth (areas.js) */}
          <ProjectsArea position={PROJECTS_SITE} carRef={carRef} onDiscover={onDiscover} />
          <SocialArea center={SOCIAL_CENTER} carRef={carRef} onDiscover={onDiscover} />
          <SkillsCamp tags={globeTags} {...zp} />
          <ResearchArena {...zp} />
          <DesignGraveyard {...zp} />
          <Village {...zp} />
          <Outskirts />

          <Car carRef={carRef} onFlipped={onFlipped} />
          <Ready revealRef={revealRef} onReady={onReady} />
        </Physics>
        <Particles carRef={carRef} />
        <Precipitation carRef={carRef} />
      </Suspense>

      <Follow carRef={carRef} revealRef={revealRef} />

      {/* Post-processing: ambient occlusion for contact depth, gentle bloom on lights, vignette */}
      <EffectComposer multisampling={0} enableNormalPass={false}>
        {high && <N8AO aoRadius={1.6} intensity={2.2} distanceFalloff={0.6} halfRes color="#5a2d2a" />}
        <Bloom intensity={0.45} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
        {/* after bloom, so glow from lights outside the intro circle can't leak into the void */}
        <Reveal revealRef={revealRef} />
        <Vignette offset={0.25} darkness={0.55} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
