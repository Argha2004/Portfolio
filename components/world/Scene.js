"use client";
import "./brunoShading"; // must run before any material compiles
import { preloadWorld } from "./preload";
import { memo, Suspense, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, useRapier } from "@react-three/rapier";
import { EffectComposer, Bloom, N8AO, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { globeTags, profile } from "@/lib/data";
import Car, { SPAWN } from "./Car";
import { CAM_OFFSET, SUN_DIR, PROJECTS_SITE, SOCIAL_CENTER, NAME_SIGN } from "./zones";
import { ProjectsArea, SocialArea } from "./areas";
import { GroundText, Letters } from "./Props";
import { Floor, WaterSurface, TerrainCollider } from "./terrain";
import { Particles } from "./Atmosphere";
import { BladeGrass } from "./grass";
import Roads from "./Roads";
import Circuit from "./Circuit";
import Trail from "./Trail";
import Trackside from "./Trackside";
import Bridges from "./River";
import RaceMode from "./RaceMode";
import { SkillsCamp, ResearchArena, DesignGraveyard, Village, Outskirts, SpawnGarden } from "./Districts";
import { Campus, HallOfFame } from "./Sections";
import { Bombs, Fireballs } from "./Bombs";
import { MapCapture } from "./mapCapture";
import { createRenderer } from "./gpu";
import { chunkInstances, syncChunks } from "./instanceChunks";
import { Reveal } from "./Reveal";
import { sfx } from "./sound";
import { view, resetOrbit } from "./view";
import { cycle, updateCycle } from "./dayCycle";
import { weather, updateWeather } from "./weather";
import Precipitation from "./Precipitation";

preloadWorld(); // start every model download at once instead of one after another

const OFFSET = new THREE.Vector3(...CAM_OFFSET);
// The default chase angle as yaw / pitch / distance; dragging adds view.orbit on top
const BASE_YAW = Math.atan2(CAM_OFFSET[0], CAM_OFFSET[2]);
const BASE_PITCH = Math.asin(CAM_OFFSET[1] / OFFSET.length());
const DIST = OFFSET.length();
// Lowest tilt ~25° (a flatter view looks out across the whole island and draws far more of it,
// which made the frame rate dip), highest nearly straight down
const PITCH_MIN = 0.44, PITCH_MAX = 1.35;

// Camera follows the car from a fixed, slightly isometric angle (like a toy diorama),
// pulling back a little at speed. Dragging with the left mouse button turns it around the car.
// The camera sits directly on its angle around the (smoothed) look point, so a drag moves it
// straight away; only the look point and the zoom are eased. Cinematic shots blend in and out.
function Follow({ carRef, revealRef }) {
  const look = useRef(new THREE.Vector3(...SPAWN));
  const want = useMemo(() => new THREE.Vector3(), []);
  const chase = useMemo(() => new THREE.Vector3(), []);
  const zoom = useRef(1.2);
  const ang = useRef({ yaw: BASE_YAW, pitch: BASE_PITCH });
  const cineState = useRef({ blend: 0, position: new THREE.Vector3(), target: new THREE.Vector3() });
  useFrame((st, rawDt) => {
    const rb = carRef.current;
    if (!rb) return;
    const dt = Math.min(rawDt, 0.1); // (a long frame mustn't fling the camera)
    const t = rb.translation();
    const v = rb.linvel();
    // Close-up diorama framing on the intro screen, normal chase view once driving
    const r = revealRef.current;
    const base = r.started ? 1 : r.zoom ?? 1.05;
    zoom.current = THREE.MathUtils.damp(zoom.current, base + Math.min(Math.hypot(v.x, v.z) / 26, 1) * 0.3, r.started ? 1.4 : 6, dt);
    // Drag angle: a very light ease (≈30 ms) just to smooth out uneven mouse events
    const o = view.orbit, a = ang.current;
    o.pitch = THREE.MathUtils.clamp(o.pitch, PITCH_MIN - BASE_PITCH, PITCH_MAX - BASE_PITCH);
    a.yaw = THREE.MathUtils.damp(a.yaw, BASE_YAW + o.yaw, 32, dt);
    a.pitch = THREE.MathUtils.damp(a.pitch, BASE_PITCH + o.pitch, 32, dt);
    // Chase camera
    look.current.lerp(want.set(t.x, Math.max(t.y, 0), t.z), 1 - Math.exp(-6 * dt));
    const d = DIST * zoom.current;
    chase.set(Math.cos(a.pitch) * Math.sin(a.yaw), Math.sin(a.pitch), Math.cos(a.pitch) * Math.cos(a.yaw)).multiplyScalar(d).add(look.current);
    // An area's cinematic shot (projects board) takes over, blending in and back out
    const cine = view.cinematic, cs = cineState.current;
    if (cine) { cs.position.set(...cine.position); cs.target.set(...cine.target); }
    cs.blend = THREE.MathUtils.damp(cs.blend, cine ? 1 : 0, 2.2, dt);
    if (cs.blend < 0.001) {
      st.camera.position.copy(chase);
      st.camera.lookAt(look.current);
    } else {
      const e = cs.blend * cs.blend * (3 - 2 * cs.blend);
      st.camera.position.copy(chase).lerp(cs.position, e);
      st.camera.lookAt(want.copy(look.current).lerp(cs.target, e));
    }
  });
  return null;
}

// Left-button drag on the 3D view turns the camera around the car (mouse / pen; touch keeps the
// joystick). A short click still works as a click; a double-click puts the default angle back.
function OrbitDrag({ revealRef }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let start = null, last = null;
    const down = (e) => {
      if (e.button !== 0 || e.pointerType === "touch" || !revealRef.current.started || view.cinematic) return;
      start = last = [e.clientX, e.clientY];
    };
    const move = (e) => {
      if (!start) return;
      if (!view.dragging) {
        if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 4) return; // still a click
        view.dragging = true;
        el.style.cursor = "grabbing";
      }
      view.orbit.yaw -= (e.clientX - last[0]) * 0.006;
      view.orbit.pitch += (e.clientY - last[1]) * 0.004;
      last = [e.clientX, e.clientY];
    };
    // Over the canvas the move is handled here and, while dragging, kept from the 3D scene's own
    // pointer events: those raycast every hoverable model on each move, which made dragging stutter
    const moveCanvas = (e) => { move(e); if (view.dragging) e.stopPropagation(); };
    const moveOutside = (e) => { if (e.target !== el) move(e); };
    let swallow = false;
    const up = () => {
      start = last = null;
      if (view.dragging) { view.dragging = false; el.style.cursor = ""; swallow = true; setTimeout(() => { swallow = false; }, 0); }
    };
    // the click that ends a drag isn't a click on whatever is under the pointer
    const click = (e) => { if (swallow) { e.stopPropagation(); swallow = false; } };
    const dbl = () => { if (revealRef.current.started && !view.cinematic) resetOrbit(); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", moveCanvas, true);
    addEventListener("pointermove", moveOutside);
    addEventListener("pointerup", up);
    addEventListener("blur", up);
    el.addEventListener("dblclick", dbl);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("click", click, true);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", moveCanvas, true);
      removeEventListener("pointermove", moveOutside);
      removeEventListener("pointerup", up);
      removeEventListener("blur", up);
      el.removeEventListener("dblclick", dbl);
      up();
    };
  }, [gl, revealRef]);
  return null;
}

// Mounts once everything inside the Suspense has loaded. Intro sequence (after Bruno Simon's
// folio-2025): the loader ring completes, shrinks away, then the diorama springs open from a point
// while the camera eases back to frame it.

function Ready({ revealRef, onReady }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const r = revealRef.current;
    let tl = null, cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      if (r.started) { onReady?.(); return; }
      r.ring = 1;
      tl = gsap.timeline({ delay: 0.35 });
      tl.to(r, { ringR: 0, duration: 1.2, ease: "power4.in" })
        .add(() => onReady?.())
        .to(r, { radius: 7.5, duration: 2, ease: "back.out(1.7)" })
        .to(r, { zoom: 1.05, duration: 1.25, ease: "power1.inOut" }, "<");
    };
    // While the loader ring is still up: split the big instanced meshes into culled map cells,
    // then compile every shader in the background (parallel compile) instead of freezing on the
    // first frame, or mid-drive when something new comes into view. The scene is rendered through
    // the post-processing chain, i.e. into a float target (no tone mapping, linear output), so
    // the programs are compiled for that too.
    (async () => {
      await new Promise((res) => setTimeout(res, 0)); // let every component place its instances first
      if (cancelled) return;
      chunkInstances(scene);
      const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      const prev = gl.getRenderTarget();
      try {
        gl.setRenderTarget(target);
        const done = gl.compileAsync(scene, camera);
        gl.setRenderTarget(prev);
        await Promise.race([done, new Promise((res) => setTimeout(res, 8000))]);
      } catch (e) {
        gl.setRenderTarget(prev);
        console.warn("Shader pre-compile skipped", e);
      }
      target.dispose();
      reveal();
    })();
    return () => { cancelled = true; tl?.kill(); };
  }, [revealRef, onReady, gl, scene, camera]);
  // Keep chunks in step with their source meshes, and chunk meshes that appear later (race mode)
  useFrame(() => syncChunks());
  useEffect(() => {
    const id = setInterval(() => chunkInstances(scene), 2500);
    return () => clearInterval(id);
  }, [scene]);
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
// Anything knocked through the ground (or off the island) is switched off instead of falling
// forever and costing a physics step every frame
function FallGuard({ carRef }) {
  const { world } = useRapier();
  useEffect(() => {
    const id = setInterval(() => {
      world.bodies.forEach((b) => {
        if (b.isDynamic() && b.isEnabled() && b !== carRef.current && b.translation().y < -40) b.setEnabled(false);
      });
    }, 2000);
    return () => clearInterval(id);
  }, [world, carRef]);
  return null;
}

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

function Scene({ carRef, lapRef, trailRef, revealRef, zone, setZone, onDiscover, onFlipped, onReady, quality = "high", race = 0 }) {
  // Leaving a pad closes its panel after a short grace period, so bumping around on the pad's
  // edge doesn't flicker it; re-entering cancels the close (and doesn't replay the chime)
  const leaving = useRef({});
  const current = useRef(zone);
  current.current = zone;
  const enter = (id) => {
    if (leaving.current[id]) { clearTimeout(leaving.current[id]); leaving.current[id] = 0; }
    if (current.current !== id) sfx.chime();
    setZone(id);
  };
  const exit = (id) => {
    clearTimeout(leaving.current[id]);
    leaving.current[id] = setTimeout(() => { leaving.current[id] = 0; setZone((z) => (z === id ? null : z)); }, 700);
  };
  const high = quality === "high";
  const zp = { zone, onEnter: enter, onExit: exit };

  return (
    <Canvas shadows="soft" dpr={high ? [1, 1.5] : [1, 1]} camera={{ fov: 42, position: [SPAWN[0] + 9 * 1.2, 12 * 1.2, SPAWN[2] + 15 * 1.2], near: 0.5, far: 700 }} onCreated={({ camera }) => camera.lookAt(SPAWN[0], 0, SPAWN[2])} gl={createRenderer}>
      <CycleDriver />
      <Sun carRef={carRef} />

      <Suspense fallback={null}>

        {/* Bruno-style terrain: displaced, coloured floor + water surface (see terrain.js) */}
        <Floor />
        <WaterSurface />
        <BladeGrass focusRef={carRef} />

        <Physics gravity={[0, -20, 0]}>
          <FallGuard carRef={carRef} />
          <TerrainCollider />
          <Roads />
          <SpawnGarden center={[SPAWN[0], SPAWN[2]]} />
          <Circuit carRef={carRef} lapRef={lapRef} />
          <Trail carRef={carRef} trailRef={trailRef} />

          {/* Spawn: the name in physics letters, one line on the right of the road */}
          <Letters lines={["ARGHADEEP PAKHIRA"]} x={NAME_SIGN.x} z={NAME_SIGN.z} size={NAME_SIGN.size} />
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
          {/* Sections out by the trail: education, awards & certifications */}
          <Campus {...zp} />
          <HallOfFame {...zp} />
          {/* Bruno's explosive crates, scattered all over the island */}
          <Bombs />
          {/* ...and around the circuit, with his other knock-over obstacles */}
          <Trackside />
          {/* Bridges over the river across the middle of the island (the river is carved into the terrain) */}
          <Bridges />
          {/* Race mode: walls all round the circuit + obstacles on it (rebuilt for every race) */}
          {race > 0 && <RaceMode key={race} seed={race} />}

          <Car carRef={carRef} onFlipped={onFlipped} />
          <Ready revealRef={revealRef} onReady={onReady} />
        </Physics>
        <Particles carRef={carRef} />
        <Fireballs carRef={carRef} />
        <MapCapture />
        <Precipitation carRef={carRef} />
      </Suspense>

      <Follow carRef={carRef} revealRef={revealRef} />
      <OrbitDrag revealRef={revealRef} />

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

// Memoised: the HUD's own state (song, time of day, weather, discoveries, flip hint…) changes
// often and used to re-render the whole 3D tree each time; the scene only needs its own props.
export default memo(Scene);
