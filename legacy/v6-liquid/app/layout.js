import { Archivo } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { TransitionProvider } from "@/components/Transition";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Cursor from "@/components/Cursor";
import Reveal from "@/components/fx/Reveal";
import LiquidLayer from "@/components/liquid/LiquidLayer";
import "./globals.css";

// One variable family does everything: wdth 62 for condensed display, 100 for text
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });

export const metadata = {
  title: "Arghadeep Pakhira — AI/ML & Edge AI Engineer",
  description: "Portfolio of Arghadeep Pakhira — deep learning, Edge AI, LLM systems, medical imaging and Android.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* Set theme before first paint: saved choice, else light (cream) */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"light"}catch(e){document.documentElement.dataset.theme="light"}` }} />
      </head>
      <body>
        <LiquidLayer />
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
