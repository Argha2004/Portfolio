"use client";
import dynamic from "next/dynamic";

// WebGL is client-only
const Liquid = dynamic(() => import("./Liquid"), { ssr: false });

export default function LiquidLayer() {
  return <Liquid />;
}
