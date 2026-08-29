import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, setToken, clearToken } from "./api";

export interface OrgInfo { id: string; name: string; slug: string; role: "owner" | "admin" | "viewer"; }
export interface UserInfo { id: string; email: string; name: string; }

interface AuthCtx {
  user: UserInfo | null;
  orgs: OrgInfo[];
  currentOrg: OrgInfo | null;
  loading: boolean;
  setCurrentOrg: (org: OrgInfo) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("vizor-token");
    if (!token) { setLoading(false); return; }
    api<{ user: UserInfo; orgs: OrgInfo[] }>("GET", "/api/auth/me")
      .then((data) => {
        setUser(data.user);
        setOrgs(data.orgs);
        const savedOrgId = localStorage.getItem("vizor-org");
        const org = data.orgs.find((o) => o.id === savedOrgId) || data.orgs[0];
        if (org) setCurrentOrgState(org);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: UserInfo; token: string }>("POST", "/api/auth/login", { email, password });
    setToken(data.token);
    const me = await api<{ user: UserInfo; orgs: OrgInfo[] }>("GET", "/api/auth/me");
    setUser(me.user);
    setOrgs(me.orgs);
    if (me.orgs[0]) { setCurrentOrgState(me.orgs[0]); localStorage.setItem("vizor-org", me.orgs[0].id); }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api<{ user: UserInfo; token: string }>("POST", "/api/auth/register", { name, email, password });
    setToken(data.token);
    const me = await api<{ user: UserInfo; orgs: OrgInfo[] }>("GET", "/api/auth/me");
    setUser(me.user);
    setOrgs(me.orgs);
    if (me.orgs[0]) { setCurrentOrgState(me.orgs[0]); localStorage.setItem("vizor-org", me.orgs[0].id); }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("vizor-org");
    setUser(null);
    setOrgs([]);
    setCurrentOrgState(null);
  }, []);

  const setCurrentOrg = useCallback((org: OrgInfo) => {
    setCurrentOrgState(org);
    localStorage.setItem("vizor-org", org.id);
  }, []);

  return (
    <Ctx.Provider value={{ user, orgs, currentOrg, loading, setCurrentOrg, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
