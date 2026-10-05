"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Sticky contents list built from the article's numbered headings; highlights the section in view.
export default function Toc() {
  const pathname = usePathname();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const heads = [...document.querySelectorAll("article h2[id]")];
    setItems(heads.map((h) => ({ id: h.id, num: h.dataset.num, label: h.dataset.label || h.textContent })));
    // Active = the last heading whose top has passed 30% of the viewport
    const update = () => {
      let current = heads[0]?.id;
      for (const h of heads) if (h.getBoundingClientRect().top < innerHeight * 0.3) current = h.id;
      setActive(current);
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, [pathname]);

  if (!items.length) return null;
  return (
    <nav className="toc" aria-label="Contents">
      <span className="toc-title">Contents</span>
      <ol>
        {items.map((it) => (
          <li key={it.id} className={active === it.id ? "on" : ""}>
            <a href={`#${it.id}`}><span>{it.num}</span>{it.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
