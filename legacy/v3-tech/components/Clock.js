"use client";
import { useEffect, useState } from "react";

// Live local time in India; renders a placeholder on the server to avoid hydration mismatch.
export default function Clock({ prefix = "IST" }) {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="clock">{prefix} {time}</span>;
}
