const words = ["Deep Learning", "Edge AI", "LLM Agents", "Medical Imaging", "On-Device AI", "Computer Vision", "Android", "MCP"];

// Two tilted, counter-scrolling glass bands (pure CSS animation)
export default function Ticker() {
  const row = (k) => words.map((w) => <span key={k + w}>{w}<i>✦</i></span>);
  return (
    <div className="ticker" aria-hidden="true">
      <div className="band band-a"><div className="band-track">{row("a")}{row("b")}</div></div>
      <div className="band band-b"><div className="band-track">{row("c")}{row("d")}</div></div>
    </div>
  );
}
