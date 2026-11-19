// Decorative PCB. xray=false is the clean board; xray=true is the "analysis" layer the spotlight reveals.
export default function BoardArt({ xray = false }: { xray?: boolean }) {
  const c = xray ? "#7fb2ff" : "#dbe7f5";
  const idx = [0, 1, 2, 3, 4, 5, 6, 7];
  const L = idx.map((i) => ({ y: 330 + i * 24, y2: 140 + i * 70 }));
  const T = idx.map((i) => ({ x: 222 + i * 22, x2: 110 + i * 54 }));
  return (
    <svg viewBox="0 0 600 759" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={xray ? "cx" : "cf"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={xray ? "#3a1c22" : "#f4f8fc"} /><stop offset="1" stopColor={xray ? "#160c12" : "#9fb2c6"} />
        </linearGradient>
      </defs>
      <rect x="40" y="70" width="520" height="650" rx="30" fill={xray ? "rgba(6,12,24,.94)" : "rgba(255,255,255,.04)"} stroke={c} strokeWidth="2" />
      <g fill="none" stroke={c} strokeWidth={xray ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
        {L.map((p, i) => <path key={"l" + i} d={`M190 ${p.y} H150 L110 ${p.y2} H70`} />)}
        {L.map((p, i) => <path key={"r" + i} d={`M410 ${p.y} H450 L490 ${p.y2} H530`} />)}
        {T.map((p, i) => <path key={"t" + i} d={`M${p.x} 300 V262 L${p.x2} 220 V110`} />)}
        {T.map((p, i) => <path key={"b" + i} d={`M${p.x} 520 V558 L${p.x2} 600 V650`} />)}
      </g>
      <g fill={c}>
        {L.map((p, i) => <circle key={"lp" + i} cx="70" cy={p.y2} r="6" />)}
        {L.map((p, i) => <circle key={"rp" + i} cx="530" cy={p.y2} r="6" />)}
        {T.map((p, i) => <circle key={"tp" + i} cx={p.x2} cy="110" r="6" />)}
        {T.map((p, i) => <circle key={"bp" + i} cx={p.x2} cy="650" r="6" />)}
      </g>
      <g fill="none" stroke={c} strokeWidth="2">
        {[[70, 100], [530, 100], [70, 690], [530, 690]].map(([x, y]) => <circle key={x + "" + y} cx={x} cy={y} r="11" />)}
      </g>
      <rect x="190" y="300" width="220" height="220" rx="14" fill={`url(#${xray ? "cx" : "cf"})`} stroke={xray ? "#ff6b61" : c} strokeWidth={xray ? 3 : 2} />
      <circle cx="208" cy="318" r="5" fill={xray ? "#ff6b61" : "#51657a"} />
      {!xray ? (
        <text x="300" y="418" textAnchor="middle" fontSize="40" fontWeight="700" fill="#33495f" fontFamily="monospace">CE-1</text>
      ) : (
        <g fontFamily="monospace" textAnchor="middle">
          <text x="300" y="378" fontSize="15" fill="#ff6b61">Must fix</text>
          <text x="300" y="404" fontSize="17" fill="#ffd9d6" fontWeight="700">3.5W lost as heat</text>
          <text x="300" y="430" fontSize="14" fill="#f0b64a">Try a buck converter</text>
          <text x="300" y="470" fontSize="14" fill="#5aa2ff">Cutoff 159 Hz ✓ verified</text>
        </g>
      )}
      {xray && (
        <g fontFamily="monospace">
          <circle cx="70" cy="420" r="16" fill="none" stroke="#f0b64a" strokeWidth="3" />
          <text x="60" y="750" fontSize="46" fontWeight="700" fill="#ff6b61">62</text>
          <text x="128" y="750" fontSize="16" fill="#8196ad">/ 100 design score</text>
        </g>
      )}
    </svg>
  );
}
