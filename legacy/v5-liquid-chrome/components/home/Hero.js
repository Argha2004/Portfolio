import { profile } from "@/lib/data";
import { projects } from "@/lib/projects";
import { TLink } from "../Transition";
import SplitText from "../fx/SplitText";
import Magnetic from "../fx/Magnetic";

export default function Hero() {
  return (
    <section id="top" className="hero" data-blob="hero">
      <p className="eyebrow reveal fade">{profile.role} · Portfolio ©2026</p>

      <h1 className="hero-title">
        <SplitText text="Arghadeep" className="hero-line" />
        <SplitText text="Pakhira" className="hero-line hero-line-2" delay={180} />
      </h1>

      <p className="hero-lead reveal fade">{profile.tagline}</p>

      <div className="hero-cta reveal fade">
        <Magnetic><a href="#work" className="btn btn-solid" data-cursor="Go">View my work</a></Magnetic>
        <Magnetic><TLink href="/about" title="About" className="btn btn-ghost">About me</TLink></Magnetic>
      </div>

      <ul className="hero-chips reveal fade">
        <li><b>IEEE</b> COMSNETS 2026</li>
        <li><b>0.832</b> macro-AUC</li>
        <li><b>{projects.length}</b> projects</li>
      </ul>

      <span className="scroll-hint" aria-hidden="true"><i /></span>
    </section>
  );
}
