"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CircuitGraph from "../../components/CircuitGraph";
import SiteHeader from "../../components/SiteHeader";
import { useToast } from "../../components/Toast";
import { Analysis, Circuit, Result, api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

const LABEL = { hard: "Must fix", suggest: "Suggestion", flag: "Check", ok: "Passed" } as const;
type Tab = "examples" | "describe" | "kicad" | "json";
const TABS: [Tab, string][] = [["examples", "Examples"], ["describe", "Describe"], ["kicad", "KiCad file"], ["json", "Circuit JSON"]];

export default function Workbench() {
  const say = useToast(), { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("examples");
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [a, setA] = useState<Analysis | null>(null);
  const [examples, setExamples] = useState<Circuit[]>([]);
  const [prompt, setPrompt] = useState("Design a low-power IoT sensor node with battery charging");
  const [json, setJson] = useState("");
  const [assume, setAssume] = useState({ vin: "", iload: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string; circuit: Circuit }[]>([]);

  useEffect(() => { api.examples().then(setExamples).catch(() => setErr("The analysis service is not reachable. Start the backend and reload.")); }, []);
  useEffect(() => { if (user) api.projects().then(setProjects).catch(() => signOut()); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<Result>) => {
    setBusy(true); setErr("");
    try {
      const r = await fn();
      setCircuit(r.circuit); setA(r.analysis); setJson(JSON.stringify(r.circuit, null, 2)); if (r.note) say(r.note);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const analyzeCircuit = (c: Circuit) => run(async () => ({ circuit: c, analysis: await api.analyze(c) }));
  const fromJson = () => { try { analyzeCircuit(JSON.parse(json)); } catch { setErr("That JSON is not valid. Check commas and quotes."); } };
  const fromFile = async (f?: File) => {
    if (!f) return;
    const text = await f.text();
    run(() => api.kicad(text, parseFloat(assume.vin) || undefined, parseFloat(assume.iload) || undefined));
  };
  const save = async () => {
    if (!circuit) return;
    try { await api.save(circuit.name, circuit); setProjects(await api.projects()); say("Project saved"); } catch (e: any) { setErr(e.message); }
  };
  const download = async () => {
    if (!circuit) return;
    const { markdown } = await api.report(circuit);
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    Object.assign(document.createElement("a"), { href: url, download: `${circuit.name.replace(/\W+/g, "-")}-report.md` }).click();
    URL.revokeObjectURL(url); say("Report downloaded");
  };

  return (
    <div className="page bg">
      <SiteHeader active="workbench" />
      <div className="wb">
        <aside className="rail glass">
          <h1 className="wb-title">Workbench</h1>
          <div className="tabs" role="group" aria-label="Input method">
            {TABS.map(([t, l]) => <button key={t} className={tab === t ? "on" : ""} aria-pressed={tab === t} onClick={() => setTab(t)}>{l}</button>)}
          </div>
          {tab === "examples" && (<div className="stack"><p className="muted">Start from a sample circuit and see what the engine finds.</p>
            {examples.map((e) => <button className="btn" key={e.name} onClick={() => analyzeCircuit(e)} disabled={busy}>{e.name}</button>)}</div>)}
          {tab === "describe" && (<div className="stack"><label htmlFor="p">Describe the circuit you need</label>
            <textarea id="p" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <button className="btn primary" disabled={busy} onClick={() => run(() => api.design(prompt))}>Design and score</button></div>)}
          {tab === "kicad" && (<div className="stack"><p className="muted">Upload a KiCad netlist (.net). Regulator input voltage and load are guessed unless you set them.</p>
            <input aria-label="Input voltage (V)" placeholder="Input voltage (V), optional" value={assume.vin} onChange={(e) => setAssume({ ...assume, vin: e.target.value })} />
            <input aria-label="Load current (A)" placeholder="Load current (A), optional" value={assume.iload} onChange={(e) => setAssume({ ...assume, iload: e.target.value })} />
            <input type="file" accept=".net,.txt" aria-label="KiCad netlist" onChange={(e) => fromFile(e.target.files?.[0])} /></div>)}
          {tab === "json" && (<div className="stack"><label htmlFor="j">Circuit as JSON</label>
            <textarea id="j" rows={14} className="mono" value={json} onChange={(e) => setJson(e.target.value)} />
            <button className="btn primary" disabled={busy || !json} onClick={fromJson}>Analyze</button></div>)}
          {err && <p className="error" role="alert">{err}</p>}
          <div className="stack"><h2>Saved projects</h2>
            {!user && <p className="muted"><Link href="/login">Sign in</Link> to save circuits and reopen them later.</p>}
            {user && projects.length === 0 && <p className="muted">Nothing saved yet. Analyze a circuit, then save it.</p>}
            {projects.map((p) => (<div className="proj" key={p.id}>
              <button className="btn" onClick={() => analyzeCircuit(p.circuit)}>{p.name}</button>
              <button className="btn" aria-label={`Delete ${p.name}`} onClick={async () => { await api.remove(p.id); setProjects(await api.projects()); say("Project deleted"); }}>Delete</button></div>))}
          </div>
        </aside>

        <div className="stage-col">
          {!circuit || !a ? (<section className="glass empty"><h2>Pick a circuit to analyze</h2><p className="muted">Try an example, describe what you need, or upload a KiCad netlist.</p></section>) : (<>
            <section className="glass stats">
              <div><div className="score">{a.score}</div><small>Design score out of 100</small></div>
              <div><strong>{a.parts_before} → {a.parts_after}</strong><small>Parts after simplification</small></div>
              <div><strong>${a.bom_cost}</strong><small>Known part cost</small></div>
              <div className="row end"><button className="btn" onClick={download}>Download report</button>
                {user ? <button className="btn primary" onClick={save}>Save project</button> : <Link className="btn" href="/login">Sign in to save</Link>}</div>
            </section>
            <section className="glass"><h2>{circuit.name}</h2><CircuitGraph circuit={circuit} findings={a.findings} /></section>
            <section className="glass"><h2>Findings</h2>
              {a.findings.map((f, i) => (
                <article key={i} className={`finding ${f.severity}`}>
                  <h3><span className={`sev ${f.severity}`}>{LABEL[f.severity]}</span> · {f.ref}: {f.title}</h3>
                  <p>{f.reason}</p>
                  {f.replacement && <p><strong>Try:</strong> {f.replacement}</p>}
                  <span className="meta">{f.block.replace(/_/g, " ")} · confidence {f.confidence}{f.verification ? ` · ${f.verification.agrees ? "verified" : "mismatch"} by ${f.verification.method}` : " · rule-based"}</span>
                </article>))}
            </section>
            <section className="glass"><h2>Simplification</h2>
              {a.simplifications.length === 0 && <p className="muted">No part-count reductions found for this circuit.</p>}
              {a.simplifications.map((s, i) => (
                <article key={i} className="finding suggest"><h3>{s.ref}: {s.title}</h3><p>{s.reason}</p>
                  <span className="meta">saves {s.saves} parts · confidence {s.confidence}</span></article>))}
            </section></>)}
        </div>
      </div>
    </div>
  );
}
