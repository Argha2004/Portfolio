import { profile, socials } from "@/lib/data";
import Lines from "../fx/Lines";

// Second liquid section: the page ends where it started.
export default function Contact() {
  return (
    <section id="contact" className="contact" data-liquid data-nav="light">
      <span className="label">(05) Contact</span>
      <Lines as="h2" className="contact-title" lines={["Let's", "talk"]} />
      <a className="contact-mail reveal fade" href={`mailto:${profile.email}`} data-cursor="Write">{profile.email}</a>
      <footer className="contact-foot">
        <span>Open to internships &amp; research collaborations</span>
        <div>{socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>)}</div>
        <span>© 2026 {profile.name}</span>
      </footer>
    </section>
  );
}
