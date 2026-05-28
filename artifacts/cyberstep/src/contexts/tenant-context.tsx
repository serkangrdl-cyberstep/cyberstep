import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  plan: string;
  isrEnabled: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  aiProvider: string;
  aiModel: string | null;
  aiApiKey: string | null;
  quoteTerms: string | null;
  quoteValidDays: number;
  quoteFooter: string | null;
  imapHost: string | null;
  imapUser: string | null;
  smtpHost: string | null;
  smtpUser: string | null;
  smtpPort: number;
  maxUsers: number;
  maxAssessments: number;
  isActive: boolean;
  role: string;
}

interface TenantContextValue {
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
  select: (tenantId: number) => Promise<void>;
  clear: () => void;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  loading: true,
  refresh: async () => {},
  select: async () => {},
  clear: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin-panel/tenants/current", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setTenant(data);
      } else {
        setTenant(null);
      }
    } catch {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const select = useCallback(async (tenantId: number) => {
    const r = await fetch("/api/admin-panel/tenants/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tenantId }),
    });
    if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Seçim başarısız"); }
    await refresh();
  }, [refresh]);

  const clear = useCallback(() => setTenant(null), []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <TenantContext.Provider value={{ tenant, loading, refresh, select, clear }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
