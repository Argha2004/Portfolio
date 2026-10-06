"use client";
import { profile, socials, skills, education, coursework, publication, awards, certifications } from "@/lib/data";
import { TLink } from "../Transition";

// Info panel for the spotlight pad the car is parked on
export default function ZonePanel({ zone }) {
  if (zone === "skills") {
    return (
      <>
        <span className="panel-kicker">Skills</span>
        <h2>What I work with</h2>
        <dl className="panel-list">{skills.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </>
    );
  }
  if (zone === "research") {
    return (
      <>
        <span className="panel-kicker">Research</span>
        <h2>{publication.title}</h2>
        <p className="panel-sub">{publication.venue} — {publication.date}</p>
        <p>{publication.authors}</p>
        <ul className="panel-plain">{awards.map((a) => <li key={a.title}><b>{a.title}</b> ({a.year}): {a.detail}</li>)}</ul>
        <div className="panel-actions"><a className="btn btn-solid" href={publication.href} target="_blank" rel="noreferrer">Read on IEEE Xplore ↗</a></div>
      </>
    );
  }
  if (zone === "about") {
    return (
      <>
        <span className="panel-kicker">About me</span>
        <h2>Hi, I&apos;m Arghadeep.</h2>
        <p>{profile.summary}</p>
        <ul className="panel-plain">{education.map((e) => <li key={e.school}><b>{e.school}</b>: {e.degree}, {e.period} ({e.score})</li>)}</ul>
        <div className="panel-actions"><TLink href="/about" title="About" className="btn btn-solid">Full profile</TLink></div>
      </>
    );
  }
  if (zone === "education") {
    return (
      <>
        <span className="panel-kicker">Campus</span>
        <h2>Where I learned</h2>
        <dl className="panel-list">{education.map((e) => <div key={e.school}><dt>{e.period} · {e.score}</dt><dd><b>{e.school}</b>, {e.place}<br />{e.degree}</dd></div>)}</dl>
        <p className="panel-sub">Coursework</p>
        <div className="panel-tags">{coursework.map((c) => <span key={c}>{c}</span>)}</div>
      </>
    );
  }
  if (zone === "achievements") {
    return (
      <>
        <span className="panel-kicker">Hall of Fame</span>
        <h2>Awards &amp; certifications</h2>
        <ul className="panel-plain">{awards.map((a) => <li key={a.title}><b>{a.title}</b> ({a.year}): {a.detail}</li>)}</ul>
        <p className="panel-sub">Certifications</p>
        <ul className="panel-plain">
          {certifications.map((c) => (
            <li key={c.title}>
              {c.href ? <a href={c.href} target="_blank" rel="noreferrer"><b>{c.title}</b> ↗</a> : <b>{c.title}</b>}, {c.issuer} ({c.date})
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (zone === "graveyard") {
    return (
      <>
        <span className="panel-kicker">Secret found: Design Graveyard</span>
        <h2>Here lie my old portfolios.</h2>
        <p>Before this island, the site went through seven complete redesigns. Each one has a gravestone here. Feel free to knock them over.</p>
        <ul className="panel-plain">
          <li><b>v1</b>: WebGL fluid simulation</li>
          <li><b>v2</b>: Editorial with a 3D glass blob</li>
          <li><b>v3</b>: Dark tech with morphing particles</li>
          <li><b>v4</b>: Interactive research paper</li>
          <li><b>v5</b>: Liquid-chrome blob &amp; fluid trails</li>
          <li><b>v6</b>: Molten-red liquid (Lama Lama-inspired)</li>
          <li><b>v7</b>: Curved screens in a 3D room</li>
        </ul>
      </>
    );
  }
  return (
    <>
      <span className="panel-kicker">Contact</span>
      <h2>Let&apos;s talk.</h2>
      <p>Open to internships and research collaborations in Edge AI, medical imaging and LLM systems.</p>
      <a className="panel-mail" href={`mailto:${profile.email}`}>{profile.email}</a>
      <div className="panel-actions">{socials.map((s) => <a key={s.label} className="btn" href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
    </>
  );
}
