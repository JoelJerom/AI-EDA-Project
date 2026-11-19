export type Finding = {
  ref: string; block: string; severity: "hard" | "suggest" | "flag" | "ok"; title: string; reason: string;
  confidence: number; replacement?: string | null;
  verification?: { method: string; expected: number; simulated: number | null; agrees: boolean };
};
export type Simp = { ref: string; title: string; reason: string; confidence: number; saves: number; replacement?: string | null };
export type Circuit = {
  name: string;
  components: { ref: string; kind: string; part?: string; params?: Record<string, any> }[];
  nets?: { name: string; nodes: string[] }[];
};
export type Analysis = {
  findings: Finding[]; simplifications: Simp[]; score: number; parts_before: number; parts_after: number; bom_cost: number;
};
export type Result = { circuit: Circuit; analysis: Analysis; note?: string };

const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem("ce_token"));

async function call<T>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Something went wrong. Check your input and try again.");
  return data as T;
}

export const api = {
  examples: () => call<Circuit[]>("/examples"),
  analyze: (circuit: Circuit) => call<Analysis>("/analyze", { circuit, verify: true }),
  design: (prompt: string) => call<Result>("/design", { prompt }),
  kicad: (netlist: string, vin?: number, iload?: number) => call<Result>("/kicad", { netlist, vin, iload }),
  report: (circuit: Circuit) => call<{ markdown: string }>("/report", { circuit, verify: true }),
  auth: (mode: "login" | "register", email: string, password: string) => call<{ token: string; email: string }>(`/auth/${mode}`, { email, password }),
  projects: () => call<{ id: number; name: string; circuit: Circuit }[]>("/projects"),
  save: (name: string, circuit: Circuit) => call<{ id: number }>("/projects", { name, circuit }),
  remove: (id: number) => call<{ deleted: number }>(`/projects/${id}`, undefined, "DELETE"),
};
