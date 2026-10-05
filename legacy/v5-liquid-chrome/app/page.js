import Hero from "@/components/home/Hero";
import Ticker from "@/components/home/Ticker";
import Work from "@/components/home/Work";
import About from "@/components/home/About";
import Contact from "@/components/home/Contact";

export default function Home() {
  return (
    <main>
      <Hero />
      <Ticker />
      <Work />
      <About />
      <Contact />
    </main>
  );
}
