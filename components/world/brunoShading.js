import * as THREE from "three";

// ───────── Bruno Simon's shading model (folio-2025, MIT: Materials/MeshDefaultMaterial.js) ─────────
// Instead of physically based lighting, every surface is its base colour × one light colour, and it
// slides towards base × a coloured *shadow* tint wherever it faces away from the sun ("core shadow")
// or sits in a cast shadow. Emissive parts are added on top, and any surface that crosses the water
// line gets a thin white band, which is what makes his ponds read as water.
//
// Applied globally by patching three's final output chunk for the lit built-in materials
// (Lambert / Phong / Standard / Physical), so every model in the world shares the same look.
// The light colour comes from the sun (directional light 0: colour × intensity) and the shadow
// tint from the hemisphere light's ground colour, so the day / night cycle (dayCycle.js) can
// animate both by just setting those two lights. LOOK holds the fallback (his "dawn" preset).
const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const v3 = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

export const LOOK = {
  light: lin("#ffc0a0", 1.15),      // his dawn light (#ffa882 × 1.2), a touch softer
  shadow: lin("#c0306a"),           // his dawn shadow (#db004f), slightly less saturated
  coreShadowLow: -0.25,             // his coreShadowEdgeLow / High
  coreShadowHigh: 1.0,
  waterY: -0.3,                     // his water surfaceElevation
};

const patch = /* glsl */ `
#if defined( LAMBERT ) || defined( STANDARD ) || defined( PHONG )
{
  vec3 bBase = diffuseColor.rgb;
  vec3 bWorld = cameraPosition + transpose( mat3( viewMatrix ) ) * ( - vViewPosition );

  // Weather (weather.js), passed in the hemisphere light's sky colour: x = snow cover, y = wet
  #if NUM_HEMI_LIGHTS > 0
  {
    vec3 bWeather = hemisphereLights[ 0 ].skyColor;
    float bUp = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ).y;
    // wet ground: darker after rain
    bBase *= 1.0 - 0.32 * bWeather.y * smoothstep( 0.3, 0.9, bUp );
    // settled snow: noisy patches on upward faces, above the water line
    vec2 bP = bWorld.xz * 0.12, bI = floor( bP ), bF = fract( bP );
    bF = bF * bF * ( 3.0 - 2.0 * bF );
    float bA = fract( sin( dot( bI, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    float bB = fract( sin( dot( bI + vec2( 1.0, 0.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    float bC = fract( sin( dot( bI + vec2( 0.0, 1.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    float bD = fract( sin( dot( bI + vec2( 1.0, 1.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    float bN = mix( mix( bA, bB, bF.x ), mix( bC, bD, bF.x ), bF.y );
    float bCover = bWeather.x;
    float bSnow = smoothstep( 1.0 - bCover - 0.12, 1.0 - bCover + 0.12, bN * 0.85 + 0.15 * bCover )
      * smoothstep( 0.35, 0.75, bUp ) * smoothstep( -0.25, -0.1, bWorld.y ) * step( 0.001, bCover );
    bBase = mix( bBase, vec3( 0.93, 0.95, 1.0 ), bSnow );
  }
  #endif

  // Core shadow: faces turning away from the sun
  float bCore = 0.0;
  #if NUM_DIR_LIGHTS > 0
    bCore = smoothstep( ${LOOK.coreShadowHigh.toFixed(2)}, ${LOOK.coreShadowLow.toFixed(2)}, dot( normal, directionalLights[ 0 ].direction ) );
  #endif

  // Cast shadow from the sun's shadow map
  float bCast = 0.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    if ( receiveShadow ) {
      DirectionalLightShadow bS = directionalLightShadows[ 0 ];
      bCast = 1.0 - getShadow( directionalShadowMap[ 0 ], bS.shadowMapSize, bS.shadowIntensity, bS.shadowBias, bS.shadowRadius, vDirectionalShadowCoord[ 0 ] );
    }
  #endif

  vec3 bLightCol = ${v3(LOOK.light)};
  vec3 bShadowCol = ${v3(LOOK.shadow)};
  #if NUM_DIR_LIGHTS > 0
    bLightCol = directionalLights[ 0 ].color;
  #endif
  #if NUM_HEMI_LIGHTS > 0
    bShadowCol = hemisphereLights[ 0 ].groundColor;
  #endif
  vec3 bLit = bBase * bLightCol;
  vec3 bShade = bBase * bShadowCol;
  outgoingLight = mix( bLit, bShade, clamp( max( bCore, bCast ), 0.0, 1.0 ) ) + totalEmissiveRadiance;

  // Local lights (bomb flashes, the campfire, lamp posts, the car's headlight) are added on top,
  // softly wrapped so the ground under a light catches it. (His model has no local lights, so
  // without this they lit nothing at night.)
  vec3 bLocal = vec3( 0.0 );
  vec3 bPos = - vViewPosition;
  #if NUM_POINT_LIGHTS > 0
  for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
    vec3 bL = pointLights[ i ].position - bPos;
    float bD = length( bL );
    float bAtt = getDistanceAttenuation( bD, pointLights[ i ].distance, pointLights[ i ].decay );
    bLocal += pointLights[ i ].color * bAtt * ( dot( normal, bL / max( bD, 1e-4 ) ) * 0.5 + 0.5 );
  }
  #endif
  #if NUM_SPOT_LIGHTS > 0
  for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
    vec3 bL = spotLights[ i ].position - bPos;
    float bD = length( bL );
    vec3 bDir = bL / max( bD, 1e-4 );
    float bCone = smoothstep( spotLights[ i ].coneCos, spotLights[ i ].penumbraCos, dot( bDir, spotLights[ i ].direction ) );
    float bAtt = getDistanceAttenuation( bD, spotLights[ i ].distance, spotLights[ i ].decay );
    bLocal += spotLights[ i ].color * bAtt * bCone * ( max( dot( normal, bDir ), 0.0 ) * 0.7 + 0.3 );
  }
  #endif
  outgoingLight += bBase * bLocal * 0.45;

  // White water line where the surface crosses the water plane
  float bDy = abs( bWorld.y - ( ${LOOK.waterY.toFixed(3)} ) );
  float bW = max( fwidth( bWorld.y ), 0.004 );
  outgoingLight = mix( outgoingLight, vec3( 1.0 ), 1.0 - smoothstep( 0.02, 0.02 + bW * 1.5, bDy ) );
}
#endif
`;

let applied = false;
export function applyBrunoShading() {
  if (applied) return;
  applied = true;
  THREE.ShaderChunk.opaque_fragment = THREE.ShaderChunk.opaque_fragment.replace(
    "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
    `${patch}\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );`
  );
}
applyBrunoShading();
