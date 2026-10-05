import Hero from "@/components/home/Hero";
import Statement from "@/components/home/Statement";
import Work from "@/components/home/Work";
import Capabilities from "@/components/home/Capabilities";
import Recognition from "@/components/home/Recognition";
import Contact from "@/components/home/Contact";

export default function Home() {
  return (
    <main>
      <Hero />
      <Statement />
      <Work />
      <Capabilities />
      <Recognition />
      <Contact />
    </main>
  );
}
