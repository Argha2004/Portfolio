import { Newsreader, Inter, IBM_Plex_Mono } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { TransitionProvider } from "@/components/Transition";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Reveal from "@/components/paper/Reveal";
import Progress from "@/components/paper/Progress";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata = {
  title: "Arghadeep Pakhira — Learning at the Edge",
  description: "Portfolio of Arghadeep Pakhira, AI/ML & Edge AI engineer — written as an interactive research paper.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Set theme before first paint: saved choice, else paper (light) */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"light"}catch(e){document.documentElement.dataset.theme="light"}` }} />
      </head>
      <body>
        <SmoothScroll>
          <TransitionProvider>
            <Progress />
            <Nav />
            {children}
            <Reveal />
          </TransitionProvider>
          <Preloader />
        </SmoothScroll>
      </body>
    </html>
  );
}
