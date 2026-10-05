// Shared camera state. An area can take the camera over with a fixed cinematic shot
// (like Bruno Simon's view.cinematic) and hand it back to the chase camera later.
// view.cinematic = { position: [x, y, z], target: [x, y, z] } | null
export const view = { cinematic: null };
