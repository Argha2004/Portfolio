// Horizontal bar chart (SVG-free, so text stays crisp and selectable). Bars grow when the figure is revealed.
export default function Bars({ bars, min = 0, max = 1 }) {
  const ticks = 6;
  const pct = (v) => ((v - min) / (max - min)) * 100;
  return (
    <div className="bars">
      {bars.map(([label, v], i) => (
        <div className="bar-row" key={label}>
          <span className="bar-label">{label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ "--w": `${pct(v)}%`, "--d": `${i * 120}ms` }} data-best={v === Math.max(...bars.map((b) => b[1])) || undefined} />
          </span>
          <span className="bar-value">{v.toFixed(3)}</span>
        </div>
      ))}
      <div className="bar-axis" aria-hidden="true">
        <span />
        <span className="bar-ticks">
          {Array.from({ length: ticks }, (_, i) => <i key={i}>{(min + ((max - min) * i) / (ticks - 1)).toFixed(2)}</i>)}
        </span>
        <span />
      </div>
    </div>
  );
}
