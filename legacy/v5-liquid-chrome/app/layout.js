import { Unbounded, Manrope } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { TransitionProvider } from "@/components/Transition";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Cursor from "@/components/Cursor";
import Reveal from "@/components/fx/Reveal";
import Background from "@/components/three/Background";
import "./globals.css";

const display = Unbounded({ subsets: ["latin"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "Arghadeep Pakhira — AI/ML & Edge AI Engineer",
  description: "Portfolio of Arghadeep Pakhira — deep learning, Edge AI, LLM systems, medical imaging and Android.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* Set theme before first paint: saved choice, else dark */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}` }} />
      </head>
      <body>
        <div className="bg-gradient" aria-hidden="true" />
        <Background />
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
