"""Rule engine implementing the Circuit Engine rulebook (blocks 1-13)."""
import math
from .parts import part_findings, bom_cost
from .verify import verify_findings

ACTIVE = {"ic", "opamp", "linear_regulator", "switching_regulator", "charger"}
ORDER = {"hard": 0, "suggest": 1, "flag": 2, "ok": 3}

def F(c, block, sev, title, reason, conf, **x):
    return {"ref": c["ref"], "block": block, "severity": sev, "title": title, "reason": reason,
            "confidence": round(max(0.05, min(conf, 0.99)), 2), "hard_flag": sev == "hard", **x}

def cf(base, p):  # confidence drops when inputs were inferred (e.g. from a KiCad import)
    return base * (0.75 if p.get("inferred") else 1)

def linear(c, ctx):  # block 1
    p = c["params"]; vin, vout, i = p.get("vin", 0), p.get("vout", 0), p.get("iload", 0)
    w = (vin - vout) * i; eff = 100 * vout / vin if vin else 0; k = cf(0.9, p)
    if w > 0.75 and i > 0.1 and not p.get("noise_sensitive"):
        saved = vin * i - vout * i / 0.9
        return [F(c, "linear_regulator", "suggest", "Replace with a buck converter",
                  f"Linear regulator wastes {w:.2f}W as heat at this load ({eff:.0f}% efficient) - a buck converter would recover about {saved:.2f}W.",
                  k, waste_w=round(w, 2), saved_w=round(saved, 2), replacement="Buck regulator IC (e.g. TPS5430)")]
    return [F(c, "linear_regulator", "ok", "Linear regulator is appropriate",
              f"Dissipates {w:.2f}W at {eff:.0f}% efficiency; no switching alternative recommended.", k, waste_w=round(w, 2))]

def switching(c, ctx):  # block 2
    p = c["params"]; vin, vout, i = p.get("vin", 0), p.get("vout", 0), p.get("iload", 0); k = cf(0.65, p)
    if p.get("noise_sensitive"):
        return [F(c, "switching_regulator", "flag", "Noise-sensitive load", "Consider a linear regulator, or a switching stage followed by a linear post-regulator.", k)]
    if i < 0.02 or vin - vout < 0.5:
        return [F(c, "switching_regulator", "flag", "Switching regulator may be unnecessary", "At this load or voltage drop, quiescent current can erase the efficiency gain.", k)]
    return [F(c, "switching_regulator", "ok", "Switching regulator is a good fit", f"Recovers most of the {(vin - vout) * i:.2f}W a linear stage would burn.", k)]

def charger(c, ctx):  # block 3
    p = c["params"]; out = []
    if not p.get("has_charge_ic", True):
        out.append(F(c, "charger", "hard", "Use a dedicated charge-management IC", "Battery charging without integrated protection (overvoltage, overcurrent, thermal cutoff) is a safety risk, not just an efficiency issue.", 0.95))
    if p.get("topology", "linear") == "linear" and (p.get("capacity_mah", 0) > 1000 or p.get("charge_current_a", 0) > 1):
        out.append(F(c, "charger", "suggest", "Move to a switch-mode charger", "Linear charging at this capacity or current wastes significant heat and slows charging.", 0.5, replacement="Switch-mode Li-ion charger IC"))
    return out or [F(c, "charger", "ok", "Charging stage looks sound", "Dedicated charge IC with a topology that fits the battery size.", 0.5)]

def rc(c, ctx):  # block 4
    p = c["params"]; r, cap = p.get("r", 0), p.get("c", 0)
    if r <= 0 or cap <= 0: return []
    fc = 1 / (2 * math.pi * r * cap); out = []; kind = p.get("type", "lowpass"); tgt = p.get("intended_hz"); s = p.get("signal_hz")
    if tgt and abs(fc - tgt) / tgt > 0.2:
        out.append(F(c, "rc_filter", "flag", "Cutoff does not match the goal", f"This RC combination gives a cutoff of {fc:.1f}Hz, not the {tgt:g}Hz the design calls for.", 0.85, cutoff_hz=fc))
    if s and ((kind == "lowpass" and fc < 10 * s) or (kind == "highpass" and fc > s / 10)):
        out.append(F(c, "rc_filter", "flag", "Too little margin from the signal", f"Cutoff {fc:.1f}Hz is within a decade of the {s:g}Hz signal, so the signal may be attenuated.", 0.85, cutoff_hz=fc))
    return out or [F(c, "rc_filter", "ok", "Filter cutoff looks right", f"Cutoff is {fc:.1f}Hz.", 0.85, cutoff_hz=fc)]

def divider(c, ctx):  # block 5
    p = c["params"]; r1, r2, vin = p.get("r1", 0), p.get("r2", 0), p.get("vin", 0)
    if r1 <= 0 or r2 <= 0: return []
    idiv = vin / (r1 + r2); load = p.get("load_current_a", 0); vo = vin * r2 / (r1 + r2)
    if load > 0.01 * idiv:
        rl = vo / load; r2p = r2 * rl / (r2 + rl); vl = vin * r2p / (r1 + r2p)
        return [F(c, "divider", "hard", "Divider is being used as a power supply", f"Output sags from {vo:.2f}V to about {vl:.2f}V under a {load * 1000:g}mA load - use a regulator or reference IC instead.", 0.9, loaded_v=round(vl, 3), replacement="Linear regulator or voltage reference IC")]
    if p.get("feeds") == "high_z" and idiv > 1e-3:
        return [F(c, "divider", "suggest", "Raise the resistor values", f"The divider wastes {idiv * 1000:.1f}mA continuously; larger values cut that for a high-impedance input.", 0.9)]
    return [F(c, "divider", "ok", "Divider is used as a reference", "Negligible load current, so the output holds.", 0.9)]

def opamp(c, ctx):  # block 6
    p = c["params"]; role = p.get("role", "buffer"); out = []
    if role == "comparator" and not p.get("hysteresis"):
        out.append(F(c, "opamp", "flag", "Add hysteresis or use a comparator IC", "Chatter risk near the threshold with a noisy input. Use a dedicated comparator IC, or add positive feedback.", 0.75, replacement="Comparator IC (e.g. LM393)"))
    if role == "amplifier":
        sw = p.get("vsupply", 5) - (0 if p.get("rail_to_rail") else 1.5); vo = p.get("vin_max", 0) * p.get("gain", 1)
        if vo > sw:
            out.append(F(c, "opamp", "hard", "Output will clip", f"Expected peak {vo:.2f}V exceeds the usable output swing of about {sw:.2f}V.", 0.9))
    return out or [F(c, "opamp", "ok", "Op-amp stage looks fine", "Role, gain and output swing are consistent.", 0.75)]

def mosfet(c, ctx):  # blocks 7, 9
    p = c["params"]; out = []
    if p.get("vgs_required", 0) > p.get("gpio_v", 99):
        out.append(F(c, "mosfet", "hard", "MOSFET will not fully turn on", f"This MOSFET needs {p['vgs_required']:g}V at the gate to fully turn on; the GPIO only supplies {p['gpio_v']:g}V. Use a logic-level MOSFET or add a gate driver.", 0.85, replacement="Logic-level MOSFET (e.g. IRLZ44N)"))
    if p.get("load_inductive") and not p.get("flyback"):
        out.append(F(c, "mosfet", "hard", "Add a flyback diode", "Switching off an inductive load produces a voltage spike that can exceed the MOSFET rating. A flyback diode costs about $0.02.", 0.95, replacement="Flyback diode (e.g. 1N4007)"))
    return out or [F(c, "mosfet", "ok", "Gate drive and protection look right", "Fully enhanced at the GPIO voltage, with flyback protection where needed.", 0.85)]

def led(c, ctx):  # block 8
    p = c["params"]
    if p.get("topology", "resistor") == "resistor" and (p.get("led_count", 1) > 3 or p.get("total_current_a", 0) > 0.1 or p.get("consistency")):
        return [F(c, "led_driver", "suggest", "Use a constant-current driver IC", "Resistor-limiting wastes more power and gives less consistent brightness at this scale.", 0.85, replacement="Constant-current LED driver IC")]
    return [F(c, "led_driver", "ok", "LED drive is appropriate", "Drive method matches the LED count and current.", 0.85)]

def switch_in(c, ctx):  # blocks 9, 11
    p = c["params"]; out = []
    if not p.get("pull"): out.append(F(c, "pull_network", "hard", "Floating input", "This input has no defined state when not actively driven - add a pull-up or pull-down resistor.", 0.9))
    if not p.get("debounce"): out.append(F(c, "debounce", "flag", "Add debounce", "Mechanical switches bounce for a few ms and can cause multiple unintended transitions.", 0.6))
    if p.get("exposed") and not p.get("esd"): out.append(F(c, "protection", "flag", "Consider TVS protection", "An exposed input without ESD protection risks damage.", 0.6))
    return out or [F(c, "pull_network", "ok", "Input is defined and debounced", "Pull resistor and debounce are present.", 0.9)]

def connector(c, ctx):
    p = c["params"]
    if p.get("exposed") and not p.get("esd"):
        return [F(c, "protection", "flag", "Consider TVS protection", "An exposed connector without ESD protection risks damage.", 0.6)]
    return []

def i2c(c, ctx):  # block 11
    if not c["params"].get("pullups"):
        return [F(c, "pull_network", "hard", "I2C needs pull-ups", "I2C uses open-drain outputs and will not work without pull-up resistors on SDA and SCL.", 0.9)]
    return [F(c, "pull_network", "ok", "I2C pull-ups present", "SDA and SCL are pulled up.", 0.9)]

def sensor(c, ctx):  # block 10
    p = c["params"]; ref = p.get("adc_ref", 0)
    if ref <= 0: return []
    used = (p.get("out_max", 0) - p.get("out_min", 0)) / ref
    if used < 0.5:
        return [F(c, "sensor", "flag", "Sensor underuses the ADC range", f"Sensor only spans {used * 100:.0f}% of the ADC's input range - an amplifier stage would improve effective resolution.", 0.65)]
    return [F(c, "sensor", "ok", "Sensor range fits the ADC", f"Uses {used * 100:.0f}% of the ADC range.", 0.65)]

def decoupled(c, ctx):  # block 13
    if "decoupled" in c["params"]: return bool(c["params"]["decoupled"])
    for n in ctx["nets"]:
        nm = n["name"].lower()
        if "gnd" in nm or nm in ("0", "vss", "ground") or c["ref"] not in n["nodes"]: continue
        if any(ctx["kinds"].get(x) == "capacitor" for x in n["nodes"]): return True
    return False

RULES = {"linear_regulator": [linear], "switching_regulator": [switching], "charger": [charger], "rc_filter": [rc],
         "divider": [divider], "opamp": [opamp], "mosfet": [mosfet], "led_driver": [led], "switch_input": [switch_in],
         "connector": [connector], "i2c_bus": [i2c], "sensor": [sensor]}

def analyze(circuit):
    comps = [{**c, "params": c.get("params") or {}} for c in circuit["components"]]
    ctx = {"nets": circuit.get("nets", []), "kinds": {c["ref"]: c["kind"] for c in comps}}
    out = []
    for c in comps:
        for fn in RULES.get(c["kind"], []): out += fn(c, ctx)
        if c["kind"] in ACTIVE and not decoupled(c, ctx):
            out.append(F(c, "decoupling", "hard", "Missing decoupling capacitor", "Active ICs need a local decoupling capacitor (typically 0.1uF) close to their power pins to prevent glitches from fast current demands.", 0.98, replacement="0.1uF ceramic capacitor"))
    return out

FINGERPRINTS = [  # block 12 pattern library
    {"name": "discrete linear regulator", "need": {"transistor": 1, "zener": 1, "resistor": 2}, "ic": "3-pin LDO (e.g. AMS1117-3.3)", "saves": 3},
    {"name": "discrete comparator with hysteresis", "need": {"transistor": 2, "resistor": 4}, "ic": "comparator IC with hysteresis (e.g. LM393)", "saves": 5},
]

def simplify(circuit):
    comps = circuit["components"]; out = []; counts = {}; rc_by_sig = {}
    def S(c, title, reason, conf, saves, rep=None):
        out.append({"ref": c["ref"], "title": title, "reason": reason, "confidence": round(conf, 2), "saves": saves, "replacement": rep})
    for c in comps:
        p = c.get("params") or {}; k = c["kind"]; counts[k] = counts.get(k, 0) + 1
        if k == "switching_regulator" and p.get("iload", 1) < 0.02 and p.get("vin", 0) - p.get("vout", 0) < 1:
            S(c, "Replace with a linear regulator", "Inductor, extra capacitors, and switching complexity aren't earning their keep at this load.", 0.65, 2, "Linear regulator IC")
        if k == "charger" and p.get("capacity_mah", 1e9) < 500 and p.get("cost_priority") and p.get("topology") == "switch":
            S(c, "A linear charger IC may suffice", "At this capacity the charge-time and heat differences are small; a linear charger is fewer parts and lower cost.", 0.5, 3, "Linear charger IC")
        if k == "led_driver" and p.get("topology") == "driver_ic" and p.get("led_count", 9) == 1 and p.get("total_current_a", 1) <= 0.02:
            S(c, "A series resistor is enough", "Driver IC complexity isn't justified for a single indicator LED.", 0.85, 1, "Series resistor")
        if k == "opamp" and p.get("role") == "comparator":
            S(c, "Swap to a dedicated comparator IC", "Often cheaper, and includes built-in hysteresis.", 0.75, 0, "Comparator IC (e.g. LM393)")
        if k == "rc_filter" and p.get("signal"): rc_by_sig.setdefault(p["signal"], []).append(c)
    for sig, group in rc_by_sig.items():
        if len(group) > 1:
            S(group[0], "Consolidate RC stages", f"{len(group)} RC stages filter the same signal ({sig}); one stage at a recalculated value may do the job.", 0.7, (len(group) - 1) * 2)
    for fp in FINGERPRINTS:
        total = sum(fp["need"].values()); hit = sum(min(counts.get(k, 0), n) for k, n in fp["need"].items())
        sim = hit / total
        if sim >= 0.75 and comps:
            S(comps[0], f"Looks like a {fp['name']}", f"This {total}-part discrete cluster matches the standard pattern ({sim * 100:.0f}% similar) - {fp['ic']} does the same job in one part. Check the design doesn't need a custom trip point.", sim * 0.9, fp["saves"], fp["ic"])
    return out

def score(fs):
    pen = {"hard": 15, "suggest": 6, "flag": 4}
    return max(0, round(100 - sum(pen.get(f["severity"], 0) * f["confidence"] / 0.9 for f in fs)))

def run(circuit, verify=True):
    fs = analyze(circuit) + part_findings(circuit)
    if verify: fs = verify_findings(circuit, fs)
    fs.sort(key=lambda f: ORDER[f["severity"]])
    simp = simplify(circuit); n = len(circuit["components"])
    return {"findings": fs, "simplifications": simp, "score": score(fs), "parts_before": n,
            "parts_after": max(1, n - sum(s["saves"] for s in simp)), "bom_cost": bom_cost(circuit)}
