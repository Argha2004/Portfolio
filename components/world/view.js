// Shared camera state. An area can take the camera over with a fixed cinematic shot
// (like Bruno Simon's view.cinematic) and hand it back to the chase camera later.
// view.cinematic = { position: [x, y, z], target: [x, y, z] } | null
// view.orbit = how far the player has turned the chase camera by dragging with the left mouse
// button, relative to the default angle (radians); view.dragging while the button is held
export const view = { cinematic: null, orbit: { yaw: 0, pitch: 0 }, dragging: false };

export const resetOrbit = () => { view.orbit.yaw = 0; view.orbit.pitch = 0; };
