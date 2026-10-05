import { profile, socials } from "@/lib/data";

export default function Contact() {
  return (
    <section id="contact" className="contact">
      <span className="label">Open to internships & research collaborations</span>
      <a className="cta" href={`mailto:${profile.email}`}>
        Let&apos;s<br />talk <span className="arrow">→</span>
      </a>
      <footer>
        {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>)}
        <span>© 2026 {profile.name}</span>
      </footer>
    </section>
  );
}
