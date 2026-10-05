import { publication, awards, certifications } from "@/lib/data";

// Black band of honours, styled as a simple ledger.
export default function Recognition() {
  const rows = [
    { year: "2026", title: "IEEE COMSNETS 2026", what: "Co-authored demo paper — CrowdLense", href: publication.href },
    ...awards.filter((a) => !a.title.startsWith("IEEE")).map((a) => ({ year: a.year, title: a.title, what: a.detail })),
    ...certifications.map((c) => ({ year: c.date.split(" ").pop(), title: c.title, what: c.issuer, href: c.href })),
  ];
  return (
    <section className="recog" data-nav="light">
      <span className="label">(04) Recognition</span>
      <ul className="ledger">
        {rows.map((r) => {
          const Row = r.href ? "a" : "div";
          return (
            <li key={r.title} className="reveal fade">
              <Row className="ledger-row" {...(r.href ? { href: r.href, target: "_blank", rel: "noreferrer", "data-cursor": "Open" } : {})}>
                <span>{r.year}</span>
                <strong>{r.title}</strong>
                <span>{r.what}</span>
                <span className="ledger-go">{r.href ? "↗" : ""}</span>
              </Row>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
