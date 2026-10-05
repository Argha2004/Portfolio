import { profile, socials, skills, education, coursework, publication, awards, certifications, interests, pillars } from "@/lib/data";
import { projects } from "@/lib/projects";
import { TLink } from "@/components/Transition";
import ProjectIntro from "@/components/ProjectIntro";

export const metadata = {
  title: `About — ${profile.name}`,
  description: profile.summary,
};

export default function AboutPage() {
  return (
    <main className="project about-page">
      <ProjectIntro>
        <TLink href="/" title="Home" className="back label">← Home</TLink>
        <p className="label project-index">About</p>
        <h1 className="project-title"><span>Hi, I&apos;m Arghadeep</span></h1>
        <p className="project-subtitle">{profile.role} · {profile.location}</p>

        <div className="about-intro">
          <p className="project-summary">{profile.summary}</p>
          <p className="about-long reveal-up">{profile.summaryLong}</p>
          <div className="chips reveal-up">{profile.focus.map((f) => <span key={f}>{f}</span>)}</div>
        </div>

        <div className="project-stats">
          <div><strong>1</strong><span>IEEE publication (COMSNETS 2026)</span></div>
          <div><strong>{projects.length}</strong><span>projects built</span></div>
          <div><strong>0.832</strong><span>best macro-AUC on ChestX-ray14</span></div>
        </div>

        <section className="project-block">
          <h2 className="label">What I do</h2>
          <div className="pillars">
            {pillars.map((p, i) => (
              <div key={p.title}><span className="pillar-num">0{i + 1}</span><h3>{p.title}</h3><p>{p.items}</p></div>
            ))}
          </div>
        </section>

        <section className="project-block">
          <h2 className="label">Research publication</h2>
          <a className="pub" href={publication.href} target="_blank" rel="noreferrer" data-cursor="IEEE">
            <span className="pub-venue">{publication.venue} — {publication.date}</span>
            <span className="pub-title">{publication.title}</span>
            <span className="pub-authors">{publication.authors}</span>
          </a>
        </section>

        <section className="project-block">
          <h2 className="label">Skills</h2>
          <dl className="skills-list">
            {skills.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="project-block">
          <h2 className="label">Education</h2>
          <ul className="timeline">
            {education.map((e) => (
              <li key={e.school}>
                <span className="tl-period">{e.period}</span>
                <div><h3>{e.school}</h3><p>{e.degree} — {e.place}</p></div>
                <span className="tl-score">{e.score}</span>
              </li>
            ))}
          </ul>
          <p className="coursework"><b className="label">Relevant coursework</b> {coursework.join(" · ")}</p>
        </section>

        <section className="project-block">
          <h2 className="label">Awards & hackathons</h2>
          <ul className="timeline">
            {awards.map((a) => (
              <li key={a.title}><span className="tl-period">{a.year}</span><div><h3>{a.title}</h3><p>{a.detail}</p></div><span /></li>
            ))}
          </ul>
        </section>

        <section className="project-block">
          <h2 className="label">Certifications</h2>
          <ul className="timeline">
            {certifications.map((c) => (
              <li key={c.title}>
                <span className="tl-period">{c.date}</span>
                <div><h3>{c.title}</h3><p>{c.issuer}</p></div>
                {c.href ? <a className="tl-score" href={c.href} target="_blank" rel="noreferrer">Verify ↗</a> : <span />}
              </li>
            ))}
          </ul>
        </section>

        <section className="project-block">
          <h2 className="label">Interests</h2>
          <div className="chips">{interests.map((t) => <span key={t}>{t}</span>)}</div>
        </section>

        <section className="project-block">
          <h2 className="label">Elsewhere</h2>
          <div className="about-socials">
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
            {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}
          </div>
        </section>
      </ProjectIntro>

      <TLink href="/#work" title="Work" className="next-project" data-cursor="Go">
        <span className="label">See what I&apos;ve built</span>
        <span className="next-name">Selected work →</span>
      </TLink>
    </main>
  );
}
