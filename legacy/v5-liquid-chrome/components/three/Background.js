"use client";
import dynamic from "next/dynamic";

// WebGL layers are client-only; loading them lazily keeps the first HTML light.
const Scene = dynamic(() => import("./Scene"), { ssr: false });
const Fluid = dynamic(() => import("./Fluid"), { ssr: false });

export default function Background() {
  return (
    <>
      <Scene />
      <Fluid />
    </>
  );
}
