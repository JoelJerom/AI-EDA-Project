"use client";
import { useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => { setUser(localStorage.getItem("ce_user")); }, []);
  return {
    user,
    signIn: (token: string, email: string) => { localStorage.setItem("ce_token", token); localStorage.setItem("ce_user", email); setUser(email); },
    signOut: () => { localStorage.removeItem("ce_token"); localStorage.removeItem("ce_user"); setUser(null); },
  };
}
