import { notFound } from "next/navigation";
import { projects } from "@/lib/projects";
import { profile } from "@/lib/data";
import { TLink } from "@/components/Transition";
import Figure from "@/components/paper/Figure";
import Toc from "@/components/paper/Toc";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = projects.find((x) => x.slug === slug);
  return p ? { title: `Appendix ${p.appendix}: ${p.name} — ${profile.name}`, description: p.summary } : { title: "Not found" };
}

export default async function Appendix({ params }) {
  const { slug } = await params;
  const i = projects.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const p = projects[i];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const L = p.appendix;
  let sec = 0;

  return (
    <main className="page">
      <Toc />
      <article className="paper">
        <TLink href="/#sec-work" title="Selected Work" className="back">← Back to §2 Selected Work</TLink>

        <header className="title-block">
          <p className="venue">Appendix {L} · {p.category}</p>
          <h1 className="title">{p.name}: <i>{p.subtitle}</i></h1>
          <p className="affil">
            {p.role || "Design & development: Arghadeep Pakhira"}
            {p.github && <> · <a href={p.github} target="_blank" rel="noreferrer">Source code ↗</a></>}
            {p.paper && <> · <a href={p.paper} target="_blank" rel="noreferrer">IEEE paper ↗</a></>}
          </p>
        </header>

        <section className="abstract reveal">
          <h3>Summary</h3>
          <p>{p.summary}</p>
        </section>

        <div className="stat-row reveal">
          {p.stats.map(([v, label]) => <div key={label}><strong>{v}</strong><span>{label}</span></div>)}
        </div>

        <Figure n={`${L}.1`} spec={p.figure} />

        {p.problem && (
          <>
            <h2 id="appx-problem" data-num={`${L}.${++sec}`} data-label="Problem" className="reveal"><span className="h-num">{L}.{sec}</span>Problem</h2>
            <p className="reveal">{p.problem}</p>
          </>
        )}

        {p.sections.map((s) => {
          const num = `${L}.${++sec}`;
          return (
            <section key={s.title}>
              <h2 id={`appx-${sec}`} data-num={num} data-label={s.title} className="reveal"><span className="h-num">{num}</span>{s.title}</h2>
              <ol className="points reveal">{s.points.map((pt) => <li key={pt}>{pt}</li>)}</ol>
            </section>
          );
        })}

        <h2 id="appx-stack" data-num={`${L}.${++sec}`} data-label="Implementation" className="reveal"><span className="h-num">{L}.{sec}</span>Implementation</h2>
        <div className="table-wrap reveal">
          <table className="booktabs">
            <caption><b>Table {L}.1.</b> Technology used in {p.name}.</caption>
            <tbody><tr><td>{p.stack.join(" · ")}</td></tr></tbody>
          </table>
        </div>

        <nav className="appx-nav">
          <TLink href={`/work/${prev.slug}`} title={`Appendix ${prev.appendix}`}>
            <span className="appx-dir">← Appendix {prev.appendix}</span><span>{prev.name}</span>
          </TLink>
          <TLink href={`/work/${next.slug}`} title={`Appendix ${next.appendix}`} className="appx-next">
            <span className="appx-dir">Appendix {next.appendix} →</span><span>{next.name}</span>
          </TLink>
        </nav>
      </article>
    </main>
  );
}
