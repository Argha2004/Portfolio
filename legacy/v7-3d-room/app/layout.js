import { Geist, Instrument_Serif } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { TransitionProvider } from "@/components/Transition";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Cursor from "@/components/Cursor";
import Reveal from "@/components/fx/Reveal";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });

export const metadata = {
  title: "Arghadeep Pakhira — AI/ML & Edge AI Engineer",
  description: "Portfolio of Arghadeep Pakhira — deep learning, Edge AI, LLM systems, medical imaging and Android.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <SmoothScroll>
          <TransitionProvider>
            <Nav />
            {children}
            <Reveal />
          </TransitionProvider>
          <Preloader />
          <Cursor />
        </SmoothScroll>
      </body>
    </html>
  );
}
