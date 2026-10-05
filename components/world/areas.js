"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { RigidBody, CuboidCollider, CylinderCollider, BallCollider, ConvexHullCollider } from "@react-three/rapier";
import * as THREE from "three";
import gsap from "gsap";
import { projects } from "@/lib/projects";
import { profile, socials } from "@/lib/data";
import { brunoify, isHelper } from "./bruno";
import { InteractivePoint } from "./interactive";
import { HAND_FAMILY, handReady } from "./fonts";
import { input } from "./input";
import { view } from "./view";
import { sfx } from "./sound";

// ───────── Bruno Simon's Projects and Social areas (folio-2025, MIT: World/Areas/*.js) ─────────
// The two areas are taken from his areas.glb (pruned to just these two; his statue, cats,
// avatar and joke links are left out) and rebuilt here: his node-name conventions become physics
// (…PhysicalDynamic / …PhysicalFixed bodies whose cuboid / hull / tube / ball children are the
// collider shapes), and his "ref…" nodes are the hooks the behaviour code drives.
export const AREAS_URL = "/models/bruno/areas-projects-social.glb";

// "refBlackBoard002" → "blackBoard" (his References naming)
const refKey = (name) => {
  const k = name.replace(/^ref/, "").replace(/(Physical|Dynamic|Fixed|KinematicPositionBased)/g, "").replace(/\d+$/, "");
  return k.charAt(0).toLowerCase() + k.slice(1);
};

function buildArea(scene, name) {
  const root = brunoify(scene.getObjectByName(name).clone(true));
  const baseY = root.position.y;
  root.position.set(0, baseY, 0);
  root.updateMatrixWorld(true);

  // References
  const refs = new Map();
  root.traverse((o) => {
    if (!o.name.startsWith("ref")) return;
    const k = refKey(o.name);
    if (!refs.has(k)) refs.set(k, []);
    refs.get(k).push(o);
  });

  // Physical bodies: direct children named …Physical…
  const bodies = [];
  for (const child of [...root.children]) {
    if (!/physical/i.test(child.name)) continue;
    const type = /dynamic/i.test(child.name) ? "dynamic" : "fixed";
    const colliders = [];
    for (const h of [...child.children]) {
      if (!isHelper(h)) continue;
      const e = new THREE.Euler().setFromQuaternion(h.quaternion);
      const base = { key: h.uuid, position: h.position.toArray(), rotation: [e.x, e.y, e.z] };
      if (/^cuboid/i.test(h.name)) colliders.push({ ...base, shape: "cuboid", args: [h.scale.x / 2, h.scale.y / 2, h.scale.z / 2] });
      else if (/^tube/i.test(h.name)) colliders.push({ ...base, shape: "cylinder", args: [h.scale.y / 2, h.scale.x / 2] });
      else if (/^ball/i.test(h.name)) colliders.push({ ...base, shape: "ball", args: [h.scale.y / 2] });
      else if (/^(hull|trimesh)/i.test(h.name) && h.geometry) {
        h.updateMatrix();
        const g = h.geometry.clone().applyMatrix4(h.matrix);
        colliders.push({ key: h.uuid, shape: "hull", args: [g.attributes.position.array] });
      }
      h.removeFromParent();
    }
    const position = [child.position.x, baseY + child.position.y, child.position.z];
    const quaternion = child.quaternion.toArray();
    child.removeFromParent();
    child.position.set(0, 0, 0);
    child.quaternion.identity();
    bodies.push({ name: child.name, type, position, quaternion, object: child, colliders });
  }
  root.traverse((o) => { if (o.name.startsWith("refZone")) o.visible = false; });
  return { root, refs, bodies, baseY, ref: (k, i = 0) => refs.get(k)?.[i] };
}

function Body({ body, density = 0.8 }) {
  return (
    <RigidBody type={body.type} position={body.position} quaternion={body.quaternion} colliders={false}
      linearDamping={0.3} angularDamping={0.4} canSleep>
      {body.colliders.map((c) => {
        const p = { position: c.position, rotation: c.rotation, density, friction: 0.7 };
        if (c.shape === "cuboid") return <CuboidCollider key={c.key} args={c.args} {...p} />;
        if (c.shape === "cylinder") return <CylinderCollider key={c.key} args={c.args} {...p} />;
        if (c.shape === "ball") return <BallCollider key={c.key} args={c.args} {...p} />;
        return <ConvexHullCollider key={c.key} args={c.args} density={density} friction={0.7} />;
      })}
      <primitive object={body.object} />
    </RigidBody>
  );
}

// Site pages open in place, everything else in a new tab
const openLink = (url) => (url.startsWith("/") ? window.location.assign(url) : window.open(url, "_blank", "noopener"));

// ── Canvas text (his TextCanvas): white text on black, used as an alpha map ──
function textCanvas({ fontSize, width, height, density = 200, align = "center", lineHeight = 1 }) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let measure = 0;
  const update = (text) => {
    const lines = Array.isArray(text) ? text : [text];
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // shrink to fit the plank when the text is too long
    let size = fontSize * density;
    ctx.font = `700 ${size}px ${HAND_FAMILY}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > canvas.width * 0.94) size *= (canvas.width * 0.94) / widest;
    ctx.font = `700 ${size}px ${HAND_FAMILY}`;
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
    ctx.textAlign = align;
    const x = align === "center" ? canvas.width / 2 : align === "left" ? 0 : canvas.width;
    const lh = lineHeight * density;
    lines.forEach((l, i) => ctx.fillText(l, x, canvas.height / 2 + (i - (lines.length - 1) / 2) * lh));
    measure = Math.max(...lines.map((l) => ctx.measureText(l).width));
    texture.needsUpdate = true;
  };
  return { texture, update, width: () => measure, density };
}
const textMaterial = (tex) => new THREE.MeshBasicMaterial({ color: "#ffffff", alphaMap: tex, transparent: true, depthWrite: false, toneMapped: false });

// ── Project pages, drawn to 960 × 540 canvases (or the project screenshot) ──
const PAGE_W = 960, PAGE_H = 540;
function page(draw) {
  const c = document.createElement("canvas");
  c.width = PAGE_W; c.height = PAGE_H;
  draw(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function coverPage(p) {
  return page((ctx) => {
    const g = ctx.createLinearGradient(0, 0, PAGE_W, PAGE_H);
    g.addColorStop(0, p.colors[0]); g.addColorStop(0.55, p.colors[1]); g.addColorStop(1, p.colors[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = `700 150px ${HAND_FAMILY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.name, PAGE_W / 2, PAGE_H / 2 - 30);
    ctx.font = `700 46px ${HAND_FAMILY}`; ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillText(p.subtitle, PAGE_W / 2, PAGE_H / 2 + 80);
  });
}
function summaryPage(p) {
  return page((ctx) => {
    ctx.fillStyle = "#2a1d2e"; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = p.colors[0]; ctx.fillRect(0, 0, 14, PAGE_H);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
    ctx.font = `700 64px ${HAND_FAMILY}`; ctx.fillText(p.subtitle, 60, 40);
    ctx.font = "500 26px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,.85)";
    wrap(ctx, p.summary, PAGE_W - 120).slice(0, 5).forEach((l, i) => ctx.fillText(l, 60, 140 + i * 36));
    (p.stats || []).slice(0, 3).forEach(([n, label], i) => {
      const x = 60 + i * 300;
      ctx.fillStyle = p.colors[0]; ctx.font = `700 76px ${HAND_FAMILY}`; ctx.fillText(n, x, 350);
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "500 20px system-ui, sans-serif";
      wrap(ctx, label, 260).slice(0, 2).forEach((l, j) => ctx.fillText(l, x, 440 + j * 26));
    });
  });
}
function stackPage(p) {
  return page((ctx) => {
    ctx.fillStyle = "#2a1d2e"; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
    ctx.font = `700 64px ${HAND_FAMILY}`; ctx.fillText("Built with", 60, 40);
    ctx.font = "600 24px system-ui, sans-serif";
    let x = 60, y = 140;
    for (const s of p.stack || []) {
      const w = ctx.measureText(s).width + 36;
      if (x + w > PAGE_W - 60) { x = 60; y += 58; }
      ctx.fillStyle = p.colors[1]; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.roundRect(x, y, w, 44, 22); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.fillText(s, x + 18, y + 10);
      x += w + 12;
    }
  });
}
const twoLines = (name) => {
  const parts = name.split(/[\s-]+/);
  if (parts.length < 2) return [name];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
};
const roleOf = (p) => {
  const mine = (p.sections || []).find((s) => /my (contributions|role)/i.test(s.title));
  if (mine) return "Full-stack & vision";
  if (p.role) return "UI · sensors · logic";
  return "Solo developer";
};

// Image board material: his parallax wipe between the old and new picture
function boardMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOld: { value: null }, uNew: { value: null }, uProgress: { value: 1 }, uDir: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D uOld; uniform sampler2D uNew; uniform float uProgress; uniform float uDir; varying vec2 vUv;
      void main(){
        vec2 uvNew = vUv; vec2 uvOld = vUv;
        uvNew.x += (1.0 - uProgress) * -0.25 * uDir;
        uvOld.x += uProgress * 0.25 * uDir;
        float reveal = uDir > 0.0 ? 1.0 - vUv.x : vUv.x;
        vec3 c = mix(texture2D(uNew, uvNew).rgb, texture2D(uOld, uvOld).rgb, step(uProgress, reveal));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// Hooks the board's meshes up to canvas text, the image wipe and white arrows
function setupBoard(area) {
  const r = area.ref;
  const findText = (o) => o?.children.find((c) => c.name.startsWith("text"));
  const white = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const whiteHover = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });

  const board = boardMaterial();
  const images = r("images");
  images.material = board;
  images.castShadow = false;

  const title = r("title"), titleInner = title.children[0];
  const titleText = textCanvas({ fontSize: 0.4, width: 4, height: 0.6 });
  findText(titleInner).material = textMaterial(titleText.texture);

  const url = r("url"), urlInner = url.children[0];
  const urlText = textCanvas({ fontSize: 0.23, width: 4, height: 0.2 });
  findText(urlInner).material = textMaterial(urlText.texture);
  const urlPanel = urlInner.children.find((c) => c.name.startsWith("panel"));
  const intersectUrl = r("intersectUrl"); if (intersectUrl) intersectUrl.visible = false;

  const adj = ["previous", "next"].map((k) => {
    const inner = r(k).children[0];
    const t = textCanvas({ fontSize: 0.3, width: 1.25, height: 0.75, lineHeight: 0.3 });
    findText(inner).material = textMaterial(t.texture);
    return { inner, text: t };
  });

  const attrs = {};
  for (const g of r("attributes").children) {
    const t = textCanvas({ fontSize: 0.23, width: 1.4, height: 0.45, lineHeight: 0.2 });
    findText(g).material = textMaterial(t.texture);
    attrs[g.name] = { group: g, text: t };
  }
  const attributesGroup = r("attributes"), attributesY = attributesGroup.position.y;

  const paginationInner = r("pagination").children[0];
  const dots = paginationInner.children.filter((c) => c.isMesh);
  dots.forEach((d) => (d.material = white));

  const arrows = ["arrowPreviousImage", "arrowNextImage", "arrowPreviousProject", "arrowNextProject"].map((k) => r(k)).filter(Boolean);
  arrows.forEach((a) => (a.material = white));

  // Blackboard: keyboard labels only
  r("blackboardLabelsGamepadPlaystation") && (r("blackboardLabelsGamepadPlaystation").visible = false);
  r("blackboardLabelsGamepadXbox") && (r("blackboardLabelsGamepadXbox").visible = false);

  // Forge: glowing charcoal and blade
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 0.2), toneMapped: false });
  if (r("charcoal")) r("charcoal").material = glow;
  if (r("blade")) r("blade").material = glow;

  return { board, title, titleInner, titleText, urlInner, urlText, urlPanel, adj, attrs, attributesGroup, attributesY, paginationInner, dots, arrows, white, whiteHover };
}

// His changeProject / changeImage: flip the title + url, swing the neighbours, pop the attributes, wipe the image
function makeNavigation(items, ui, st) {
  const anim = (o, k, to, opts) => gsap.to(o, { [k]: to, overwrite: true, ...opts });
  const setImage = (i, dir) => {
    const s = st.current, item = items[s.index];
    sfx.click(); sfx.slide(); // his click + slide
    s.image = i;
    const u = ui.board.uniforms;
    u.uOld.value = u.uNew.value || item.pages[i];
    u.uNew.value = item.pages[i];
    u.uDir.value = dir;
    gsap.fromTo(u.uProgress, { value: 0 }, { value: 1, duration: 1, ease: "power2.inOut", overwrite: true });
    ui.dots.forEach((d, j) => {
      d.visible = j < item.pages.length;
      d.position.x = 0.2 * j;
      d.rotation.z = j === i ? 0 : Math.PI;
    });
    anim(ui.paginationInner.position, "x", -(item.pages.length - 1) * 0.2 / 2, { duration: 0.5 });
  };
  const setProject = (index, dir, toLast = false) => {
    const n = items.length, s = st.current;
    s.index = ((index % n) + n) % n;
    const item = items[s.index], prev = items[(s.index - 1 + n) % n], next = items[(s.index + 1) % n];
    const rot = dir > 0 ? -1 : 1;
    // Title + url flip over, change, flip back (back.out)
    [[ui.titleInner, 0, () => ui.titleText.update(item.title)], [ui.urlInner, 0.3, () => {
      ui.urlText.update(item.url.startsWith("/") ? "Read the case study" : item.url.replace(/https?:\/\//, ""));
      ui.urlPanel.scale.x = ui.urlText.width() / ui.urlText.density + 0.2;
    }]].forEach(([o, delay, change]) => {
      o.rotation.x = 0;
      gsap.to(o.rotation, { x: Math.PI * rot, duration: 1, delay, ease: "power2.in", overwrite: true, onComplete: () => {
        change();
        gsap.to(o.rotation, { x: Math.PI * 2 * rot, duration: 1, ease: "back.out(2)" });
      } });
    });
    // Adjacent names swing away and back
    ui.adj.forEach(({ inner, text }, k) => {
      gsap.to(inner.rotation, { z: (k ? -1 : 1) * Math.PI * 0.5, duration: 0.5, delay: k * 0.2, ease: "power2.in", overwrite: true, onComplete: () => {
        text.update((k ? next : prev).small);
        gsap.to(inner.rotation, { z: 0, duration: 1, delay: k * 0.2, ease: "back.out(2)" });
      } });
    });
    // Attributes pop out and back in
    const names = ["role", "at", "with"];
    names.forEach((nm, i) => gsap.to(ui.attrs[nm].group.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, delay: 0.1 * i, ease: "power2.in", overwrite: true }));
    gsap.delayedCall(1, () => {
      let i = 0;
      for (const nm of names) {
        const a = ui.attrs[nm], v = item.attributes[nm];
        a.group.visible = !!v;
        if (!v) continue;
        a.text.update(v);
        a.group.position.y = -i * 0.75;
        gsap.to(a.group.scale, { x: 1, y: 1, z: 1, duration: 1, delay: 0.2 * i, ease: "back.out(2)" });
        i++;
      }
      ui.attributesGroup.position.y = ui.attributesY + (i - 1) * 0.75 / 2;
    });
    setImage(toLast ? item.pages.length - 1 : 0, dir);
  };
  const nextImg = () => { const s = st.current; s.image < items[s.index].pages.length - 1 ? setImage(s.image + 1, 1) : setProject(s.index + 1, 1); };
  const prevImg = () => { const s = st.current; s.image > 0 ? setImage(s.image - 1, -1) : setProject(s.index - 1, -1, true); };
  return { setImage, setProject, nextImg, prevImg, nextProject: () => setProject(st.current.index + 1, 1), prevProject: () => setProject(st.current.index - 1, -1) };
}

// ───────── Projects: his forge workshop with the project board ─────────
export function ProjectsArea({ position, carRef, onDiscover }) {
  const { scene } = useGLTF(AREAS_URL);
  const area = useMemo(() => buildArea(scene, "projects"), [scene]);
  const shots = useTexture(projects.map((p) => p.image).filter(Boolean));
  const [open, setOpen] = useState(false);
  const st = useRef({ index: 0, image: 0, open: false });

  // Pages per project: cover (screenshot or poster), summary + stats, stack
  const items = useMemo(() => {
    let s = 0;
    return projects.map((p) => {
      let cover = null;
      if (p.image) { cover = shots[s++]; cover.flipY = false; cover.colorSpace = THREE.SRGBColorSpace; cover.needsUpdate = true; }
      return {
        // external link if there is one, otherwise the project's case study on this site
        p, title: p.name, small: twoLines(p.name), url: p.paper || p.github || `/work/${p.slug}`,
        attributes: { role: roleOf(p), at: p.category, with: p.tags },
        pages: [cover, null, null], // canvases filled once the font is ready
      };
    });
  }, [shots]);

  // Built once per area instance: it assigns materials to the model, and React may run memos
  // twice (Strict Mode), which would leave the meshes holding the discarded copy's materials
  const ui = useMemo(() => (area.ui ||= setupBoard(area)), [area]);

  // Navigation (his changeProject / changeImage)
  const show = useMemo(() => makeNavigation(items, ui, st), [items, ui]);


  // Draw the canvas pages once the handwritten font is in, then show the first project
  useEffect(() => {
    let alive = true;
    handReady().then(() => {
      if (!alive) return;
      for (const it of items) {
        it.pages[0] = it.pages[0] || coverPage(it.p);
        it.pages[1] = summaryPage(it.p);
        it.pages[2] = stackPage(it.p);
      }
      ui.board.uniforms.uNew.value = items[0].pages[0];
      show.setProject(0, 1);
    });
    return () => { alive = false; };
  }, [items, ui, show]);

  // Interactive point → cinematic camera
  const ip = area.ref("interactivePoint");
  const ipWorld = useMemo(() => [position[0] + ip.position.x, area.baseY + ip.position.y, position[1] + ip.position.z], [ip, position, area]);
  const openBoard = () => {
    if (st.current.open) return;
    st.current.open = true; setOpen(true);
    view.cinematic = {
      // his shot (offset 4.65, 4, 4.85), pulled up and back a little so the parked car sits lower in frame
      position: [ipWorld[0] + 5.4, 5.4, ipWorld[2] + 5.6],
      target: [ipWorld[0] - 3.0, 1.6, ipWorld[2] - 4.6],
    };
    input.locked = true;
    onDiscover?.("projects");
    sfx.click();
  };
  const closeBoard = () => {
    if (!st.current.open) return;
    st.current.open = false; setOpen(false);
    view.cinematic = null;
    input.locked = false;
  };
  useEffect(() => () => { if (st.current.open) { view.cinematic = null; input.locked = false; } }, []);

  // Keys while open: ← ↑ / A W previous, → ↓ / D S next, Enter opens the link, Esc leaves
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const c = e.code;
      if (["ArrowLeft", "ArrowUp", "KeyA", "KeyW"].includes(c)) show.prevImg();
      else if (["ArrowRight", "ArrowDown", "KeyD", "KeyS"].includes(c)) show.nextImg();
      else if (c === "Enter") openLink(items[st.current.index].url);
      else if (c === "Escape" || c === "Backspace") closeBoard();
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [open, show, items]);

  // Clicks on the board's arrows, dots and url (his rayCursor intersects)
  const onClick = (e) => {
    if (!st.current.open) return;
    for (let o = e.object; o; o = o.parent) {
      const n = o.name;
      if (n.startsWith("refArrowNextImage")) return e.stopPropagation(), show.nextImg();
      if (n.startsWith("refArrowPreviousImage")) return e.stopPropagation(), show.prevImg();
      if (n.startsWith("refNext")) return e.stopPropagation(), show.nextProject();
      if (n.startsWith("refPrevious")) return e.stopPropagation(), show.prevProject();
      if (n.startsWith("refUrl")) return e.stopPropagation(), openLink(items[st.current.index].url);
      if (/^plane\d*$/.test(n) && o.parent === ui.paginationInner) {
        const i = ui.dots.indexOf(o);
        return e.stopPropagation(), show.setImage(i, i > st.current.image ? 1 : -1);
      }
    }
  };
  const onOver = (e) => {
    if (!st.current.open) return;
    const a = ui.arrows.includes(e.object) || ui.dots.includes(e.object);
    if (a) { e.object.material = ui.whiteHover; document.body.style.cursor = "pointer"; }
  };
  const onOut = (e) => {
    if (ui.arrows.includes(e.object) || ui.dots.includes(e.object)) e.object.material = ui.white;
    document.body.style.cursor = "";
  };

  // Ambient animation: blower, grinder, hammer, bouncing blackboard while open
  const t0 = useRef(0), anvilLoop = useRef(0);
  useFrame((_, dt) => {
    t0.current += dt;
    const t = t0.current, r = area.ref;
    if (r("blower")) r("blower").scale.y = Math.sin(t) * 0.2 + 0.8;
    if (r("grinder")) r("grinder").rotation.z = -t * 0.75;
    const hammer = r("hammer");
    if (hammer) {
      hammer.rotation.order = "ZXY";
      const time = t + Math.PI * 0.25;
      hammer.rotation.x = Math.pow(1 - Math.abs(Math.sin(time)), 5) - 1;
      // the anvil rings each time the hammer lands (his loopTime wrap), fading with distance
      const loop = (time / Math.PI) % 1;
      if (loop < anvilLoop.current) {
        const rb = carRef.current, p = rb?.translation();
        const d = p ? Math.hypot(p.x - ipWorld[0], p.z - ipWorld[2]) : 99;
        sfx.anvil(1 - THREE.MathUtils.smoothstep(d, 6, 28));
      }
      anvilLoop.current = loop;
    }
    const bb = r("blackBoard");
    if (bb) {
      const c = (t % 7) - 2; // a little hop every 7 s while the board is open
      bb.position.y = st.current.open && c > 0 && c < 1.4 ? Math.sin((c / 1.4) * Math.PI) * 0.25 : 0;
    }
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      <primitive object={area.root} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
      {area.bodies.map((b) => <Body key={b.name} body={b} />)}
      <InteractivePoint position={ipWorld.map((v, i) => v - [position[0], 0, position[1]][i])} label="Projects" carRef={carRef}
        onInteract={openBoard} enabled={!open} worldPosition={ipWorld} />
    </group>
  );
}

// ───────── Social / contact: five statues — GitHub, LinkedIn, Kaggle, ORCID on pedestals, Mail in the middle ─────────
// Which of his 8 half-circle pedestals (ordered by angle) carry the four links; the rest are cut away
const PEDESTAL_SLOTS = [0, 2, 5, 7];

// His pedestals and the statue base are one merged mesh; each pedestal is a separate block standing
// on the ground, so dropping the triangles inside a pedestal's footprint removes it cleanly.
function cutPedestals(root, fixed, keep) {
  const mesh = root.getObjectByName("Cube133");
  if (!mesh?.geometry?.index) return;
  const g = (mesh.geometry = mesh.geometry.clone()); // (the loaded scene is cached: don't edit it)
  const off = [fixed.position[0] - mesh.position.x, fixed.position[2] - mesh.position.z];
  const drop = fixed.colliders.filter((col) => col.shape === "cuboid" && !keep.includes(col))
    .map((col) => [col.position[0] + off[0], col.position[2] + off[1]]);
  const P = g.attributes.position.array, I = g.index.array, out = [];
  for (let t = 0; t < I.length; t += 3) {
    let x = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += P[I[t + k] * 3] / 3; z += P[I[t + k] * 3 + 2] / 3; }
    if (!drop.some(([px, pz]) => Math.abs(x - px) < 1.3 && Math.abs(z - pz) < 1.3)) out.push(I[t], I[t + 1], I[t + 2]);
  }
  g.setIndex(out);
}

// Kaggle and ORCID logos as chunky extruded statues, like his GitHub / LinkedIn models
const extrude = (shapes, depth, bevel = 0.04) => new THREE.ExtrudeGeometry(shapes, {
  depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24,
});

// Kaggle: its sky-blue lowercase "k" (tall stem, two thick arms meeting it at mid height)
function kaggleGeometry() {
  const k = new THREE.Shape();
  [[-0.45, 0], [-0.15, 0], [-0.15, 0.36], [0.3, 0], [0.7, 0], [0.12, 0.52], [0.66, 1.0], [0.28, 1.0], [-0.15, 0.64], [-0.15, 1.4], [-0.45, 1.4]]
    .forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
  const g = extrude(k, 0.26);
  g.center();
  return g;
}

// ORCID: a green disc with a white "iD" standing proud on both faces
function orcidGeometry() {
  const R = 0.7, T = 0.24;
  const disc = new THREE.CylinderGeometry(R, R, T, 48).rotateX(Math.PI / 2);
  const i = new THREE.Shape();
  i.moveTo(-0.37, -0.36); i.lineTo(-0.24, -0.36); i.lineTo(-0.24, 0.18); i.lineTo(-0.37, 0.18);
  const dot = new THREE.Shape();
  dot.absarc(-0.305, 0.32, 0.075, 0, Math.PI * 2, false);
  const d = new THREE.Shape();
  d.moveTo(-0.14, -0.36); d.lineTo(0.06, -0.36); d.absarc(0.06, 0, 0.36, -Math.PI / 2, Math.PI / 2, false); d.lineTo(-0.14, 0.36);
  const hole = new THREE.Path();
  hole.moveTo(-0.03, -0.25); hole.lineTo(-0.03, 0.25); hole.lineTo(0.06, 0.25); hole.absarc(0.06, 0, 0.25, Math.PI / 2, -Math.PI / 2, true);
  d.holes.push(hole);
  const front = extrude([i, dot, d], 0.05, 0.015).translate(-0.025, 0, T / 2 - 0.01);
  const back = front.clone().rotateY(Math.PI); // (turned round, so it reads correctly from behind too)
  return { disc, letters: [front, back], R, T };
}

const LOGOS = {
  Kaggle: () => {
    const g = kaggleGeometry();
    g.computeBoundingBox();
    const b = g.boundingBox;
    return { parts: [{ geometry: g, color: "#20beff" }], half: [(b.max.x - b.min.x) / 2, (b.max.y - b.min.y) / 2, (b.max.z - b.min.z) / 2] };
  },
  ORCID: () => {
    const { disc, letters, R, T } = orcidGeometry();
    return { parts: [{ geometry: disc, color: "#a6ce39" }, ...letters.map((geometry) => ({ geometry, color: "#ffffff" }))], half: [R, R, T / 2 + 0.05] };
  },
};

function LogoStatue({ link, position, facing = 0 }) {
  const logo = useMemo(() => LOGOS[link.name](), [link.name]);
  useEffect(() => () => logo.parts.forEach((p) => p.geometry.dispose()), [logo]);
  return (
    <RigidBody position={[position[0], position[1] + logo.half[1], position[2]]} rotation={[0, facing, 0]} colliders={false} linearDamping={0.3} angularDamping={0.4}>
      <CuboidCollider args={logo.half} density={0.6} friction={0.7} />
      {logo.parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} castShadow receiveShadow>
          <meshLambertMaterial color={p.color} />
        </mesh>
      ))}
    </RigidBody>
  );
}

export function SocialArea({ center, carRef, onDiscover }) {
  const { scene } = useGLTF(AREAS_URL);
  const area = useMemo(() => buildArea(scene, "social"), [scene]);
  const c = area.ref("center");
  // Place the group so its centre reference lands on `center`
  const origin = [center[0] - c.position.x, 0, center[1] - c.position.z];

  // Links: GitHub and LinkedIn use his models, the mailbox takes the statue's place in the middle
  const links = useMemo(() => {
    const get = (label) => socials.find((s) => s.label === label)?.href;
    return [
      { name: "GitHub", url: get("GitHub"), model: "gitHub" },
      { name: "LinkedIn", url: get("LinkedIn"), model: "linkedIn" },
      { name: "Kaggle", url: get("Kaggle") },
      { name: "ORCID", url: get("ORCID") },
    ].filter((l) => l.url);
  }, []);

  // Pedestals: his fixed cuboids in a half circle round the centre (the far "OnlyFans" one is never
  // used); only the slots holding a link are kept, the others are cut out of his mesh
  const pedestals = useMemo(() => {
    const fixed = area.bodies.find((b) => /physicalFixed/i.test(b.name));
    if (!fixed) return [];
    const ring = fixed.colliders.filter((col) => col.shape === "cuboid" && Math.hypot(col.position[0], col.position[2]) < 9)
      .sort((a, b) => Math.atan2(-a.position[2], a.position[0]) - Math.atan2(-b.position[2], b.position[0]));
    const keep = PEDESTAL_SLOTS.slice(0, links.length).map((i) => ring[i]).filter(Boolean);
    area.cut ||= (cutPedestals(area.root, fixed, keep), true);
    return keep.map((col) => [col.position[0] + fixed.position[0], col.position[2] + fixed.position[2]]);
  }, [area, links]);

  // Dynamic models placed on pedestals: rebuild their bodies at the chosen spots
  const placed = useMemo(() => {
    const out = [];
    links.forEach((l, i) => {
      if (!pedestals[i]) return;
      const [px, pz] = pedestals[i];
      const top = 0.85;
      if (l.model) {
        const body = area.bodies.find((b) => b.name.startsWith(l.model + "Physical"));
        if (body) out.push({ kind: "body", link: l, body: { ...body, position: [px, top + 1.0, pz] } });
      } else out.push({ kind: "logo", link: l, position: [px, top + 0.02, pz], facing: Math.atan2(c.position.x - px, c.position.z - pz) });
    });
    const mail = area.bodies.find((b) => b.name.startsWith("mailPhysical"));
    if (mail) out.push({ kind: "body", link: { name: "Mail", url: `mailto:${profile.email}` }, body: { ...mail, position: [c.position.x, 0.79 + 0.72, c.position.z] } }); // resting on the statue base
    return out;
  }, [area, links, pedestals, c]);

  // Interactive points on an inner half circle (his radius 6), each in front of its pedestal
  const pointsAt = useMemo(() => {
    const R = 6;
    return placed.map((item, i) => {
      if (item.link.name === "Mail") return [c.position.x + 1.6, 1, c.position.z + 1.6];
      const [px, pz] = pedestals[i], a = Math.atan2(pz - c.position.z, px - c.position.x);
      return [c.position.x + Math.cos(a) * R, 1, c.position.z + Math.sin(a) * R];
    });
  }, [placed, pedestals, c]);

  // Discovery: entering the plinth
  useFrame(() => {
    const rb = carRef.current;
    if (!rb) return;
    const t = rb.translation();
    if (Math.hypot(t.x - center[0], t.z - center[1]) < 10) onDiscover?.("contact");
  });

  // Fixed parts keep his plinth/base colliders; the movable link models are placed above
  const staticBodies = area.bodies.filter((b) => b.type === "fixed");
  const pedestalColliders = pedestals.map(([x, z], i) => <CuboidCollider key={i} args={[0.8, 0.425, 0.8]} position={[x, 0.425, z]} />);

  return (
    <group position={origin}>
      <primitive object={area.root} />
      {staticBodies.map((b) => <Body key={b.name} body={{ ...b, colliders: b.colliders.filter((col) => col.shape !== "cuboid") }} />)}
      <RigidBody type="fixed" colliders={false}>{pedestalColliders}</RigidBody>
      {placed.map((item, i) => item.kind === "body"
        ? <Body key={item.link.name} body={item.body} density={0.4} />
        : <LogoStatue key={item.link.name} link={item.link} position={item.position} facing={item.facing} />)}
      {placed.map((item, i) => (
        <InteractivePoint key={item.link.name} position={pointsAt[i]} label={item.link.name} align={i < placed.length / 2 ? "right" : "left"}
          carRef={carRef} worldPosition={[pointsAt[i][0] + origin[0], 1, pointsAt[i][2] + origin[2]]}
          onInteract={() => openLink(item.link.url)} />
      ))}
    </group>
  );
}

useGLTF.preload(AREAS_URL);
