import { profile, socials, skills, education, coursework, publication, awards, certifications, interests } from "@/lib/data";
import { TLink } from "@/components/Transition";
import Lines from "@/components/fx/Lines";

export const metadata = {
  title: `About — ${profile.name}`,
  description: profile.summary,
};

export default function About() {
  const [before, after] = publication.authors.split("Arghadeep Pakhira");
  return (
    <main className="page" style={{ "--c0": "#b9c6ff", "--c1": "#4a3fb5", "--c2": "#0b0820" }}>
      <section className="hero hero-page">
        <TLink href="/" title="Home" className="hero-corner tl">← Home</TLink>
        <span className="hero-corner tr reveal fade">{profile.location}</span>
        <Lines as="h1" className="hero-title" lines={["About"]} delay={100} />
        <p className="hero-sub reveal fade">{profile.role}</p>
        <span className="hero-corner bl reveal fade">B.Tech CSBS · 2023–2027</span>
        <span className="hero-corner br reveal fade">Scroll ↓</span>
      </section>

      <section className="sheet">
        <div className="row">
          <span className="label">Hello</span>
          <div>
            <p className="big reveal fade">{profile.summary}</p>
            <p className="mid muted reveal fade">{profile.summaryLong}</p>
          </div>
        </div>

        <div className="row">
          <span className="label">Publication</span>
          <a className="pub reveal fade" href={publication.href} target="_blank" rel="noreferrer" data-cursor="IEEE">
            <span className="pub-venue">{publication.venue} — {publication.date}</span>
            <span className="pub-title">{publication.title}</span>
            <span className="pub-authors">{before}<b>Arghadeep Pakhira</b>{after}</span>
          </a>
        </div>

        <div className="row">
          <span className="label">Education</span>
          <ul className="ledger ledger-light">
            {education.map((e) => (
              <li key={e.school} className="reveal fade">
                <div className="ledger-row"><span>{e.period}</span><strong>{e.school}</strong><span>{e.degree} — {e.score}</span><span /></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="row">
          <span className="label">Coursework</span>
          <p className="stack reveal fade">{coursework.join(" / ")}</p>
        </div>

        <div className="row">
          <span className="label">Skills</span>
          <dl className="facts facts-wide reveal fade">
            {skills.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>

        <div className="row">
          <span className="label">Honours</span>
          <ul className="ledger ledger-light">
            {awards.map((a) => (
              <li key={a.title} className="reveal fade"><div className="ledger-row"><span>{a.year}</span><strong>{a.title}</strong><span>{a.detail}</span><span /></div></li>
            ))}
            {certifications.map((c) => {
              const Row = c.href ? "a" : "div";
              return (
                <li key={c.title} className="reveal fade">
                  <Row className="ledger-row" {...(c.href ? { href: c.href, target: "_blank", rel: "noreferrer", "data-cursor": "Verify" } : {})}>
                    <span>{c.date}</span><strong>{c.title}</strong><span>{c.issuer}</span><span className="ledger-go">{c.href ? "↗" : ""}</span>
                  </Row>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="row">
          <span className="label">Interests</span>
          <p className="stack reveal fade">{interests.join(" / ")}</p>
        </div>
      </section>

      <section className="contact">
        <span className="label">Contact</span>
        <Lines as="h2" className="contact-title" lines={["Say", "hello"]} />
        <a className="contact-mail reveal fade" href={`mailto:${profile.email}`} data-cursor="Write">{profile.email}</a>
        <footer className="contact-foot">
          <span>Open to internships &amp; research collaborations</span>
          <div>{socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>)}</div>
          <span>© 2026 {profile.name}</span>
        </footer>
      </section>
    </main>
  );
}
