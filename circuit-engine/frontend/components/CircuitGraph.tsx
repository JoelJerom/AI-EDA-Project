import { Circuit, Finding } from "../lib/api";

const W = 168, H = 62, GX = 40, GY = 58, COLS = 4, PAD = 20;
const RANK = { hard: 3, suggest: 2, flag: 1, ok: 0 } as const;
const label = (k: string) => k.replace(/_/g, " ");

export default function CircuitGraph({ circuit, findings }: { circuit: Circuit; findings: Finding[] }) {
  const comps = circuit.components;
  const pos = Object.fromEntries(comps.map((c, i) => [c.ref, { x: PAD + (i % COLS) * (W + GX), y: PAD + Math.floor(i / COLS) * (H + GY) }]));
  const worst = (ref: string) => {
    const fs = findings.filter((f) => f.ref === ref);
    return fs.length ? fs.reduce((a, f) => (RANK[f.severity] > RANK[a] ? f.severity : a), "ok" as Finding["severity"]) : "none";
  };
  const width = PAD * 2 + Math.min(COLS, comps.length) * (W + GX) - GX;
  const height = PAD * 2 + Math.ceil(comps.length / COLS) * (H + GY) - GY;
  const hubs = (circuit.nets || [])
    .map((n) => ({ n, pts: n.nodes.filter((r) => pos[r]).map((r) => ({ x: pos[r].x + W / 2, y: pos[r].y + H / 2 })) }))
    .filter((h) => h.pts.length > 1)
    .map((h) => ({ ...h, cx: h.pts.reduce((s, p) => s + p.x, 0) / h.pts.length, cy: h.pts.reduce((s, p) => s + p.y, 0) / h.pts.length }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="graph" role="img" aria-label={`Netlist view of ${circuit.name}`}>
      {hubs.map((h) => h.pts.map((p, i) => <line key={h.n.name + i} x1={h.cx} y1={h.cy} x2={p.x} y2={p.y} className="trace" />))}
      {comps.map((c) => {
        const { x, y } = pos[c.ref];
        return (
          <g key={c.ref} className={`part sev-${worst(c.ref)}`}>
            <rect x={x} y={y} width={W} height={H} rx={3} />
            <text x={x + 10} y={y + 24} className="ref">{c.ref}</text>
            <text x={x + 10} y={y + 44} className="kind">{c.part ? `${c.part} · ` : ""}{label(c.kind)}</text>
          </g>
        );
      })}
      {hubs.map((h) => (
        <g key={h.n.name}>
          <circle cx={h.cx} cy={h.cy} r={5} className="hub" />
          <text x={h.cx + 9} y={h.cy - 7} className="netname">{h.n.name}</text>
        </g>
      ))}
    </svg>
  );
}
