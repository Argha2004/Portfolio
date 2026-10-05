import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { TransitionProvider } from "@/components/Transition";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Cursor from "@/components/Cursor";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });

export const metadata = {
  title: "Arghadeep Pakhira — AI/ML & Edge AI Engineer",
  description: "Portfolio of Arghadeep Pakhira — deep learning, Edge AI, LLM systems, medical imaging and Android.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Set theme before first paint: saved choice, else dark (the design's home theme) */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}` }} />
      </head>
      <body>
        <div className="grid-lines" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
        <div className="grain" aria-hidden="true" />
        <SmoothScroll>
          <TransitionProvider>
            <Nav />
            {children}
          </TransitionProvider>
          <Preloader />
          <Cursor />
        </SmoothScroll>
      </body>
    </html>
  );
}
