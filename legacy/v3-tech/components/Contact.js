import { profile, socials } from "@/lib/data";
import Clock from "./Clock";

export default function Contact() {
  return (
    <section id="contact" className="contact">
      <header className="sec-head">
        <span className="sec-num mono">[04]</span>
        <span className="mono sec-aside">Open to internships & research collaborations</span>
      </header>
      <h2 className="contact-title">Let&apos;s build something <em>intelligent.</em></h2>
      <a className="contact-mail" href={`mailto:${profile.email}`} data-cursor="Email">{profile.email} <i>↗</i></a>
      <footer className="mono">
        <div className="contact-socials">
          {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}
        </div>
        <Clock prefix="Local time —" />
        <span>© 2026 {profile.name}</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </section>
  );
}
