import { projects } from "@/lib/projects";

// The world's asset list as plain data (no three.js / drei imports), so the page can put
// <link rel="preload"> tags for it in the HTML and the downloads start alongside the JavaScript.
// Anything missing here still loads on demand; it just isn't fetched up front.
const glb = (kit, names) => names.map((n) => `/models/${kit}/${n}.glb`);

export const MODELS = [
  ...glb("bruno", [
    "vehicle", "areas-projects-social", "poleLights", "cherryTreesVisual", "oakTreesVisual", "birchTreesVisual",
    "benches", "lanterns", "bricks", "explosiveCrates", "fences",
  ]),
  ...glb("roads", [
    "road-straight", "road-roundabout", "traffic-light", "construction-cone", "construction-fence",
    "construction-light", "construction-barrier", "dumpster",
  ]),
  ...glb("forest", ["tent", "rocks-high", "building-structure", "building-roof", "target"]),
  ...glb("arena", ["floor", "wall", "column", "statue", "banner", "weapon-rack", "block", "trophy", "character-soldier"]),
  ...glb("graveyard", [
    "pine", "pine-crooked", "trunk", "fire-basket", "iron-fence", "crypt-large", "lightpost-single",
    "gravestone-round", "gravestone-cross", "gravestone-broken", "gravestone-bevel", "pumpkin", "pumpkin-carved",
    "character-ghost", "rocks", "hay-bale",
  ]),
];

// Fetched by three's FileLoader (models reference these kit textures; Draco decodes the Bruno models)
export const FETCHED = [
  ...MODELS,
  ...["roads", "forest", "arena", "graveyard"].map((kit) => `/models/${kit}/Textures/colormap.png`),
  "/draco/draco_wasm_wrapper.js", "/draco/draco_decoder.wasm",
];

// Loaded as images by TextureLoader
export const TEXTURES = ["/models/bruno/slabs.png", "/models/bruno/ui/key-enter.png"];
export const PROJECT_SHOTS = projects.map((p) => p.image).filter(Boolean);
export const IMAGES = [...TEXTURES, "/models/bruno/foliageSDF.png", ...PROJECT_SHOTS];
