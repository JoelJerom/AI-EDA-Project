"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Brand from "../components/Brand";
import BoardArt from "../components/BoardArt";
import SpotlightHero from "../components/SpotlightHero";
import { PersonIcon } from "../components/SiteHeader";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/useAuth";

const I = (d: string) => <svg viewBox="0 0 48 48" width="46%" height="46%" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const BLOCKS = [
  { name: "Linear regulator", hue: 2, sat: 1.2, icon: I("M8 12h32v24H8zM16 36v6M24 36v6M32 36v6") },
  { name: "Switching regulator", hue: 0, sat: 0.5, icon: I("M4 24h8l3-8 6 16 6-16 6 16 3-8h8") },
  { name: "MOSFET switch", hue: 6, sat: 1.3, icon: I("M10 8v32M20 12v24M20 16h14V8M20 32h14v8M20 24h-10") },
  { name: "Op-amp stage", hue: 0, sat: 0.2, icon: I("M10 8v32l28-16zM4 18h6M4 30h6M38 24h6") },
  { name: "Sensor front-end", hue: 0, sat: 0.7, icon: I("M4 24c6-14 10-14 14 0s8 14 14 0 6-8 12 0") },
];
const POS: [number, number][] = [[160, 1], [312, 0], [0, 158], [155, 157], [310, 158]];

export default function Landing() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false), [fit, setFit] = useState(false), [compact, setCompact] = useState(false);
  const [menu, setMenu] = useState(false), [awake, setAwake] = useState(false), [cur, setCur] = useState(0);
  const say = useToast();
  const { user } = useAuth();
  const closeMenu = useCallback(() => setMenu(false), []);

  // Fixed 1536x1024 design canvas scaled to fit; simple stacked layout on narrow/portrait screens.
  useEffect(() => {
    const st = stageRef.current!;
    const PH = matchMedia("(max-width:820px), (max-aspect-ratio:1/1)");
    const layout = () => {
      if (PH.matches) {
        setPhone(true); setFit(false); setCompact(true);
        st.style.width = st.style.height = st.style.transform = ""; st.style.visibility = "visible"; return;
      }
      setPhone(false);
      const w = innerWidth, h = innerHeight, bh = 1024;
      const ideal = Math.round((bh * w) / h), bw = Math.max(1060, Math.min(2600, ideal)), s = Math.min(w / bw, h / bh);
      st.style.setProperty("--hf", Math.min(79, (79 * (bw - 295)) / 965).toFixed(2) + "px");
      setFit(Math.abs(ideal - bw) > 1); setCompact(s < 0.52);
      st.style.width = bw + "px"; st.style.height = bh + "px";
      st.style.transform = `translate(-50%,-50%) scale(${s})`; st.style.visibility = "visible";
    };
    layout();
    addEventListener("resize", layout, { passive: true });
    return () => removeEventListener("resize", layout);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest(".menu-panel,.menu")) closeMenu(); };
    addEventListener("keydown", key); document.addEventListener("pointerdown", down, true);
    return () => { removeEventListener("keydown", key); document.removeEventListener("pointerdown", down, true); };
  }, [closeMenu]);

  // Entrance timeline (runs once, then the page is fully static).
  useEffect(() => {
    const root = document.documentElement, st = stageRef.current!;
    if (!root.classList.contains("intro") || !st.animate) return;
    const q = (s: string) => Array.from(st.querySelectorAll<HTMLElement>(s));
    const anims: Animation[] = [];
    const TYPE = "cubic-bezier(.16,1,.3,1)", SOFT = "cubic-bezier(.22,.61,.36,1)";
    const near = innerWidth < 640 ? 0.6 : 1, px = (v: number) => (v * near).toFixed(2) + "px";
    const run = (els: HTMLElement[], kf: Keyframe[], dur: number, at: number, step = 0, easing = SOFT) =>
      els.forEach((el, i) => anims.push(el.animate(kf, { duration: dur * 1000, delay: (at + i * step) * 1000, fill: "both", easing })));
    const fade = (from: string): Keyframe[] => [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }];
    run(q(".brand"), fade("translateY(-10px)"), 0.5, 0.04); run(q(".menu"), fade("translateY(-10px)"), 0.5, 0.09);
    run(q(".nav"), fade("translateY(-10px)"), 0.55, 0.13); run(q(".header .join"), fade("translateY(-10px)"), 0.55, 0.18);
    q(".headline-line").forEach((l, i) => {
      run([l], [{ clipPath: "inset(0 -.12em 100% -.12em)" }, { clipPath: "inset(-.34em -.12em -.34em -.12em)" }], 0.95, 0.22 + i * 0.11, 0, TYPE);
      run(Array.from(l.children) as HTMLElement[], [{ transform: "translateY(.9em)" }, { transform: "none" }], 0.95, 0.22 + i * 0.11, 0, TYPE);
    });
    run(q(".hero"), [{ opacity: 0, transform: `translateY(${px(22)}) scale(.99)` }, { opacity: 1, transform: "none" }], 1.05, 0.48, 0, TYPE);
    run(q(".feature"), fade(`translateX(${px(12)})`), 0.55, 0.52, 0.07);
    run(q(".ghost"), [{ opacity: 0 }, { opacity: 1 }], 0.9, 0.62, 0.09);
    run(q(".robo-o-avatar"), fade("scale(.88)"), 0.62, 0.8, 0, TYPE);
    run(q(".glass-card"), fade(`translateY(${px(18)})`), 0.78, 0.7, 0, TYPE);
    run(q(".creator"), fade(`translateY(${px(10)})`), 0.6, 0.82);
    run(q(".material"), [{ opacity: 0 }, { opacity: 1 }], 0.72, 0.86);
    run(q(".material-pill"), [{ transform: `translateX(${px(16)})` }, { transform: "none" }], 0.72, 0.86, 0, TYPE);
    run(q(".avatar"), fade("scale(.9)"), 0.55, 0.94, 0.06, TYPE);
    run(q(".social"), fade(`translateY(${px(9)})`), 0.5, 1.08, 0.05);
    const last = anims.reduce((a, b) => ((b.effect?.getComputedTiming().endTime as number) > (a.effect?.getComputedTiming().endTime as number) ? b : a));
    last.onfinish = () => { root.classList.remove("intro"); anims.forEach((a) => a.cancel()); anims.length = 0; };
    return () => anims.forEach((a) => a.cancel());
  }, []);

  const choose = (i: number) => { const n = ((i % 5) + 5) % 5; setCur(n); say(`Block ${String(n + 1).padStart(2, "0")} · ${BLOCKS[n].name}`); };
  const b = BLOCKS[cur];
  const cls = ["stage", phone && "is-phone", fit && "is-fit", compact && "nav-compact", menu && "menu-open"].filter(Boolean).join(" ");
  const links = (
    <>
      <Link href="/" className="active">Home page</Link>
      <Link href="/workbench">Workbench</Link>
      <a href="#r" onClick={(e) => { e.preventDefault(); say("Rulebook v1.0 · 13 building blocks"); closeMenu(); }}>Rulebook</a>
      <Link href="/login">Sign in</Link>
    </>
  );

  return (
    <main className={"viewport bg" + (phone ? " phone-wrap" : "")} aria-label="Circuit Engine experience">
      <div className={cls} ref={stageRef}>
        <header className="header">
          <Link className="brand" href="/" aria-label="Circuit Engine"><Brand /></Link>
          <button className="menu" aria-label="Menu" aria-expanded={menu} onClick={() => { setMenu(!menu); say(menu ? "Menu closed" : "Menu ready"); }}><span /><span /><span /></button>
          <nav className="nav" aria-label="Main">{links}</nav>
          <Link className="join" href={user ? "/workbench" : "/login"}><span className="join-icon"><PersonIcon /></span><span className="join-label">{user ? "Workbench" : "Join us"}</span></Link>
          <div className="menu-panel" aria-hidden={!menu}>
            {links}
            <Link className="join menu-join" href={user ? "/workbench" : "/login"}><span className="join-icon"><PersonIcon s={26} /></span><span className="join-label">{user ? "Workbench" : "Join us"}</span></Link>
          </div>
        </header>

        <h1 className="headline" id="home">
          <span className="headline-line"><span className="hl-rv">Circuits — rules</span></span>
          <span className="headline-line headline-line2">
            <svg className="chain" viewBox="0 0 151 48" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="7"><rect x="4" y="9" width="52" height="30" rx="15" /><rect x="49" y="9" width="52" height="30" rx="15" /><rect x="94" y="9" width="52" height="30" rx="15" /></g></svg>
            <span>meet real parts</span>
          </span>
        </h1>

        <div className="features">
          <div className="feature"><span>13-block rulebook</span><b>/01</b></div>
          <div className="feature"><span>Simulation checked</span><b>/02</b></div>
          <div className="feature"><span>KiCad import</span><b>/03</b></div>
        </div>

        <div className="creator">
          <span className="verified"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#06192f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.2 6.2 4.7 8.5 9.8 3" /></svg></span>
          <div className="creator-copy">By Circuit Engine<div className="series">Rulebook series · v1.0</div></div>
        </div>

        <div className="glass-card glass">
          <div className="card-top">
            <div className="count"><strong>+13</strong><small>rulebook blocks</small></div>
            <button className="eye" aria-label="Preview x-ray layer" onClick={() => { setAwake(!awake); say(awake ? "Preview paused" : "Previewing live analysis"); }}>
              <svg width="33" height="23" viewBox="0 0 32 22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 11C5 4 10 1 16 1s11 3 15 10c-4 7-9 10-15 10S5 18 1 11z" /><circle cx="16" cy="11" r="3.5" /></svg>
            </button>
          </div>
          <p className="card-copy">Score, simplify and verify any circuit from a netlist or a plain-English brief.</p>
          <div className="card-bottom">
            <Link className="start" href="/workbench">Start<br /><strong>analyzing</strong></Link>
            <button className="shuffle" aria-label="Next block" onClick={() => choose(cur + 1)}>
              <svg width="27" height="27" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h5c8 0 7 14 15 14h4M3 22h5c3 0 5-2 6.5-4.5M17 11c1.5-2 3.5-3 6-3h4M23 4l4 4-4 4M23 18l4 4-4 4" /></svg>
            </button>
            <button className={"play" + (awake ? " active" : "")} aria-label="Toggle live analysis" aria-pressed={awake} onClick={() => { setAwake(!awake); say(awake ? "Analysis paused" : "Analysis live"); }}>
              <svg width="24" height="26" viewBox="0 0 26 28" fill="currentColor" style={{ marginLeft: 4 }}><path d="m3 2 19 12L3 26z" /></svg>
            </button>
          </div>
        </div>

        <div className="ghost ghost-one" aria-hidden="true">N<i className="o-gap" />DE</div>
        <div className="ghost ghost-two" aria-hidden="true">GRID</div>
        <div className="robo-o-avatar" aria-hidden="true"><div className="o-art"><BoardArt /></div></div>

        <SpotlightHero id="hero" awake={awake} hue={b.hue} sat={b.sat} />

        <div className="material">
          <div className="material-pill">
            <div className="material-thumb" aria-hidden="true"><svg viewBox="0 0 120 110" width="168" height="153" style={{ position: "absolute", left: -25, top: 35 }}><rect x="30" y="25" width="60" height="60" rx="8" fill="#dbe7f5" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${40 + i * 14} 25v-14M${40 + i * 14} 85v14M30 ${35 + i * 14}h-14M90 ${35 + i * 14}h14`} stroke="#9fb2c6" strokeWidth="3" />)}</svg></div>
            <div className="material-copy">Live part<br />data</div>
            <button className="material-next" aria-label="Next block" onClick={() => choose(cur + 1)}>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M7 8 24 25M12 25h12V13" /></svg>
            </button>
          </div>
        </div>

        <div className="gallery" role="group" aria-label="Building blocks">
          {BLOCKS.map((x, i) => (
            <button key={x.name} className={"avatar" + (cur === i ? " active" : "")} style={{ left: POS[i][0], top: POS[i][1] }}
              aria-label={`Block ${i + 1}: ${x.name}`} aria-pressed={cur === i} onClick={() => choose(i)}>{x.icon}</button>))}
        </div>

        <div className="socials">
          {[["Source", "M8 7 3 12l5 5M16 7l5 5-5 5"], ["Docs", "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"], ["Contact", "M3 6h18v12H3zM3 7l9 7 9-7"]].map(([n, d]) => (
            <button key={n} className="social" aria-label={n} onClick={() => say(`${n} selected`)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></button>))}
        </div>
      </div>
    </main>
  );
}
