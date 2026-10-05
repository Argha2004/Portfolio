import Flow from "./Flow";
import Bars from "./Bars";

// Numbered figure with caption; renders a project's figure spec from lib/projects.js.
export default function Figure({ n, spec, wide = false, children }) {
  return (
    <figure className={`fig reveal${wide ? " fig-wide" : ""}`}>
      <div className="fig-body">
        {children}
        {spec?.type === "flow" && <Flow columns={spec.columns} />}
        {spec?.type === "bars" && <Bars bars={spec.bars} min={spec.min} max={spec.max} />}
      </div>
      {(spec?.caption || n) && (
        <figcaption><b>Figure {n}.</b> {spec?.caption}</figcaption>
      )}
    </figure>
  );
}
