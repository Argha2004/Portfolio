import { profile, socials, skills, education, awards, certifications, references, interests } from "@/lib/data";
import { projects } from "@/lib/projects";
import { TLink } from "@/components/Transition";
import { Note, Margin } from "@/components/paper/Note";
import Cite from "@/components/paper/Cite";
import Figure from "@/components/paper/Figure";
import NeuralNet from "@/components/paper/NeuralNet";
import Toc from "@/components/paper/Toc";

// Which reference documents each project (for inline citations)
const projectRef = { crowdlense: 2, chestx: 3, "train-assistant": 4, aira: 5 };

function H2({ id, num, children, label }) {
  return <h2 id={id} data-num={num} data-label={label} className="reveal"><span className="h-num">{num}</span>{children}</h2>;
}

export default function Paper() {
  return (
    <main id="top" className="page">
      <Toc />
      <article className="paper">
        {/* ── Title block ── */}
        <header className="title-block">
          <p className="venue">Portfolio · Preprint · Updated October 2026 · cs.LG / cs.CV / cs.HC</p>
          <h1 className="title">Learning at the Edge: <i>Deep Learning, On-Device AI and LLM Systems</i></h1>
          <p className="authors">
            Arghadeep Pakhira<sup>1</sup>
          </p>
          <p className="affil">
            <sup>1</sup>B.Tech, Computer Science &amp; Business Systems, Sister Nivedita University, Kolkata · {profile.location}
            <br />✉ <a href={`mailto:${profile.email}`}>{profile.email}</a>
            {socials.map((s) => <span key={s.label}> · <a href={s.href} target="_blank" rel="noreferrer">{s.label}</a></span>)}
          </p>
        </header>

        <section className="abstract reveal">
          <h3>Abstract</h3>
          <p>
            This document presents the work of an aspiring AI/ML and Edge AI engineer. It covers five systems, spanning
            privacy-preserving traffic analytics on Raspberry Pi devices, a chest X-ray classifier trained on 112,120 images
            and deployed fully offline on Android, an LLM agent that diagnoses ML training runs through the Model Context
            Protocol, a sensor-fusion weather diary, and an artisan marketplace. The first of these was published at IEEE
            COMSNETS 2026 <Cite n={1} />. Across them, a consistent theme emerges: <em>models are only useful once they run where
            the data is</em>, whether that is a camera on a roadside, a phone in a clinic, or a developer&apos;s terminal.
          </p>
          <p className="keywords"><b>Keywords:</b> {profile.focus.join(" · ")}</p>
        </section>

        <Figure n={1} wide spec={{ caption: "A small feed-forward network (3 → 6 → 6 → 3, tanh), evaluated live in your browser. Move the cursor over the figure: its x and y position are inputs x₁ and x₂, and x₃ is a slow clock. Edge thickness shows each weighted contribution w·a; colour shows its sign. The outputs are labelled after my research interests, purely for fun." }}>
          <NeuralNet />
        </Figure>

        {/* ── 1 Introduction ── */}
        <H2 id="sec-intro" num="1" label="Introduction">Introduction</H2>
        <p className="reveal">
          I am a B.Tech (CSBS) undergraduate<Note n={1}>Sister Nivedita University, 2023 – 2027 (expected). CGPA 7.2 / 10.</Note> focused
          on deep learning, Edge AI, LLM-powered tools and on-device mobile AI. My work covers the full ML lifecycle:
          training multi-label CNNs on 100K+ medical images, quantizing and exporting models to ONNX for offline Android
          inference, building Gemini + MCP agentic tools, and shipping React, FastAPI and Flask dashboards alongside Kotlin /
          Jetpack Compose apps.
        </p>
        <p className="reveal">
          I am a co-author of a demo paper on privacy-preserving edge intelligence for traffic monitoring, presented in the Demos &amp; Exhibits
          track of IEEE COMSNETS 2026 <Cite n={1} />.<Note n={2}>18th International Conference on Communication Systems &amp; Networks, January 2026. Indexed in IEEE Xplore.</Note>
        </p>
        <p className="reveal">This portfolio makes the following contributions:</p>
        <ul className="contrib reveal">
          {projects.map((p, i) => (
            <li key={p.slug}>
              <b>{p.name}</b>: {p.subtitle} (§2.{i + 1}
              {projectRef[p.slug] && <>, <Cite n={projectRef[p.slug]} /></>}).
            </li>
          ))}
        </ul>

        {/* ── 2 Selected Work ── */}
        <H2 id="sec-work" num="2" label="Selected Work">Selected Work</H2>
        {projects.map((p, i) => (
          <section key={p.slug} className="work-item">
            <h3 className="reveal"><span className="h-num">2.{i + 1}</span>{p.name} <span className="h-sub">— {p.subtitle}</span></h3>
            <p className="reveal">
              {p.summary}
              {p.slug === "chestx" && <> Models were trained on NIH ChestX-ray14 <Cite n={6} />.</>}
              {p.slug === "crowdlense" && <> The detector is trained on the Indian Driving Dataset <Cite n={7} />.</>}
              {p.role && <Margin>{p.role}.</Margin>}
            </p>
            <Figure n={i + 2} spec={p.figure} />
            <p className="reveal work-foot">
              <span className="work-stack">{p.stack.slice(0, 6).join(" · ")}{p.stack.length > 6 ? " · …" : ""}</span>
              <TLink href={`/work/${p.slug}`} title={`Appendix ${p.appendix}`} className="work-link">Full write-up in Appendix {p.appendix} →</TLink>
            </p>
          </section>
        ))}

        {/* ── 3 Results ── */}
        <H2 id="sec-results" num="3" label="Results at a Glance">Results at a Glance</H2>
        <p className="reveal">Table 1 collects the headline numbers reported in each project&apos;s write-up.</p>
        <div className="table-wrap reveal">
          <table className="booktabs">
            <caption><b>Table 1.</b> Key results per project.</caption>
            <thead><tr><th>Project</th><th>Measure</th><th className="num">Value</th></tr></thead>
            <tbody>
              {projects.flatMap((p) => p.stats.map(([v, label], j) => (
                <tr key={p.slug + label} className={j === 0 ? "group-start" : ""}>
                  <td>{j === 0 ? p.name : ""}</td><td>{label}</td><td className="num">{v}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* ── 4 Methods & Tools ── */}
        <H2 id="sec-tools" num="4" label="Methods & Tools">Methods &amp; Tools</H2>
        <div className="table-wrap reveal">
          <table className="booktabs skills-table">
            <caption><b>Table 2.</b> Languages, frameworks and platforms used across this work.</caption>
            <thead><tr><th>Area</th><th>Tools</th></tr></thead>
            <tbody>{skills.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
          </table>
        </div>

        {/* ── 5 Education & Honours ── */}
        <H2 id="sec-edu" num="5" label="Education & Honours">Education &amp; Honours</H2>
        <dl className="cv reveal">
          {education.map((e) => (
            <div key={e.school}><dt>{e.period}</dt><dd><b>{e.school}</b>, {e.place}. {e.degree}. <span className="muted">{e.score}.</span></dd></div>
          ))}
          {awards.map((a) => (
            <div key={a.title}><dt>{a.year}</dt><dd><b>{a.title}.</b> {a.detail}.</dd></div>
          ))}
          {certifications.map((c) => (
            <div key={c.title}><dt>{c.date}</dt><dd><b>{c.title}</b>, {c.issuer}.{c.href && <> <a href={c.href} target="_blank" rel="noreferrer">Verify</a>.</>}</dd></div>
          ))}
        </dl>

        {/* ── 6 Conclusion ── */}
        <H2 id="sec-contact" num="6" label="Conclusion & Correspondence">Conclusion &amp; Correspondence</H2>
        <p className="reveal">
          My current interests are {interests.slice(0, -1).join(", ")} and {interests.at(-1)}.
          I am open to internships and research collaborations in these areas.
        </p>
        <div className="correspond reveal">
          <span className="correspond-label">Correspondence to</span>
          <a href={`mailto:${profile.email}`} className="correspond-mail">{profile.email}</a>
          <span className="correspond-links">
            {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}
            <TLink href="/about" title="About the Author">About the author →</TLink>
          </span>
        </div>

        {/* ── References ── */}
        <h2 id="sec-refs" data-num="" data-label="References" className="refs-title reveal">References</h2>
        <ol className="refs reveal">
          {references.map((r) => (
            <li key={r.n} id={`ref-${r.n}`}>
              <span className="ref-n">[{r.n}]</span>
              <span>{r.text}{r.href && <> <a href={r.href} target="_blank" rel="noreferrer">{r.href.replace(/^https?:\/\//, "")}</a></>}</span>
            </li>
          ))}
        </ol>

        <h2 id="sec-appx" data-num="" data-label="Appendices" className="refs-title reveal">Appendices</h2>
        <ul className="appx reveal">
          {projects.map((p) => (
            <li key={p.slug}>
              <TLink href={`/work/${p.slug}`} title={`Appendix ${p.appendix}`}>
                <span className="appx-letter">{p.appendix}</span>
                <span>{p.name} <i>— {p.subtitle}</i></span>
                <span className="appx-go">→</span>
              </TLink>
            </li>
          ))}
        </ul>

        <footer className="colophon">
          Set in Newsreader, Inter and IBM Plex Mono. Built with Next.js, GSAP and Lenis. © 2026 {profile.name}.
        </footer>
      </article>
    </main>
  );
}
