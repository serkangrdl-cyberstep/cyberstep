import { useQuery } from "@tanstack/react-query";

interface AdminMe {
  id: number;
  email: string;
  departments: string[];
  isSuperadmin: boolean;
}

async function fetchAdminMe(): Promise<AdminMe> {
  // Absolute path — proxy routes /digest/* to frontend, /api/* to API server
  const r = await fetch("/api/admin-panel/auth/me", { credentials: "include" });
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
}

export function useDigestAuth() {
  return useQuery<AdminMe>({
    queryKey: ["digest-admin-me"],
    queryFn: fetchAdminMe,
    retry: false,
    staleTime: 60_000,
  });
}

export function hasDigestAccess(me: AdminMe | undefined): boolean {
  if (!me) return false;
  if (me.isSuperadmin) return true;
  return me.departments.includes("digest");
}
