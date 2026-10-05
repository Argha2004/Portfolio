import { Amatic_SC } from "next/font/google";

// Bruno Simon's handwritten face (Amatic SC, bold), shared by the DOM intro and the in-world
// canvas text (interactive point labels, the projects board).
export const hand = Amatic_SC({ subsets: ["latin"], weight: "700" });
export const HAND_FAMILY = hand.style.fontFamily;

// Canvas text needs the face loaded before drawing
export const handReady = () =>
  typeof document === "undefined" ? Promise.resolve() : document.fonts.load(`700 64px ${HAND_FAMILY}`).catch(() => {});
