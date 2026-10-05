// Left-to-right architecture diagram: columns of labelled boxes joined by animated arrows.
export default function Flow({ columns }) {
  return (
    <div className="flow" style={{ "--cols": columns.length }}>
      {columns.map((c, i) => (
        <div className="flow-col" key={c.title} style={{ "--i": i }}>
          <span className="flow-title">{c.title}</span>
          <ul>{c.items.map((it) => <li key={it}>{it}</li>)}</ul>
          {i < columns.length - 1 && <span className="flow-arrow" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
