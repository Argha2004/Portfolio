"use client";
import { useEffect, useMemo, useRef } from "react";

// A tiny feed-forward network (3 → 6 → 6 → 3, tanh) evaluated live every frame.
// Inputs come from the cursor position over the figure plus a slow clock; edge colour/width
// show the signed contribution w·a flowing into each neuron.
const LAYERS = [3, 6, 6, 3];
const IN_LABELS = ["x₁ cursor x", "x₂ cursor y", "x₃ time"];
const OUT_LABELS = ["Edge AI", "Medical Imaging", "LLM Systems"];
const W = 680, H = 340, PAD_L = 110, PAD_R = 190, PAD_Y = 34;

// Deterministic weights so the figure looks the same on every visit
function prng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
}

export default function NeuralNet() {
  const svg = useRef();
  const input = useRef([0.3, -0.2]);

  const net = useMemo(() => {
    const r = prng(42);
    const weights = [], biases = [];
    for (let l = 1; l < LAYERS.length; l++) {
      weights.push(Array.from({ length: LAYERS[l] }, () => Array.from({ length: LAYERS[l - 1] }, () => r() * 1.6)));
      biases.push(Array.from({ length: LAYERS[l] }, () => r() * 0.3));
    }
    const x = (l) => PAD_L + (l * (W - PAD_L - PAD_R)) / (LAYERS.length - 1);
    const y = (l, i) => PAD_Y + ((i + 0.5) * (H - PAD_Y * 2)) / LAYERS[l];
    const nodes = LAYERS.map((n, l) => Array.from({ length: n }, (_, i) => ({ x: x(l), y: y(l, i) })));
    return { weights, biases, nodes };
  }, []);

  useEffect(() => {
    const el = svg.current;
    const edges = el.querySelectorAll("[data-edge]");
    const nodes = el.querySelectorAll("[data-node]");
    const outs = el.querySelectorAll("[data-out]");
    let raf, visible = false, t0 = performance.now();

    const onMove = (e) => {
      const b = el.getBoundingClientRect();
      input.current = [((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1].map((v) => Math.max(-1, Math.min(1, v)));
    };

    const frame = (now) => {
      const t = (now - t0) / 1000;
      let a = [input.current[0], -input.current[1], Math.sin(t * 0.8)];
      const acts = [a];
      const contrib = [];
      net.weights.forEach((Wl, l) => {
        const c = Wl.map((row) => row.map((w, j) => w * a[j]));
        contrib.push(c);
        a = c.map((row, i) => Math.tanh(row.reduce((s, v) => s + v, 0) + net.biases[l][i]));
        acts.push(a);
      });
      let k = 0;
      contrib.forEach((c) => c.forEach((row) => row.forEach((v) => {
        const e = edges[k++];
        e.setAttribute("stroke-width", (0.4 + Math.min(Math.abs(v), 1.5) * 2.2).toFixed(2));
        e.setAttribute("stroke-opacity", (0.12 + Math.min(Math.abs(v), 1) * 0.75).toFixed(2));
        e.dataset.sign = v >= 0 ? "pos" : "neg";
      })));
      k = 0;
      acts.forEach((layer) => layer.forEach((v) => {
        const n = nodes[k++];
        n.setAttribute("fill-opacity", (0.08 + Math.abs(v) * 0.85).toFixed(2));
        n.dataset.sign = v >= 0 ? "pos" : "neg";
      }));
      acts[acts.length - 1].forEach((v, i) => { outs[i].textContent = ((v + 1) / 2).toFixed(2); });
      if (visible) raf = requestAnimationFrame(frame);
    };

    // Only animate while on screen
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(el);
    window.addEventListener("pointermove", onMove);
    frame(performance.now());
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); };
  }, [net]);

  return (
    <svg ref={svg} className="nn" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Animated neural network diagram whose activations follow the cursor">
      <g>
        {net.weights.map((Wl, l) => Wl.map((row, i) => row.map((_, j) => (
          <line key={`${l}-${i}-${j}`} data-edge x1={net.nodes[l][j].x} y1={net.nodes[l][j].y} x2={net.nodes[l + 1][i].x} y2={net.nodes[l + 1][i].y} />
        ))))}
      </g>
      <g>
        {net.nodes.map((layer, l) => layer.map((n, i) => (
          <circle key={`${l}-${i}`} data-node cx={n.x} cy={n.y} r={l === 0 || l === LAYERS.length - 1 ? 11 : 9} />
        )))}
      </g>
      <g className="nn-labels">
        {net.nodes[0].map((n, i) => <text key={i} x={n.x - 20} y={n.y + 4} textAnchor="end">{IN_LABELS[i]}</text>)}
        {net.nodes[LAYERS.length - 1].map((n, i) => (
          <text key={i} x={n.x + 20} y={n.y + 4}>{OUT_LABELS[i]} <tspan data-out className="nn-val">0.50</tspan></text>
        ))}
        {["input", "hidden 1", "hidden 2", "output"].map((t, l) => (
          <text key={t} className="nn-layer" x={net.nodes[l][0].x} y={H - 6} textAnchor="middle">{t}</text>
        ))}
      </g>
    </svg>
  );
}
