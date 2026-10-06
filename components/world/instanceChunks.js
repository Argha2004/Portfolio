import * as THREE from "three";

// ───────── Spatial chunks for big instanced meshes ─────────
// three.js frustum-culls an InstancedMesh as a whole, using one bounding sphere around every
// instance. Trees, foliage, props and barriers are spread over the whole island, so those
// meshes were never culled: every instance went through the GPU each frame (and again for the
// shadow map). This splits each such mesh into one InstancedMesh per map cell, sharing the
// material, so cells off screen (or outside the shadow camera) are skipped.
// The original stays in place, hidden, as the source: if its instances change later the chunks
// are rebuilt, and when it is removed (component unmounted) its chunks go with it.

const CELL = 72;        // metres per chunk
const MIN_RADIUS = 60;  // only meshes spread wider than this...
const MIN_TRIS = 3000;  // ...and heavy enough to matter

const sources = new Set();     // chunked originals still in the scene
const m = new THREE.Matrix4(), p = new THREE.Vector3(), col = new THREE.Color();
const version = (o) => o.instanceMatrix.version + (o.instanceColor ? o.instanceColor.version : 0) + o.count * 1e6;

function trisOf(o) {
  const g = o.geometry;
  return ((g.index ? g.index.count : g.attributes.position.count) / 3) * o.count;
}

function clear(o) {
  (o.userData.chunks || []).forEach((c) => {
    c.removeFromParent();
    if (c.geometry !== o.geometry) c.geometry.dispose();
    c.dispose();
  });
  o.userData.chunks = null;
}

function build(o) {
  clear(o);
  o.updateWorldMatrix(true, false);
  const cells = new Map();
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, m);
    p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  }
  if (cells.size < 2 || !o.parent) { o.visible = true; return; }

  // per-instance attributes other than the matrix / colour live on the geometry: slice them too
  const instAttrs = Object.entries(o.geometry.attributes).filter(([, a]) => a.isInstancedBufferAttribute);
  const chunks = [];
  for (const idx of cells.values()) {
    let g = o.geometry;
    if (instAttrs.length) {
      g = o.geometry.clone();
      for (const [name, a] of instAttrs) {
        const s = a.itemSize, arr = new a.array.constructor(idx.length * s);
        idx.forEach((src, j) => { for (let c = 0; c < s; c++) arr[j * s + c] = a.array[src * s + c]; });
        g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, s, a.normalized, a.meshPerAttribute));
      }
    }
    const c = new THREE.InstancedMesh(g, o.material, idx.length);
    idx.forEach((src, j) => {
      o.getMatrixAt(src, m); c.setMatrixAt(j, m);
      if (o.instanceColor) { o.getColorAt(src, col); c.setColorAt(j, col); }
    });
    c.name = o.name;
    c.castShadow = o.castShadow; c.receiveShadow = o.receiveShadow;
    c.renderOrder = o.renderOrder; c.layers.mask = o.layers.mask;
    c.customDepthMaterial = o.customDepthMaterial; c.customDistanceMaterial = o.customDistanceMaterial;
    c.userData = { ...o.userData, chunks: undefined, chunkOf: o };
    c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale);
    c.computeBoundingSphere();
    o.parent.add(c);
    chunks.push(c);
  }
  o.userData.chunks = chunks;
  o.userData.chunkVersion = version(o);
  o.visible = false;
}

// Chunk every qualifying instanced mesh currently in the scene. Returns how many were split.
export function chunkInstances(scene) {
  const list = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.userData.chunkOf || o.userData.chunks || o.userData.noChunk) return;
    if (!o.frustumCulled || o.instanceMatrix.usage === THREE.DynamicDrawUsage || o.count < 8) return;
    if (trisOf(o) < MIN_TRIS) return;
    o.computeBoundingSphere();
    if (o.boundingSphere.radius < MIN_RADIUS) return;
    list.push(o);
  });
  list.forEach((o) => {
    build(o);
    if (!o.userData.chunkWatch) {
      o.userData.chunkWatch = true;
      o.addEventListener("removed", () => { clear(o); sources.delete(o); });
    }
    sources.add(o);
  });
  return list.length;
}

// Cheap per-frame check: rebuild the chunks of any source whose instances changed since
export function syncChunks() {
  for (const o of sources) if (o.userData.chunks && o.userData.chunkVersion !== version(o)) build(o);
}
