// Tufte-style sidenote: a numbered marker in the text, the note itself floats into the right margin.
export function Note({ n, children }) {
  return (
    <>
      <sup className="note-ref">{n}</sup>
      <small className="sidenote"><sup>{n}</sup> {children}</small>
    </>
  );
}

// Margin note without a number (for asides next to a paragraph).
export function Margin({ children }) {
  return <small className="sidenote sidenote-plain">{children}</small>;
}
