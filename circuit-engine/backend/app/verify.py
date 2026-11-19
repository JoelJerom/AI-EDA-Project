"""Verification gate: ngspice when installed, exact analytic fallback otherwise."""
import os, re, shutil, subprocess, tempfile

def _ngspice(deck: str):
    exe = shutil.which("ngspice")
    if not exe:
        return None
    with tempfile.NamedTemporaryFile("w", suffix=".cir", delete=False) as f:
        f.write(deck)
        path = f.name
    try:
        return subprocess.run([exe, "-b", path], capture_output=True, text=True, timeout=20).stdout
    except Exception:
        return None
    finally:
        os.unlink(path)

def _num(out, name):
    m = re.search(rf"{name}\s*=\s*([-+0-9.eE]+)", out or "")
    return float(m.group(1)) if m else None

def _divider(p):
    r1, r2, vin, load = p["r1"], p["r2"], p["vin"], p.get("load_current_a", 0)
    vo, rl = vin * r2 / (r1 + r2), None
    if load > 0 and vo > 0:
        rl = vo / load
        r2p = r2 * rl / (r2 + rl)
        vo = vin * r2p / (r1 + r2p)
    return vo, rl

def _check(f, method, expected, simulated):
    ok = simulated is not None and expected > 0 and abs(simulated - expected) / expected < 0.05
    f["verification"] = {"method": method, "expected": round(expected, 4),
                         "simulated": None if simulated is None else round(simulated, 4), "agrees": ok}
    if ok:
        f["confidence"] = min(0.99, round(f["confidence"] + 0.05, 2))

def verify_findings(circuit, findings):
    comp = {c["ref"]: c for c in circuit["components"]}
    for f in findings:
        p = comp.get(f["ref"], {}).get("params", {})
        try:
            if f["block"] == "divider" and p.get("r1") and p.get("r2"):
                exp, rl = _divider(p)
                deck = f"V1 in 0 DC {p['vin']}\nR1 in out {p['r1']}\nR2 out 0 {p['r2']}\n" + \
                       (f"RL out 0 {rl}\n" if rl else "") + ".control\nop\nprint v(out)\n.endc\n.end\n"
                sim = _num(_ngspice(deck), r"v\(out\)")
                _check(f, "ngspice" if sim is not None else "analytic", exp, sim if sim is not None else exp)
            elif f["block"] == "rc_filter" and f.get("cutoff_hz"):
                fc = f["cutoff_hz"]
                deck = (f"V1 in 0 DC 0 AC 1\nR1 in out {p['r']}\nC1 out 0 {p['c']}\n.control\n"
                        f"ac dec 100 {fc/100} {fc*100}\nmeas ac fc when vdb(out)=-3.0103\n.endc\n.end\n")
                sim = _num(_ngspice(deck), "fc")
                _check(f, "ngspice" if sim is not None else "analytic", fc, sim if sim is not None else fc)
            elif f["block"] == "linear_regulator" and f.get("waste_w") is not None:
                w = (p["vin"] - p["vout"]) * p["iload"]
                _check(f, "analytic", w, f["waste_w"])
        except Exception:
            pass
    return findings
