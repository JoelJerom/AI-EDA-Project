"use client";
import Link from "next/link";
import Brand from "./Brand";
import { useAuth } from "../lib/useAuth";
import { useToast } from "./Toast";

export const PersonIcon = ({ s = 23 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="7" r="4" /><path d="M4.5 21c.4-5 3.1-7.3 7.5-7.3s7.1 2.3 7.5 7.3" />
  </svg>
);

export default function SiteHeader({ active }: { active: "workbench" | "login" }) {
  const { user, signOut } = useAuth();
  const say = useToast();
  return (
    <header className="site-head">
      <Link href="/" className="brand" aria-label="Circuit Engine home"><Brand /></Link>
      <nav className="nav" aria-label="Main">
        <Link href="/">Home page</Link>
        <Link href="/workbench" className={active === "workbench" ? "active" : ""}>Workbench</Link>
        <a href="#rulebook" onClick={(e) => { e.preventDefault(); say("Rulebook v1.0 · 13 building blocks"); }}>Rulebook</a>
        {user ? <a href="#out" onClick={(e) => { e.preventDefault(); signOut(); say("Signed out"); }}>Sign out</a>
              : <Link href="/login" className={active === "login" ? "active" : ""}>Sign in</Link>}
      </nav>
      <Link className="join" href={user ? "/workbench" : "/login"}>
        <span className="join-icon"><PersonIcon /></span>
        <span className="join-label">{user ?? "Join us"}</span>
      </Link>
    </header>
  );
}
