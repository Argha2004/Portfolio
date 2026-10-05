// Compact WebGL2 stable-fluids simulation (Navier–Stokes on the GPU).
// Exposes window.Fluid = { splat(x, y, dx, dy, color) } — coords in 0..1.
(() => {
  const canvas = document.getElementById("fluid");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
    window.Fluid = { splat() {} };
    return;
  }
  gl.getExtension("OES_texture_float_linear");

  const CFG = {
    SIM_RES: 128, DYE_RES: 1024,
    DENSITY_DISSIPATION: 0.985, VELOCITY_DISSIPATION: 0.99,
    PRESSURE_ITER: 20, CURL: 28, SPLAT_RADIUS: 0.0025, SPLAT_FORCE: 6000,
  };

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
    advect: head + `uniform sampler2D vel; uniform sampler2D src; uniform vec2 texel; uniform float dt; uniform float diss;
      void main(){ vec2 c=uv-dt*texture(vel,uv).xy*texel; o=diss*texture(src,c); o.a=1.; }`,
    curl: head + `uniform sampler2D vel;
      void main(){ float L=texture(vel,vL).y,R=texture(vel,vR).y,T=texture(vel,vT).x,B=texture(vel,vB).x; o=vec4(.5*(R-L-T+B),0.,0.,1.); }`,
    vort: head + `uniform sampler2D vel; uniform sampler2D curl; uniform float k; uniform float dt;
      void main(){ float L=texture(curl,vL).x,R=texture(curl,vR).x,T=texture(curl,vT).x,B=texture(curl,vB).x,C=texture(curl,uv).x;
        vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=k*C; f.y*=-1.;
        o=vec4(texture(vel,uv).xy+f*dt,0.,1.); }`,
    div: head + `uniform sampler2D vel;
      void main(){ float L=texture(vel,vL).x,R=texture(vel,vR).x,T=texture(vel,vT).y,B=texture(vel,vB).y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
    clear: head + `uniform sampler2D t; uniform float v; void main(){ o=v*texture(t,uv); }`,
    pressure: head + `uniform sampler2D pr; uniform sampler2D dv;
      void main(){ float L=texture(pr,vL).x,R=texture(pr,vR).x,T=texture(pr,vT).x,B=texture(pr,vB).x;
        o=vec4((L+R+B+T-texture(dv,uv).x)*.25,0.,0.,1.); }`,
    grad: head + `uniform sampler2D pr; uniform sampler2D vel;
      void main(){ float L=texture(pr,vL).x,R=texture(pr,vR).x,T=texture(pr,vT).x,B=texture(pr,vB).x;
        o=vec4(texture(vel,uv).xy-vec2(R-L,T-B),0.,1.); }`,
    display: head + `uniform sampler2D t;
      void main(){ vec3 c=texture(t,uv).rgb; float a=max(c.r,max(c.g,c.b)); o=vec4(pow(c,vec3(.85))+vec3(.039)*(1.-a),1.); }`,
  };

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
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

  function fbo(w, h, fmt, ifmt) {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
  }
  function dfbo(w, h, fmt, ifmt) {
    let a = fbo(w, h, fmt, ifmt), b = fbo(w, h, fmt, ifmt);
    return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, w, h };
  }
  function res(r) {
    let ar = gl.drawingBufferWidth / gl.drawingBufferHeight; if (ar < 1) ar = 1 / ar;
    const mx = Math.round(r * ar), mn = Math.round(r);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? [mx, mn] : [mn, mx];
  }

  let dye, vel, div, curl, pres;
  function init() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    const [sw, sh] = res(CFG.SIM_RES), [dw, dh] = res(CFG.DYE_RES);
    dye = dfbo(dw, dh, gl.RGBA, gl.RGBA16F);
    vel = dfbo(sw, sh, gl.RG, gl.RG16F);
    div = fbo(sw, sh, gl.RED, gl.R16F);
    curl = fbo(sw, sh, gl.RED, gl.R16F);
    pres = dfbo(sw, sh, gl.RED, gl.R16F);
  }
  init();
  addEventListener("resize", init);

  function run(p, target, w, h) {
    gl.useProgram(p.prog);
    if (p.u.texel) gl.uniform2f(p.u.texel, 1 / w, 1 / h);
    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function splat(x, y, dx, dy, color) {
    const ar = canvas.width / canvas.height, s = P.splat;
    gl.useProgram(s.prog);
    gl.uniform1i(s.u.t, vel.read.attach(0));
    gl.uniform1f(s.u.aspect, ar);
    gl.uniform2f(s.u.point, x, y);
    gl.uniform3f(s.u.color, dx * CFG.SPLAT_FORCE, dy * CFG.SPLAT_FORCE, 0);
    gl.uniform1f(s.u.radius, CFG.SPLAT_RADIUS * (ar > 1 ? ar : 1));
    run(s, vel.write, vel.w, vel.h); vel.swap();
    gl.useProgram(s.prog);
    gl.uniform1i(s.u.t, dye.read.attach(0));
    gl.uniform3f(s.u.color, color[0], color[1], color[2]);
    run(s, dye.write, dye.w, dye.h); dye.swap();
  }

  function step(dt) {
    const { w, h } = vel;
    gl.useProgram(P.curl.prog); gl.uniform1i(P.curl.u.vel, vel.read.attach(0)); run(P.curl, curl, w, h);
    gl.useProgram(P.vort.prog);
    gl.uniform1i(P.vort.u.vel, vel.read.attach(0)); gl.uniform1i(P.vort.u.curl, curl.attach(1));
    gl.uniform1f(P.vort.u.k, CFG.CURL); gl.uniform1f(P.vort.u.dt, dt);
    run(P.vort, vel.write, w, h); vel.swap();

    gl.useProgram(P.div.prog); gl.uniform1i(P.div.u.vel, vel.read.attach(0)); run(P.div, div, w, h);

    gl.useProgram(P.clear.prog); gl.uniform1i(P.clear.u.t, pres.read.attach(0)); gl.uniform1f(P.clear.u.v, 0.8);
    run(P.clear, pres.write, w, h); pres.swap();
    gl.useProgram(P.pressure.prog); gl.uniform1i(P.pressure.u.dv, div.attach(0));
    for (let i = 0; i < CFG.PRESSURE_ITER; i++) {
      gl.uniform1i(P.pressure.u.pr, pres.read.attach(1)); run(P.pressure, pres.write, w, h); pres.swap();
    }
    gl.useProgram(P.grad.prog);
    gl.uniform1i(P.grad.u.pr, pres.read.attach(0)); gl.uniform1i(P.grad.u.vel, vel.read.attach(1));
    run(P.grad, vel.write, w, h); vel.swap();

    const a = P.advect;
    gl.useProgram(a.prog); gl.uniform1f(a.u.dt, dt);
    gl.uniform1i(a.u.vel, vel.read.attach(0)); gl.uniform1i(a.u.src, vel.read.attach(0));
    gl.uniform1f(a.u.diss, CFG.VELOCITY_DISSIPATION);
    run(a, vel.write, w, h); vel.swap();
    gl.useProgram(a.prog); gl.uniform2f(a.u.texel, 1 / w, 1 / h);
    gl.uniform1i(a.u.vel, vel.read.attach(0)); gl.uniform1i(a.u.src, dye.read.attach(1));
    gl.uniform1f(a.u.diss, CFG.DENSITY_DISSIPATION);
    gl.viewport(0, 0, dye.w, dye.h); gl.bindFramebuffer(gl.FRAMEBUFFER, dye.write.fb);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); dye.swap();
  }

  let last = performance.now();
  (function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.016); last = now;
    step(dt);
    gl.useProgram(P.display.prog); gl.uniform1i(P.display.u.t, dye.read.attach(0));
    run(P.display, null, gl.drawingBufferWidth, gl.drawingBufferHeight);
    requestAnimationFrame(loop);
  })(last);

  window.Fluid = { splat };
})();
