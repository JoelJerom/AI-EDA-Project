"""Prompt-to-circuit: Groq LLM (forced tool schema) with a keyword fallback.
Output is constrained to known-good templates, never freehand."""
import copy, json, os, re

def C(ref, kind, part="", **params): return {"ref": ref, "kind": kind, "part": part, "params": params}

TEMPLATES = {
 "iot_node": {"triggers": ["iot", "sensor node", "low-power", "low power", "wireless"],
   "components": [C("U1", "linear_regulator", "AMS1117-3.3", vin=4.2, vout=3.3, iload=0.05, decoupled=True),
                  C("U2", "ic", "MCU", decoupled=True), C("B1", "i2c_bus", pullups=True)],
   "nets": [{"name": "3V3", "nodes": ["U1", "U2", "B1"]}]},
 "battery_charging": {"triggers": ["charging", "rechargeable", "li-ion", "lipo", "usb charg", "solar", "battery"],
   "components": [C("U3", "charger", "MCP73831", capacity_mah=500, charge_current_a=0.5, topology="linear", has_charge_ic=True, decoupled=True)],
   "nets": []},
 "motor_driver": {"triggers": ["motor", "relay", "solenoid", "pump", "fan"],
   "components": [C("Q1", "mosfet", "IRLZ44N", vgs_required=2.5, gpio_v=3.3, load_inductive=True, flyback=True), C("U4", "ic", "MCU", decoupled=True)],
   "nets": [{"name": "GATE", "nodes": ["U4", "Q1"]}]},
 "led_strip": {"triggers": ["led strip", "leds", "led driver", "lighting"],
   "components": [C("U5", "switching_regulator", "TPS5430", vin=12, vout=5, iload=0.6, decoupled=True),
                  C("D1", "led_driver", topology="driver_ic", led_count=30, total_current_a=0.6)],
   "nets": [{"name": "5V", "nodes": ["U5", "D1"]}]},
 "sensor_chain": {"triggers": ["sensor", "thermistor", "temperature", "analog", "adc"],
   "components": [C("S1", "sensor", out_min=0, out_max=2.5, adc_ref=3.3),
                  C("A1", "opamp", "LM358", role="amplifier", gain=5, vin_max=0.5, vsupply=3.3, rail_to_rail=True, decoupled=True),
                  C("F1", "rc_filter", r=10000, c=1e-7, type="lowpass", intended_hz=159, signal_hz=10, signal="sensor")],
   "nets": [{"name": "SENSE", "nodes": ["S1", "A1", "F1"]}]},
 "psu": {"triggers": ["power supply", "regulator", "step down", "buck", "converter", "psu"],
   "components": [C("U6", "switching_regulator", "LM2596", vin=12, vout=5, iload=1.0, decoupled=True)],
   "nets": []},
}

def extract(text):
    t = text.lower(); o = {}
    m = re.search(r"(\d+(?:\.\d+)?)\s*v\s*(?:to|->)\s*(\d+(?:\.\d+)?)\s*v", t)
    if m: o["vin"], o["vout"] = float(m[1]), float(m[2])
    m = re.search(r"(\d+(?:\.\d+)?)\s*(ma|a)\b", t)
    if m: o["iload"] = float(m[1]) * (0.001 if m[2] == "ma" else 1)
    m = re.search(r"(\d+)\s*mah", t)
    if m: o["capacity_mah"] = float(m[1])
    m = re.search(r"(\d+)\s*leds?\b", t)
    if m: o["led_count"] = int(m[1])
    return o

def _llm(prompt):
    key = os.getenv("GROQ_API_KEY")
    if not key: return None
    try:
        import httpx
        tool = {"type": "function", "function": {
            "name": "select_templates",
            "description": "Pick known-good circuit templates and parameter overrides for the request.",
            "parameters": {"type": "object", "properties": {
                "templates": {"type": "array", "items": {"type": "string", "enum": list(TEMPLATES)}},
                "params": {"type": "object", "properties": {"vin": {"type": "number"}, "vout": {"type": "number"}, "iload": {"type": "number", "description": "amps"},
                                                             "capacity_mah": {"type": "number"}, "led_count": {"type": "integer"}}},
                "rationale": {"type": "string"}}, "required": ["templates"]}}}
        r = httpx.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"), "max_tokens": 800,
                  "messages": [{"role": "user", "content": prompt}], "tools": [tool],
                  "tool_choice": {"type": "function", "function": {"name": "select_templates"}}},
            timeout=30)
        r.raise_for_status()
        calls = r.json()["choices"][0]["message"].get("tool_calls") or []
        return json.loads(calls[0]["function"]["arguments"]) if calls else None
    except Exception:
        return None

def design(prompt):
    pick = _llm(prompt); source = "groq"
    ids = [t for t in (pick or {}).get("templates", []) if t in TEMPLATES]
    over = {**extract(prompt), **{k: v for k, v in (pick or {}).get("params", {}).items() if v}}
    rationale = (pick or {}).get("rationale", "")
    if not ids:
        source = "keywords"; t = prompt.lower()
        ids = [k for k, v in TEMPLATES.items() if any(w in t for w in v["triggers"])]
    if not ids:
        raise ValueError("No matching template. Try describing a power supply, motor driver, LED strip, sensor chain, IoT node or battery charger.")
    comps, nets, seen = [], [], set()
    for tid in ids:
        tnets = copy.deepcopy(TEMPLATES[tid]["nets"])
        for c in copy.deepcopy(TEMPLATES[tid]["components"]):
            k = c["kind"]
            if k in ("linear_regulator", "switching_regulator"): c["params"].update({x: over[x] for x in ("vin", "vout", "iload") if x in over})
            if k == "charger" and "capacity_mah" in over: c["params"]["capacity_mah"] = over["capacity_mah"]
            if k == "led_driver" and "led_count" in over: c["params"]["led_count"] = over["led_count"]
            old = c["ref"]; n = 1
            while c["ref"] in seen: c["ref"] = f"{old}_{n}"; n += 1
            if c["ref"] != old:
                for net in tnets: net["nodes"] = [c["ref"] if x == old else x for x in net["nodes"]]
            seen.add(c["ref"]); comps.append(c)
        nets += tnets
    return {"name": prompt[:48], "components": comps, "nets": nets}, source, rationale or f"Matched templates: {', '.join(ids)}"

def _merge(ids):
    return {"components": [c for t in ids for c in copy.deepcopy(TEMPLATES[t]["components"])],
            "nets": [n for t in ids for n in copy.deepcopy(TEMPLATES[t]["nets"])]}

EXAMPLES = [
 {"name": "Bench supply (needs work)", "components": [
   C("U1", "linear_regulator", "7805", vin=12, vout=5, iload=1.0, decoupled=False),
   C("Q1", "mosfet", "IRF540N", vgs_required=4, gpio_v=3.3, load_inductive=True, flyback=False),
   C("R1", "divider", r1=10000, r2=10000, vin=5, load_current_a=0.005),
   C("D1", "led_driver", topology="resistor", led_count=8, total_current_a=0.16),
   C("B1", "i2c_bus", pullups=False), C("A1", "opamp", "UA741", role="comparator", hysteresis=False, decoupled=True),
   C("SW1", "switch_input", pull=False, debounce=False)],
  "nets": [{"name": "5V", "nodes": ["U1", "R1", "D1"]}]},
 {"name": "Sensor node (clean)", **_merge(("iot_node", "battery_charging", "sensor_chain"))},
]
