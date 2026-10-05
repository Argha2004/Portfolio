import { Syne, DM_Sans } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { TransitionProvider } from "@/components/Transition";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Cursor from "@/components/Cursor";
import "./globals.css";

const display = Syne({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-body" });

export const metadata = {
  title: "Arghadeep Pakhira — AI/ML & Edge AI Engineer",
  description: "Portfolio of Arghadeep Pakhira — deep learning, Edge AI, LLM systems, medical imaging and Android.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* Set theme before first paint: saved choice, else OS preference */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body>
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
