"""Minimal KiCad netlist (.net, S-expression) importer -> Circuit graph."""
import re

def sexp(text):
    stack = [[]]
    for t in re.findall(r'\(|\)|"(?:[^"\\]|\\.)*"|[^\s()]+', text):
        if t == "(": stack.append([])
        elif t == ")":
            if len(stack) < 2: raise ValueError("Unbalanced parentheses in netlist")
            x = stack.pop(); stack[-1].append(x)
        else: stack[-1].append(t.strip('"'))
    if len(stack) != 1 or not stack[0]: raise ValueError("Not a KiCad netlist")
    return stack[0][0]

def find(n, key): return [c for c in n if isinstance(c, list) and c and c[0] == key]
def val(n, key, d=""):
    f = find(n, key); return f[0][1] if f and len(f[0]) > 1 else d

MULT = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "m": 1e-3, "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9, "R": 1}
def si(s):
    m = re.match(r"^(\d+)([pnuµmkKMGR])(\d+)$", s)
    if m: return float(f"{m[1]}.{m[3]}") * MULT[m[2]]
    m = re.match(r"^([\d.]+)\s*([pnuµmkKMGR]?)", s)
    return float(m[1]) * MULT.get(m[2], 1) if m else 0.0

def classify(ref, value, part):
    key = f"{value} {part}".upper(); pre = re.match(r"[A-Z]+", ref); pre = pre.group() if pre else "?"
    if pre == "R": return "resistor", {"r": si(value)}
    if pre == "C": return "capacitor", {"c": si(value)}
    if pre == "L": return "inductor", {}
    if pre == "D": return ("zener" if re.search(r"ZENER|BZX|1N47", key) else "diode"), {}
    if pre == "Q": return ("mosfet" if re.search(r"FET|IRF|IRL", key) else "transistor"), {}
    if pre in ("SW", "S"): return "switch_input", {}
    if pre in ("J", "P", "CN"): return "connector", {}
    if pre in ("U", "IC"):
        if re.search(r"LM2596|TPS54|TPS62|MP1584|LM2675|BUCK", key): return "switching_regulator", {"vin": 12, "vout": 5, "iload": 0.5, "inferred": True}
        if re.search(r"LM393|LM311|TLV3", key): return "opamp", {"role": "comparator"}
        if re.search(r"LM358|TL07|MCP60|OPA|TLV9", key): return "opamp", {"role": "buffer"}
        if re.search(r"MCP73|TP4056|BQ2", key): return "charger", {"capacity_mah": 1000, "topology": "linear", "inferred": True}
        m = re.search(r"78(\d\d)", key); v = re.search(r"(\d\.\d)", key)
        if m or re.search(r"1117|LM317|AP2112|MCP1700|LDO", key):
            return "linear_regulator", {"vin": 12, "vout": float(m[1]) if m else float(v[1]) if v else 5.0, "iload": 0.5, "inferred": True}
        return "ic", {}
    return "other", {}

def parse(text, vin=None, iload=None):
    root = sexp(text); comps = []
    for c in find((find(root, "components") or [[]])[0], "comp"):
        ref = val(c, "ref"); ls = find(c, "libsource"); part = val(ls[0], "part") if ls else ""
        kind, params = classify(ref, val(c, "value"), part)
        if kind in ("linear_regulator", "switching_regulator"):
            if vin: params["vin"] = vin
            if iload: params["iload"] = iload
            if vin and iload: params.pop("inferred", None)
        comps.append({"ref": ref, "kind": kind, "part": "" if kind in ("resistor", "capacitor") else val(c, "value"), "params": params})
    nets = [{"name": val(n, "name"), "nodes": sorted({val(x, "ref") for x in find(n, "node")})}
            for n in find((find(root, "nets") or [[]])[0], "net")]
    if not comps: raise ValueError("No components found in netlist")
    d = find(root, "design")
    return {"name": val(d[0], "source", "KiCad import") if d else "KiCad import", "components": comps, "nets": nets}
