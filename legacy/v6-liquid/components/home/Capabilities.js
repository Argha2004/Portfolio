"use client";
import { useState } from "react";
import { skills } from "@/lib/data";

// Accordion rows: hovering/clicking a row opens it and shows the tools.
export default function Capabilities() {
  const [open, setOpen] = useState(0);
  return (
    <section className="caps">
      <div className="caps-head">
        <span className="label">(03) Capabilities</span>
        <h2 className="display reveal fade">What I do</h2>
      </div>
      <ul className="caps-list">
        {skills.map(([area, tools], i) => (
          <li key={area} className={`cap reveal fade${open === i ? " open" : ""}`} onMouseEnter={() => setOpen(i)}>
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span className="cap-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="cap-title">{area}</span>
              <span className="cap-plus" aria-hidden="true" />
            </button>
            <div className="cap-body"><p>{tools}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
