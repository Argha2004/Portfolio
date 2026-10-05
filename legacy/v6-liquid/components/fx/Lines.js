// Masked line reveal: each line slides up out of its own clipping box when the parent gets .in.
export default function Lines({ lines, as: Tag = "div", className = "", delay = 0, step = 90 }) {
  return (
    <Tag className={`lines reveal ${className}`} aria-label={lines.join(" ")}>
      {lines.map((l, i) => (
        <span className="line" key={i} aria-hidden="true">
          <span style={{ transitionDelay: `${delay + i * step}ms` }}>{l}</span>
        </span>
      ))}
    </Tag>
  );
}
