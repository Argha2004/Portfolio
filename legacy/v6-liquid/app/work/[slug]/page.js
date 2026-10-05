import { notFound } from "next/navigation";
import { projects } from "@/lib/projects";
import { profile } from "@/lib/data";
import { TLink } from "@/components/Transition";
import Lines from "@/components/fx/Lines";

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
    <main data-liquid-color={p.colors[1]}>
      {/* Liquid hero, tinted with the project's colour */}
      <section className="hero hero-page" data-liquid data-nav="light">
        <TLink href="/#work" title="Work" className="hero-corner tl">← All work</TLink>
        <span className="hero-corner tr reveal fade">{String(i + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
        <Lines as="h1" className="hero-title" lines={[p.name]} delay={100} />
        <p className="hero-sub reveal fade">{p.subtitle}</p>
        <span className="hero-corner bl reveal fade">{p.category}</span>
        <span className="hero-corner br reveal fade">Scroll ↓</span>
      </section>

      <section className="sheet">
        <div className="row">
          <span className="label">Overview</span>
          <p className="big reveal fade">{p.summary}</p>
        </div>

        <div className="row">
          <span className="label">Details</span>
          <dl className="facts reveal fade">
            <div><dt>Role</dt><dd>{p.role || "Design & development"}</dd></div>
            <div><dt>Category</dt><dd>{p.category}</dd></div>
            <div><dt>Links</dt><dd className="facts-links">
              {p.github && <a href={p.github} target="_blank" rel="noreferrer" data-cursor="Code">GitHub ↗</a>}
              {p.paper && <a href={p.paper} target="_blank" rel="noreferrer" data-cursor="Paper">IEEE paper ↗</a>}
              {!p.github && !p.paper && "—"}
            </dd></div>
          </dl>
        </div>

        <ul className="numbers">
          {p.stats.map(([v, l]) => (
            <li key={l} className="reveal fade"><strong>{v}</strong><span>{l}</span></li>
          ))}
        </ul>

        {p.problem && (
          <div className="row">
            <span className="label">Problem</span>
            <p className="mid reveal fade">{p.problem}</p>
          </div>
        )}

        {p.sections.map((s, k) => (
          <div className="row" key={s.title}>
            <span className="label">{String(k + 1).padStart(2, "0")} — {s.title}</span>
            <ol className="steps">
              {s.points.map((pt) => <li key={pt} className="reveal fade">{pt}</li>)}
            </ol>
          </div>
        ))}

        <div className="row">
          <span className="label">Built with</span>
          <p className="stack reveal fade">{p.stack.join(" / ")}</p>
        </div>
      </section>

      <TLink href={`/work/${next.slug}`} title={next.name} className="next-up" data-cursor="Next" data-nav="light">
        <span className="label">Next project</span>
        <span className="next-title">{next.name}</span>
      </TLink>
    </main>
  );
}
