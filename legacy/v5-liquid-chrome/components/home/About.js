import { profile, pillars, globeTags } from "@/lib/data";
import { TLink } from "../Transition";
import SplitText from "../fx/SplitText";
import SkillGlobe from "../fx/SkillGlobe";
import Tilt from "../fx/Tilt";
import CountUp from "../fx/CountUp";

const stats = [
  { value: 1, label: "IEEE publication" },
  { value: 0.832, decimals: 3, label: "best macro-AUC" },
  { value: 112, suffix: "K", label: "X-rays trained on" },
  { value: 18, label: "MCP tools shipped" },
];

export default function About() {
  return (
    <section id="about" className="about" data-blob="about">
      <div className="about-grid">
        <div className="about-copy">
          <span className="eyebrow">(03) — About</span>
          <SplitText as="h2" text="Models that run where the data is." className="h-lg" step={14} />
          <p className="reveal fade">{profile.summary}</p>
          <p className="reveal fade muted">{profile.summaryLong}</p>
          <TLink href="/about" title="About" className="btn btn-ghost reveal fade" data-cursor="Read">Full profile →</TLink>
        </div>
        <div className="about-globe reveal fade">
          <SkillGlobe tags={globeTags} />
          <span className="globe-hint">Hover to steer</span>
        </div>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div className="glass stat reveal fade" key={s.label}>
            <CountUp {...s} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="pillars">
        {pillars.map((p, i) => (
          <Tilt key={p.title} className="reveal fade">
            <div className="glass pillar">
              <span className="pillar-num">0{i + 1}</span>
              <h3>{p.title}</h3>
              <p>{p.items}</p>
            </div>
          </Tilt>
        ))}
      </div>
    </section>
  );
}
