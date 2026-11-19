"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import SpotlightHero from "../../components/SpotlightHero";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

type Mode = "login" | "register";

export default function Login() {
  const router = useRouter(), say = useToast(), { user, signIn, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({}), [apiErr, setApiErr] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address, like name@company.com.";
    if (pw.length < 8) e.pw = "Use at least 8 characters.";
    if (mode === "register" && pw2 !== pw) e.pw2 = "The passwords don't match.";
    setErrs(e); return Object.keys(e).length === 0;
  };
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setApiErr("");
    if (!validate()) return;
    setBusy(true);
    try {
      const r = await api.auth(mode, email.trim(), pw);
      signIn(r.token, r.email); say(mode === "login" ? "Welcome back" : "Account created"); router.push("/workbench");
    } catch (err: any) { setApiErr(err.message); } finally { setBusy(false); }
  };
  const field = (id: string, label: string, el: React.ReactNode) => (
    <div className="field"><label htmlFor={id}>{label}</label>{el}{errs[id] && <p className="error" id={id + "-e"}>{errs[id]}</p>}</div>
  );

  return (
    <div className="page bg">
      <SiteHeader active="login" />
      <main className="auth">
        <section className="auth-art" aria-hidden="true">
          <h1>Review every circuit before it ships.</h1>
          <p>Move your cursor over the board to see what the engine finds.</p>
          <SpotlightHero />
        </section>
        <section className="auth-card glass" aria-labelledby="auth-title">
          {user ? (<>
            <h2 id="auth-title">You're signed in</h2>
            <p className="muted">Signed in as {user}.</p>
            <div className="row"><Link className="btn primary" href="/workbench">Open workbench</Link><button className="btn" onClick={() => { signOut(); say("Signed out"); }}>Sign out</button></div>
          </>) : (<>
            <div className="tabs" role="tablist" aria-label="Account">
              {(["login", "register"] as Mode[]).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setErrs({}); setApiErr(""); }}>
                  {m === "login" ? "Sign in" : "Create account"}</button>))}
            </div>
            <h2 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">{mode === "login" ? "Sign in to save projects and pick up where you left off." : "Save circuits, reopen them anytime, and export reports."}</p>
            <form onSubmit={submit} noValidate>
              {field("email", "Email", <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email} aria-describedby={errs.email ? "email-e" : undefined} />)}
              {field("pw", "Password", (
                <div className="pw"><input id="pw" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!errs.pw} aria-describedby={errs.pw ? "pw-e" : undefined} />
                  <button type="button" className="link" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button></div>))}
              {mode === "register" && field("pw2", "Confirm password", <input id="pw2" type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={!!errs.pw2} aria-describedby={errs.pw2 ? "pw2-e" : undefined} />)}
              {apiErr && <p className="error" role="alert">{apiErr}</p>}
              <button className="btn primary wide" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
            </form>
            <p className="muted small">Just looking? <Link href="/workbench">Continue without an account</Link>. Saving projects needs one.</p>
          </>)}
        </section>
      </main>
    </div>
  );
}
