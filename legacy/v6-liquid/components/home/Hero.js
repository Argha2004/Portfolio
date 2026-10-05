import { profile } from "@/lib/data";
import Lines from "../fx/Lines";

// Liquid shows through this section (data-liquid); type sits centred on top of it.
export default function Hero() {
  return (
    <section id="top" className="hero" data-liquid data-nav="light">
      <span className="hero-corner tl reveal fade">AI/ML &amp; Edge AI Engineer</span>
      <span className="hero-corner tr reveal fade">Kolkata, India</span>

      <Lines as="h1" className="hero-title" lines={["From cloud", "to edge"]} delay={100} />
      <p className="hero-sub reveal fade">{profile.tagline}</p>

      <span className="hero-corner bl reveal fade">Portfolio ©2026</span>
      <span className="hero-corner br reveal fade">Scroll ↓</span>
    </section>
  );
}
