"""Component data. SEED values are illustrative samples - swap SeedProvider for a
live Octopart/Nexar client (same lookup() shape) to get real price/stock/lifecycle."""
SEED = {
 "7805": dict(cost=0.45, stock=250000, rohs=True, lifecycle="active", alt=["TPS5430", "LM2596"]),
 "AMS1117-3.3": dict(cost=0.12, stock=900000, rohs=True, lifecycle="active", alt=[]),
 "TPS5430": dict(cost=1.9, stock=40000, rohs=True, lifecycle="active", alt=[]),
 "LM2596": dict(cost=1.4, stock=60000, rohs=True, lifecycle="active", alt=[]),
 "LM358": dict(cost=0.2, stock=500000, rohs=True, lifecycle="active", alt=[]),
 "LM393": dict(cost=0.18, stock=500000, rohs=True, lifecycle="active", alt=[]),
 "UA741": dict(cost=0.35, stock=800, rohs=True, lifecycle="nrnd", alt=["LM358", "TL072"]),
 "IRF540N": dict(cost=1.1, stock=90000, rohs=True, lifecycle="active", alt=["IRLZ44N"]),
 "IRLZ44N": dict(cost=1.3, stock=70000, rohs=True, lifecycle="active", alt=[]),
 "MCP73831": dict(cost=0.7, stock=80000, rohs=True, lifecycle="active", alt=[]),
 "1N4007": dict(cost=0.03, stock=2000000, rohs=True, lifecycle="active", alt=[]),
}

def lookup(pn: str):
    return SEED.get((pn or "").upper())

def part_findings(circuit):
    out = []
    for c in circuit["components"]:
        d = lookup(c.get("part", ""))
        if not d:
            continue
        base = {"ref": c["ref"], "hard_flag": False, "confidence": 0.7, "severity": "flag",
                "replacement": ", ".join(d["alt"]) or None}
        if d["lifecycle"] != "active":
            out.append({**base, "block": "sustainability", "title": "Lifecycle risk",
                        "reason": f"{c['part']} is listed as {d['lifecycle'].upper()}; plan a replacement."})
        if not d["rohs"]:
            out.append({**base, "block": "sustainability", "title": "Not RoHS compliant",
                        "reason": f"{c['part']} is not RoHS compliant."})
        if d["stock"] < 1000:
            out.append({**base, "block": "availability", "title": "Low stock",
                        "reason": f"Only {d['stock']} units in stock across distributors."})
    return out

def bom_cost(circuit):
    return round(sum((lookup(c.get("part", "")) or {}).get("cost", 0) for c in circuit["components"]), 2)
