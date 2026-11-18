def markdown(circuit, a):
    L = [f"# Circuit Engine report: {circuit['name']}", "",
         f"- Design score: **{a['score']}/100**", f"- Parts: {a['parts_before']} -> {a['parts_after']} after simplification",
         f"- Known BOM cost: ${a['bom_cost']}", "", "## Findings", ""]
    for f in a["findings"]:
        v = f.get("verification"); tag = f" - verified by {v['method']}" if v and v["agrees"] else ""
        L.append(f"- **{f['severity']}** `{f['ref']}` {f['title']} (confidence {f['confidence']}{tag}): {f['reason']}")
    L += ["", "## Simplification", ""] + [f"- `{s['ref']}` {s['title']}: {s['reason']} (saves {s['saves']} parts)" for s in a["simplifications"]]
    if not a["simplifications"]: L.append("- No simplification opportunities found.")
    sus = [f for f in a["findings"] if f["block"] in ("sustainability", "availability")]
    L += ["", "## Sustainability and availability", ""] + ([f"- `{f['ref']}` {f['title']}: {f['reason']}" for f in sus] or ["- No lifecycle, RoHS or stock issues found for known parts."])
    return "\n".join(L) + "\n"
