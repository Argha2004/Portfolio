import { Fragment } from "react";

// Splits text into characters (grouped by word so lines break cleanly). Each char flips up in 3D
// when the element gets .in (added by Reveal). `as` picks the wrapper tag.
export default function SplitText({ text, as: Tag = "span", className = "", delay = 0, step = 22 }) {
  let i = 0;
  const words = text.split(" ");
  return (
    <Tag className={`split reveal ${className}`} aria-label={text}>
      {words.map((word, w) => (
        <Fragment key={w}>
          <span className="word" aria-hidden="true">
            {[...word].map((ch) => (
              <span className="ch" key={i} style={{ "--d": `${delay + i++ * step}ms` }}>{ch}</span>
            ))}
          </span>
          {/* Space lives outside the inline-block word, otherwise it collapses */}
          {w < words.length - 1 && " "}
        </Fragment>
      ))}
    </Tag>
  );
}
