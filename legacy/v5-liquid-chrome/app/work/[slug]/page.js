import { notFound } from "next/navigation";
import { projects, gradient } from "@/lib/projects";
import { profile } from "@/lib/data";
import { TLink } from "@/components/Transition";
import SplitText from "@/components/fx/SplitText";
import Tilt from "@/components/fx/Tilt";
import Magnetic from "@/components/fx/Magnetic";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = projects.find((x) => x.slug === slug);
  return p ? { title: `${p.name} — ${profile.name}`, description: p.summary } : { title: "Not found" };
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const i = projects.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const p = projects[i];
  const next = projects[(i + 1) % projects.length];

  return (
    <main className="detail" data-blob="page" data-blob-color={p.colors[1]}>
      <section className="detail-hero">
        <TLink href="/#work" title="Work" className="back">← All projects</TLink>
        <span className="eyebrow reveal fade">0{i + 1} / 0{projects.length} · {p.category}</span>
        <SplitText as="h1" text={p.name} className="h-xxl" />
        <p className="detail-sub reveal fade">{p.subtitle}</p>
        <div className="detail-meta reveal fade">
          <span className="chip">{p.role || "Design & development"}</span>
          {p.github && <Magnetic><a className="btn btn-ghost" href={p.github} target="_blank" rel="noreferrer" data-cursor="Code">GitHub ↗</a></Magnetic>}
          {p.paper && <Magnetic><a className="btn btn-solid" href={p.paper} target="_blank" rel="noreferrer" data-cursor="Paper">IEEE paper ↗</a></Magnetic>}
        </div>
      </section>

      <Tilt className="detail-art-tilt reveal fade" max={6}>
        <div className="detail-art" style={{ background: gradient(p.colors) }}>
          <span>{p.name}</span>
        </div>
      </Tilt>

      <section className="detail-block">
        <p className="detail-lead reveal fade">{p.summary}</p>
        <div className="stats">
          {p.stats.map(([v, l]) => (
            <Tilt key={l} className="reveal fade"><div className="glass stat"><strong>{v}</strong><span>{l}</span></div></Tilt>
          ))}
        </div>
      </section>

      {p.problem && (
        <section className="detail-block">
          <span className="eyebrow">The problem</span>
          <p className="detail-problem reveal fade">{p.problem}</p>
        </section>
      )}

      {p.sections.map((s, k) => (
        <section className="detail-block" key={s.title}>
          <div className="glass panel reveal fade">
            <span className="eyebrow">0{k + 1}</span>
            <h2 className="h-md">{s.title}</h2>
            <ul className="points">{s.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
          </div>
        </section>
      ))}

      <section className="detail-block">
        <span className="eyebrow">Built with</span>
        <div className="chips reveal fade">{p.stack.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
      </section>

      <TLink href={`/work/${next.slug}`} title={next.name} className="next" data-cursor="Next">
        <span className="eyebrow">Next project</span>
        <span className="next-name">{next.name} <i>→</i></span>
      </TLink>
    </main>
  );
}
