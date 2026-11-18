from app import design, engine, kicad

def c(kind, **p): return {"name": "t", "components": [{"ref": "X1", "kind": kind, "part": "", "params": p}], "nets": []}
def sev(circ, block): return [f["severity"] for f in engine.analyze(circ) if f["block"] == block]

def test_linear_high_drop_flags_switching():
    assert sev(c("linear_regulator", vin=12, vout=5, iload=1, decoupled=True), "linear_regulator") == ["suggest"]

def test_linear_small_drop_passes():
    assert sev(c("linear_regulator", vin=5, vout=3.3, iload=0.01, decoupled=True), "linear_regulator") == ["ok"]

def test_flyback_and_gate_drive_are_hard_flags():
    fs = engine.analyze(c("mosfet", vgs_required=4, gpio_v=3.3, load_inductive=True, flyback=False))
    assert [f["hard_flag"] for f in fs].count(True) == 2

def test_divider_as_supply_is_hard_flag_and_verified():
    out = engine.run(c("divider", r1=10000, r2=10000, vin=5, load_current_a=0.005))
    f = [x for x in out["findings"] if x["block"] == "divider"][0]
    assert f["hard_flag"] and f["verification"]["agrees"]

def test_missing_decoupling_and_i2c_pullups():
    assert sev(c("ic", decoupled=False), "decoupling") == ["hard"]
    assert sev(c("i2c_bus", pullups=False), "pull_network") == ["hard"]

def test_rc_cutoff_mismatch():
    assert sev(c("rc_filter", r=1000, c=1e-6, intended_hz=1000), "rc_filter") == ["flag"]

def test_simplify_switcher_at_low_load():
    assert engine.simplify(c("switching_regulator", vin=3.8, vout=3.3, iload=0.01))[0]["title"].startswith("Replace with a linear")

NET = '''(export (version D)(components
 (comp (ref U1)(value 7805)(libsource (lib Reg)(part L7805)))
 (comp (ref C1)(value 100n)(libsource (lib Device)(part C))))
 (nets (net (code 1)(name "+5V")(node (ref U1)(pin 3))(node (ref C1)(pin 1)))))'''

def test_kicad_import_and_analysis():
    circ = kicad.parse(NET)
    assert circ["components"][0]["kind"] == "linear_regulator" and circ["components"][0]["params"]["vout"] == 5
    out = engine.run(circ)
    assert not any(f["block"] == "decoupling" for f in out["findings"])
    assert any(f["severity"] == "suggest" for f in out["findings"])

def test_design_fallback_and_overrides():
    circ, source, _ = design.design("A 12V to 5V power supply at 1A")
    assert source in ("keywords", "groq") and circ["components"][0]["params"]["vin"] == 12
