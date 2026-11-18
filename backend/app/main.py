import os, time
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from . import design as dsg, engine, kicad, report, store

app = FastAPI(title="Circuit Engine")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def init():
    for _ in range(15):
        try: store.Base.metadata.create_all(store.engine); return
        except Exception: time.sleep(2)

class Comp(BaseModel): ref: str; kind: str; part: str = ""; params: dict = {}
class Net(BaseModel): name: str; nodes: list[str]
class Circuit(BaseModel): name: str = "Untitled"; components: list[Comp]; nets: list[Net] = []
class AnalyzeReq(BaseModel): circuit: Circuit; verify: bool = True
class DesignReq(BaseModel): prompt: str
class KicadReq(BaseModel): netlist: str; vin: float | None = None; iload: float | None = None
class Cred(BaseModel): email: str; password: str
class ProjectReq(BaseModel): name: str; circuit: Circuit

def user_id(authorization: str = Header(None)):
    try: return store.read_token((authorization or "").replace("Bearer ", ""))
    except Exception: raise HTTPException(401, "Sign in to use projects.")

@app.get("/health")
def health(): return {"ok": True}

@app.get("/api/examples")
def examples(): return dsg.EXAMPLES

@app.post("/api/analyze")
def analyze(r: AnalyzeReq): return engine.run(r.circuit.model_dump(), r.verify)

@app.post("/api/design")
def design(r: DesignReq):
    try: c, source, why = dsg.design(r.prompt)
    except ValueError as e: raise HTTPException(422, str(e))
    return {"circuit": c, "source": source, "note": why, "analysis": engine.run(c)}

@app.post("/api/kicad")
def import_kicad(r: KicadReq):
    try: c = kicad.parse(r.netlist, r.vin, r.iload)
    except Exception as e: raise HTTPException(422, f"Could not read this netlist: {e}")
    return {"circuit": c, "analysis": engine.run(c)}

@app.post("/api/report")
def make_report(r: AnalyzeReq):
    c = r.circuit.model_dump(); return {"markdown": report.markdown(c, engine.run(c, r.verify))}

@app.post("/api/auth/{mode}")
def auth(mode: str, c: Cred, db=Depends(store.get_db)):
    u = db.query(store.User).filter_by(email=c.email.lower()).first()
    if mode == "register":
        if u: raise HTTPException(409, "That email is already registered.")
        if len(c.password) < 8: raise HTTPException(422, "Use a password of at least 8 characters.")
        u = store.User(email=c.email.lower(), pw=store.hash_pw(c.password)); db.add(u); db.commit()
    elif mode != "login" or not u or not store.check_pw(c.password, u.pw):
        raise HTTPException(401, "Email or password is incorrect.")
    return {"token": store.make_token(u.id), "email": u.email}

@app.get("/api/projects")
def projects(uid=Depends(user_id), db=Depends(store.get_db)):
    return [{"id": p.id, "name": p.name, "circuit": p.circuit} for p in db.query(store.Project).filter_by(user_id=uid).order_by(store.Project.updated.desc())]

@app.post("/api/projects")
def save_project(r: ProjectReq, uid=Depends(user_id), db=Depends(store.get_db)):
    p = store.Project(user_id=uid, name=r.name, circuit=r.circuit.model_dump()); db.add(p); db.commit(); return {"id": p.id}

@app.delete("/api/projects/{pid}")
def delete_project(pid: int, uid=Depends(user_id), db=Depends(store.get_db)):
    p = db.query(store.Project).filter_by(id=pid, user_id=uid).first()
    if not p: raise HTTPException(404, "Project not found.")
    db.delete(p); db.commit(); return {"deleted": pid}
