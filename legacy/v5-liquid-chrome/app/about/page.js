import { profile, socials, skills, education, coursework, publication, awards, certifications, interests, globeTags } from "@/lib/data";
import { projects } from "@/lib/projects";
import { TLink } from "@/components/Transition";
import SplitText from "@/components/fx/SplitText";
import SkillGlobe from "@/components/fx/SkillGlobe";
import Tilt from "@/components/fx/Tilt";
import Magnetic from "@/components/fx/Magnetic";

export const metadata = {
  title: `About — ${profile.name}`,
  description: profile.summary,
};

export default function About() {
  const [before, after] = publication.authors.split("Arghadeep Pakhira");
  return (
    <main className="detail" data-blob="page" data-blob-color="#c9a7ff">
      <section className="detail-hero">
        <TLink href="/" title="Home" className="back">← Home</TLink>
        <span className="eyebrow reveal fade">About me</span>
        <SplitText as="h1" text="Hi, I'm Arghadeep." className="h-xxl" />
        <p className="detail-sub reveal fade">{profile.role} · {profile.location}</p>
      </section>

      <section className="detail-block about-split">
        <div>
          <p className="detail-lead reveal fade">{profile.summary}</p>
          <p className="reveal fade muted">{profile.summaryLong}</p>
          <div className="chips reveal fade">{interests.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
        </div>
        <div className="about-globe reveal fade"><SkillGlobe tags={globeTags} /></div>
      </section>

      <section className="detail-block">
        <div className="stats">
          {[["1", "IEEE publication"], [String(projects.length), "projects built"], ["0.832", "best macro-AUC"]].map(([v, l]) => (
            <Tilt key={l} className="reveal fade"><div className="glass stat"><strong>{v}</strong><span>{l}</span></div></Tilt>
          ))}
        </div>
      </section>

      <section className="detail-block">
        <span className="eyebrow">Publication</span>
        <Tilt max={5} className="reveal fade">
          <a className="glass panel pub" href={publication.href} target="_blank" rel="noreferrer" data-cursor="IEEE">
            <span className="pub-venue">{publication.venue} · {publication.date}</span>
            <span className="pub-title">{publication.title}</span>
            <span className="pub-authors">{before}<b>Arghadeep Pakhira</b>{after}</span>
          </a>
        </Tilt>
      </section>

      <section className="detail-block">
        <span className="eyebrow">Education</span>
        <ol className="timeline">
          {education.map((e) => (
            <li className="reveal fade" key={e.school}>
              <span className="tl-when">{e.period}</span>
              <div><h3>{e.school}</h3><p>{e.degree} · {e.place}</p></div>
              <span className="chip">{e.score}</span>
            </li>
          ))}
        </ol>
        <p className="reveal fade muted small">Coursework: {coursework.join(" · ")}</p>
      </section>

      <section className="detail-block">
        <span className="eyebrow">Skills</span>
        <div className="skill-grid">
          {skills.map(([k, v]) => (
            <div className="glass panel reveal fade" key={k}>
              <h3 className="h-sm">{k}</h3>
              <div className="chips">{v.split(", ").map((t) => <span className="chip chip-sm" key={t}>{t}</span>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-block">
        <span className="eyebrow">Honours & certifications</span>
        <ol className="timeline">
          {awards.map((a) => (
            <li className="reveal fade" key={a.title}><span className="tl-when">{a.year}</span><div><h3>{a.title}</h3><p>{a.detail}</p></div><span /></li>
          ))}
          {certifications.map((c) => (
            <li className="reveal fade" key={c.title}>
              <span className="tl-when">{c.date}</span>
              <div><h3>{c.title}</h3><p>{c.issuer}</p></div>
              {c.href ? <a className="chip" href={c.href} target="_blank" rel="noreferrer">Verify ↗</a> : <span />}
            </li>
          ))}
        </ol>
      </section>

      <section className="detail-block detail-contact">
        <SplitText as="h2" text="Let's talk." className="h-xl" />
        <div className="reveal fade">
          <Magnetic strength={0.25}>
            <a href={`mailto:${profile.email}`} className="mail-orb" data-cursor="Say hi"><span>Get in touch</span><small>{profile.email}</small></a>
          </Magnetic>
        </div>
        <div className="foot-links reveal fade">{socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
      </section>
    </main>
  );
}
