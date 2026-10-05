import { notFound } from "next/navigation";
import { projects, gradient } from "@/lib/projects";
import { profile } from "@/lib/data";
import { TLink } from "@/components/Transition";
import ProjectIntro from "@/components/ProjectIntro";

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
    <main className="project">
      <ProjectIntro>
        <TLink href="/#work" title="Work" className="back label">← All work</TLink>
        <p className="label project-index">0{i + 1} / 0{projects.length} — {p.category}</p>
        <h1 className="project-title"><span>{p.name}</span></h1>
        <p className="project-subtitle">{p.subtitle}</p>

        <div className="project-meta">
          <div><b>Category</b>{p.category}</div>
          <div><b>Role</b>{p.role || "Design & Development"}</div>
          <div><b>Links</b>
            <span className="project-links">
              {p.github && <a href={p.github} target="_blank" rel="noreferrer">GitHub ↗</a>}
              {p.paper && <a href={p.paper} target="_blank" rel="noreferrer">IEEE Paper ↗</a>}
              {!p.github && !p.paper && "—"}
            </span>
          </div>
        </div>

        <div className="project-hero" style={{ background: gradient(p.colors) }}>
          <span className="project-hero-name">{p.name}</span>
        </div>

        <p className="project-summary">{p.summary}</p>

        <div className="project-stats">
          {p.stats.map(([n, l]) => <div key={l}><strong>{n}</strong><span>{l}</span></div>)}
        </div>

        {p.problem && (
          <section className="project-block">
            <h2 className="label">The problem</h2>
            <p className="project-problem">{p.problem}</p>
          </section>
        )}

        {p.sections.map((s) => (
          <section className="project-block" key={s.title}>
            <h2 className="label">{s.title}</h2>
            <ul className="project-points">
              {s.points.map((pt) => <li key={pt}>{pt}</li>)}
            </ul>
          </section>
        ))}

        <section className="project-block">
          <h2 className="label">Tech stack</h2>
          <div className="chips">{p.stack.map((t) => <span key={t}>{t}</span>)}</div>
        </section>
      </ProjectIntro>

      <TLink href={`/work/${next.slug}`} title={next.name} className="next-project" data-cursor="Next">
        <span className="label">Next project</span>
        <span className="next-name">{next.name} →</span>
      </TLink>
    </main>
  );
}
