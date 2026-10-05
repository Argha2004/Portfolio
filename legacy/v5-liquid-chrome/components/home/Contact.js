import { profile, socials } from "@/lib/data";
import SplitText from "../fx/SplitText";
import Magnetic from "../fx/Magnetic";

export default function Contact() {
  return (
    <section id="contact" className="contact" data-blob="contact">
      <span className="eyebrow">(04) — Contact</span>
      <h2 className="contact-title">
        <SplitText text="Let's build" className="h-xxl" />
        <SplitText text="something brilliant." className="h-xxl grad" delay={200} />
      </h2>
      <p className="reveal fade contact-lead">Open to internships and research collaborations in Edge AI, medical imaging and LLM systems.</p>
      <div className="reveal fade">
        <Magnetic strength={0.25}>
          <a href={`mailto:${profile.email}`} className="mail-orb" data-cursor="Say hi">
            <span>Get in touch</span>
            <small>{profile.email}</small>
          </a>
        </Magnetic>
      </div>
      <footer className="site-foot">
        <div className="foot-links">{socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
        <span>© 2026 {profile.name}</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </section>
  );
}
