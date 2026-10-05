import { references } from "@/lib/data";

// Inline citation "[n]" that links to the bibliography and previews the entry on hover/focus.
export default function Cite({ n }) {
  const ref = references.find((r) => r.n === n);
  return (
    <span className="cite">
      <a href={`#ref-${n}`}>[{n}]</a>
      {ref && <span className="cite-pop" role="tooltip">{ref.text}</span>}
    </span>
  );
}
