import { profile, socials, skills, education, coursework, publication, awards, certifications, interests, pillars } from "@/lib/data";
import { projects } from "@/lib/projects";
import { TLink } from "@/components/Transition";
import Toc from "@/components/paper/Toc";

export const metadata = {
  title: `About the Author — ${profile.name}`,
  description: profile.summary,
};

function H2({ id, num, children }) {
  return <h2 id={id} data-num={num} data-label={children} className="reveal"><span className="h-num">{num}</span>{children}</h2>;
}

export default function About() {
  const [before, after] = publication.authors.split("Arghadeep Pakhira");
  return (
    <main className="page">
      <Toc />
      <article className="paper">
        <TLink href="/" title="Portfolio" className="back">← Back to the paper</TLink>

        <header className="title-block">
          <p className="venue">About the Author</p>
          <h1 className="title">Arghadeep Pakhira</h1>
          <p className="affil">{profile.role} · {profile.location}</p>
        </header>

        {/* IEEE-style author biography: monogram in place of a photo, third-person bio */}
        <section className="bio reveal">
          <div className="bio-mark" aria-hidden="true">AP</div>
          <p>
            <b>Arghadeep Pakhira</b> is a B.Tech undergraduate in Computer Science &amp; Business Systems at Sister Nivedita
            University, Kolkata (expected 2027). His work focuses on deep learning, Edge AI, LLM-powered tools and on-device
            mobile AI. He is a co-author of “CrowdLense”, a demo paper on privacy-preserving edge intelligence for traffic monitoring
            presented at IEEE COMSNETS 2026. {profile.summaryLong.replace(/^I work/, "He works")} His interests
            include {interests.slice(0, -1).join(", ")} and {interests.at(-1)}.
          </p>
        </section>

        <div className="stat-row reveal">
          <div><strong>1</strong><span>IEEE publication</span></div>
          <div><strong>{projects.length}</strong><span>projects built</span></div>
          <div><strong>0.832</strong><span>best macro-AUC, ChestX-ray14</span></div>
        </div>

        <H2 id="a-focus" num="1">Research Focus</H2>
        <dl className="cv reveal">
          {pillars.map((p, i) => <div key={p.title}><dt>Area {i + 1}</dt><dd><b>{p.title}.</b> {p.items}.</dd></div>)}
        </dl>

        <H2 id="a-pub" num="2">Publication</H2>
        <a className="pub reveal" href={publication.href} target="_blank" rel="noreferrer">
          <span className="pub-authors">{before}<b>Arghadeep Pakhira</b>{after}.</span>
          <span className="pub-title">“{publication.title}.”</span>
          <span className="pub-venue"><i>{publication.venue}</i>, {publication.date}. <u>doi.org ↗</u></span>
        </a>

        <H2 id="a-edu" num="3">Education</H2>
        <dl className="cv reveal">
          {education.map((e) => (
            <div key={e.school}><dt>{e.period}</dt><dd><b>{e.school}</b>, {e.place}. {e.degree}. <span className="muted">{e.score}.</span></dd></div>
          ))}
        </dl>
        <p className="reveal muted small">Relevant coursework: {coursework.join(" · ")}.</p>

        <H2 id="a-skills" num="4">Skills</H2>
        <div className="table-wrap reveal">
          <table className="booktabs skills-table">
            <thead><tr><th>Area</th><th>Tools</th></tr></thead>
            <tbody>{skills.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
          </table>
        </div>

        <H2 id="a-honours" num="5">Honours &amp; Certifications</H2>
        <dl className="cv reveal">
          {awards.map((a) => <div key={a.title}><dt>{a.year}</dt><dd><b>{a.title}.</b> {a.detail}.</dd></div>)}
          {certifications.map((c) => (
            <div key={c.title}><dt>{c.date}</dt><dd><b>{c.title}</b>, {c.issuer}.{c.href && <> <a href={c.href} target="_blank" rel="noreferrer">Verify</a>.</>}</dd></div>
          ))}
        </dl>

        <H2 id="a-contact" num="6">Contact</H2>
        <div className="correspond reveal">
          <span className="correspond-label">Correspondence to</span>
          <a href={`mailto:${profile.email}`} className="correspond-mail">{profile.email}</a>
          <span className="correspond-links">
            {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}
          </span>
        </div>
      </article>
    </main>
  );
}
