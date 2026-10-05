"use client";
import { useEffect, useRef } from "react";

// Real-time Navier–Stokes fluid (stable-fluids on the GPU, WebGL2).
// Renders dye on black; the canvas is blended with `screen`, so black is invisible
// and only the coloured ink shows over the page.
const CFG = {
  SIM_RES: 128, DYE_RES: 720,
  DENSITY_DISSIPATION: 0.975, VELOCITY_DISSIPATION: 0.985,
  PRESSURE_ITER: 18, CURL: 24, SPLAT_RADIUS: 0.0022, SPLAT_FORCE: 5200,
};
const PALETTE = [[0.37, 0.95, 1.0], [0.55, 0.36, 0.96], [1.0, 0.31, 0.85], [0.3, 0.55, 1.0]];

const vs = `#version 300 es
in vec2 p; out vec2 uv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texel;
void main(){ uv=p*.5+.5; vL=uv-vec2(texel.x,0.); vR=uv+vec2(texel.x,0.);
  vT=uv+vec2(0.,texel.y); vB=uv-vec2(0.,texel.y); gl_Position=vec4(p,0.,1.); }`;
const head = `#version 300 es
precision highp float; in vec2 uv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;\n`;
const FS = {
  splat: head + `uniform sampler2D t; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main(){ vec2 d=uv-point; d.x*=aspect; vec3 s=exp(-dot(d,d)/radius)*color; o=vec4(texture(t,uv).xyz+s,1.); }`,
  advect: head + `uniform sampler2D vel; uniform sampler2D src; uniform vec2 simTexel; uniform float dt; uniform float diss;
    void main(){ vec2 c=uv-dt*texture(vel,uv).xy*simTexel; o=diss*texture(src,c); o.a=1.; }`,
  curl: head + `uniform sampler2D vel;
    void main(){ float L=texture(vel,vL).y,R=texture(vel,vR).y,T=texture(vel,vT).x,B=texture(vel,vB).x; o=vec4(.5*(R-L-T+B),0.,0.,1.); }`,
  vort: head + `uniform sampler2D vel; uniform sampler2D curl; uniform float k; uniform float dt;
    void main(){ float L=texture(curl,vL).x,R=texture(curl,vR).x,T=texture(curl,vT).x,B=texture(curl,vB).x,C=texture(curl,uv).x;
      vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=k*C; f.y*=-1.;
      o=vec4(texture(vel,uv).xy+f*dt,0.,1.); }`,
  div: head + `uniform sampler2D vel;
    void main(){ float L=texture(vel,vL).x,R=texture(vel,vR).x,T=texture(vel,vT).y,B=texture(vel,vB).y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
  scale: head + `uniform sampler2D t; uniform float v; void main(){ o=v*texture(t,uv); }`,
  pressure: head + `uniform sampler2D pr; uniform sampler2D dv;
    void main(){ float L=texture(pr,vL).x,R=texture(pr,vR).x,T=texture(pr,vT).x,B=texture(pr,vB).x;
      o=vec4((L+R+B+T-texture(dv,uv).x)*.25,0.,0.,1.); }`,
  grad: head + `uniform sampler2D pr; uniform sampler2D vel;
    void main(){ float L=texture(pr,vL).x,R=texture(pr,vR).x,T=texture(pr,vT).x,B=texture(pr,vB).x;
      o=vec4(texture(vel,uv).xy-vec2(R-L,T-B),0.,1.); }`,
  display: head + `uniform sampler2D t; void main(){ vec3 c=texture(t,uv).rgb; o=vec4(pow(c, vec3(.9)),1.); }`,
};

export default function Fluid() {
  const ref = useRef();

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) { canvas.style.display = "none"; return; }
    gl.getExtension("OES_texture_float_linear");

    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vShader = compile(gl.VERTEX_SHADER, vs);
    const P = {};
    for (const k in FS) {
      const prog = gl.createProgram();
      gl.attachShader(prog, vShader); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS[k]));
      gl.bindAttribLocation(prog, 0, "p"); gl.linkProgram(prog);
      const u = {}, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(prog, i).name; u[name] = gl.getUniformLocation(prog, name); }
      P[k] = { prog, u };
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);

    const fbo = (w, h, fmt, ifmt) => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    };
    const dfbo = (w, h, fmt, ifmt) => {
      let a = fbo(w, h, fmt, ifmt), b = fbo(w, h, fmt, ifmt);
      return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, w, h };
    };
    const res = (r) => {
      let ar = gl.drawingBufferWidth / gl.drawingBufferHeight; if (ar < 1) ar = 1 / ar;
      const mx = Math.round(r * ar), mn = Math.round(r);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? [mx, mn] : [mn, mx];
    };

    let dye, vel, div, curl, pres;
    const init = () => {
      const dpr = Math.min(devicePixelRatio, 1.5);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      const [sw, sh] = res(CFG.SIM_RES), [dw, dh] = res(CFG.DYE_RES);
      dye = dfbo(dw, dh, gl.RGBA, gl.RGBA16F);
      vel = dfbo(sw, sh, gl.RG, gl.RG16F);
      div = fbo(sw, sh, gl.RED, gl.R16F);
      curl = fbo(sw, sh, gl.RED, gl.R16F);
      pres = dfbo(sw, sh, gl.RED, gl.R16F);
    };
    init();

    const run = (p, target, w, h) => {
      if (p.u.texel) gl.uniform2f(p.u.texel, 1 / w, 1 / h);
      gl.viewport(0, 0, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
    const use = (k) => { gl.useProgram(P[k].prog); return P[k].u; };

    const splat = (x, y, dx, dy, color) => {
      const ar = canvas.width / canvas.height;
      let u = use("splat");
      gl.uniform1i(u.t, vel.read.attach(0));
      gl.uniform1f(u.aspect, ar);
      gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, dx * CFG.SPLAT_FORCE, dy * CFG.SPLAT_FORCE, 0);
      gl.uniform1f(u.radius, CFG.SPLAT_RADIUS * (ar > 1 ? ar : 1));
      run(P.splat, vel.write, vel.w, vel.h); vel.swap();
      u = use("splat");
      gl.uniform1i(u.t, dye.read.attach(0));
      gl.uniform3f(u.color, color[0], color[1], color[2]);
      run(P.splat, dye.write, dye.w, dye.h); dye.swap();
    };

    const step = (dt) => {
      const { w, h } = vel;
      let u = use("curl"); gl.uniform1i(u.vel, vel.read.attach(0)); run(P.curl, curl, w, h);
      u = use("vort"); gl.uniform1i(u.vel, vel.read.attach(0)); gl.uniform1i(u.curl, curl.attach(1));
      gl.uniform1f(u.k, CFG.CURL); gl.uniform1f(u.dt, dt); run(P.vort, vel.write, w, h); vel.swap();
      u = use("div"); gl.uniform1i(u.vel, vel.read.attach(0)); run(P.div, div, w, h);
      u = use("scale"); gl.uniform1i(u.t, pres.read.attach(0)); gl.uniform1f(u.v, 0.8); run(P.scale, pres.write, w, h); pres.swap();
      u = use("pressure"); gl.uniform1i(u.dv, div.attach(0));
      for (let i = 0; i < CFG.PRESSURE_ITER; i++) { gl.uniform1i(u.pr, pres.read.attach(1)); run(P.pressure, pres.write, w, h); pres.swap(); }
      u = use("grad"); gl.uniform1i(u.pr, pres.read.attach(0)); gl.uniform1i(u.vel, vel.read.attach(1)); run(P.grad, vel.write, w, h); vel.swap();
      u = use("advect"); gl.uniform1f(u.dt, dt); gl.uniform2f(u.simTexel, 1 / w, 1 / h);
      gl.uniform1i(u.vel, vel.read.attach(0)); gl.uniform1i(u.src, vel.read.attach(0)); gl.uniform1f(u.diss, CFG.VELOCITY_DISSIPATION);
      run(P.advect, vel.write, w, h); vel.swap();
      u = use("advect"); gl.uniform1i(u.vel, vel.read.attach(0)); gl.uniform1i(u.src, dye.read.attach(1)); gl.uniform1f(u.diss, CFG.DENSITY_DISSIPATION);
      run(P.advect, dye.write, dye.w, dye.h); dye.swap();
    };

    // Pointer → splats; colour drifts through the palette
    let last = null, hue = 0;
    const color = () => {
      hue = (hue + 0.004) % PALETTE.length;
      const a = PALETTE[Math.floor(hue)], b = PALETTE[(Math.floor(hue) + 1) % PALETTE.length], f = hue % 1;
      return a.map((v, i) => (v + (b[i] - v) * f) * 0.16);
    };
    const queue = [];
    const move = (x, y) => {
      const nx = x / innerWidth, ny = 1 - y / innerHeight;
      if (last) queue.push([nx, ny, nx - last[0], ny - last[1], color()]);
      last = [nx, ny];
    };
    const onPointer = (e) => move(e.clientX, e.clientY);
    const onTouch = (e) => move(e.touches[0].clientX, e.touches[0].clientY);
    const onResize = () => init();
    addEventListener("pointermove", onPointer);
    addEventListener("touchmove", onTouch, { passive: true });
    addEventListener("resize", onResize);

    // A few ambient swirls so it's alive before the visitor moves
    for (let i = 0; i < 5; i++) queue.push([Math.random(), Math.random(), (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, PALETTE[i % 4].map((v) => v * 0.6)]);

    let raf, prev = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - prev) / 1000, 0.016); prev = now;
      while (queue.length) splat(...queue.shift());
      step(dt);
      const u = use("display"); gl.uniform1i(u.t, dye.read.attach(0));
      run(P.display, null, gl.drawingBufferWidth, gl.drawingBufferHeight);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onPointer);
      removeEventListener("touchmove", onTouch);
      removeEventListener("resize", onResize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} className="fluid" aria-hidden="true" />;
}
