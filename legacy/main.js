// Smooth scroll
const lenis = new Lenis({ lerp: 0.08 });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
gsap.registerPlugin(ScrollTrigger);

document.querySelectorAll('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => { e.preventDefault(); lenis.scrollTo(a.getAttribute("href")); })
);

// Fluid colors — shift palette as the cursor moves
let hue = Math.random();
function hsv(h) {
  const i = Math.floor(h * 6), f = h * 6 - i, q = 1 - f;
  return [[1, f, 0], [q, 1, 0], [0, 1, f], [0, q, 1], [f, 0, 1], [1, 0, q]][i % 6].map((v) => v * 0.15);
}

// Pointer → fluid + custom cursor
const cursor = document.querySelector(".cursor");
let px = null, py = null;
function move(x, y) {
  gsap.to(cursor, { x, y, duration: 0.15, ease: "power3.out" });
  const nx = x / innerWidth, ny = 1 - y / innerHeight;
  if (px !== null) {
    const dx = nx - px, dy = ny - py;
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      hue = (hue + 0.002) % 1;
      window.Fluid.splat(nx, ny, dx, dy, hsv(hue));
    }
  }
  px = nx; py = ny;
}
addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
addEventListener("touchmove", (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

// Ambient splats so the hero is alive before the user moves
for (let i = 0; i < 6; i++) {
  setTimeout(() => {
    const c = hsv(Math.random());
    window.Fluid.splat(Math.random(), Math.random(), (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, c.map((v) => v * 8));
  }, i * 120);
}

// Intro
gsap.to(".title .line > span", { y: 0, duration: 1.4, ease: "expo.out", stagger: 0.12, delay: 0.2 });

// Scroll reveals
gsap.utils.toArray(".reveal").forEach((el) =>
  gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } })
);
gsap.utils.toArray(".project").forEach((el, i) =>
  gsap.from(el, { y: 80, opacity: 0, duration: 1.2, ease: "expo.out", delay: i * 0.05, scrollTrigger: { trigger: el, start: "top 92%" } })
);

// Hero title parallax
gsap.to(".title", { yPercent: -30, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

// Project hover → burst of that project's color into the fluid
document.querySelectorAll(".project, a").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    cursor.classList.add("big");
    const hex = el.dataset.color;
    if (hex) {
      const n = parseInt(hex.slice(1), 16);
      const c = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      if (px !== null) window.Fluid.splat(px, py, 0.004, 0.004, c.map((v) => v * 1.5));
    }
  });
  el.addEventListener("mouseleave", () => cursor.classList.remove("big"));
});
