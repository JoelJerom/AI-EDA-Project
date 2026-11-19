"use client";
import { useEffect, useRef } from "react";
import BoardArt from "./BoardArt";

// Cursor-following spotlight that unmasks the analysis layer over the clean board.
export default function SpotlightHero({ awake = false, hue = 0, sat = 1, id }: { awake?: boolean; hue?: number; sat?: number; id?: string }) {
  const stack = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = stack.current!, b = back.current!, R = 185;
    const m = { x: -9999, y: -9999 }, sm = { x: -9999, y: -9999 };
    let r = 0, raf = 0, inside = false;
    const move = (e: PointerEvent) => {
      const k = s.getBoundingClientRect(); // rendered px; divide out the stage scale
      m.x = ((e.clientX - k.left) * s.offsetWidth) / k.width;
      m.y = ((e.clientY - k.top) * s.offsetHeight) / k.height;
      if (!inside) { sm.x = m.x; sm.y = m.y; inside = true; }
    };
    const leave = () => { inside = false; };
    const loop = () => {
      sm.x += (m.x - sm.x) * 0.1; sm.y += (m.y - sm.y) * 0.1;
      r += ((inside ? R : 0) - r) * 0.14;
      const img = r < 1 ? "linear-gradient(transparent,transparent)"
        : `radial-gradient(circle ${r}px at ${sm.x}px ${sm.y}px,#000 0,#000 62%,rgba(0,0,0,.5) 80%,transparent 100%)`;
      b.style.setProperty("mask-image", img); b.style.setProperty("-webkit-mask-image", img);
      raf = requestAnimationFrame(loop);
    };
    s.addEventListener("pointermove", move); s.addEventListener("pointerleave", leave);
    loop();
    return () => { cancelAnimationFrame(raf); s.removeEventListener("pointermove", move); s.removeEventListener("pointerleave", leave); };
  }, []);

  return (
    <div className={"hero" + (awake ? " awake" : "")} id={id} style={{ "--hero-hue": `${hue}deg`, "--hero-sat": sat } as React.CSSProperties}>
      <div className="hero-stack" ref={stack}>
        <div className="hero-front"><BoardArt /></div>
        <div className="hero-back" ref={back} aria-hidden="true"><BoardArt xray /></div>
      </div>
    </div>
  );
}
