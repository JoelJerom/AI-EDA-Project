"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

const Ctx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const say = useCallback((m: string) => {
    setMsg(m); setShow(true); window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setShow(false), 1700);
  }, []);
  return (
    <Ctx.Provider value={say}>
      {children}
      <div className={"toast" + (show ? " show" : "")} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}
