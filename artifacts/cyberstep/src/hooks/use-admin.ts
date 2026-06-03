import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  departments: string[];
  isSuperadmin: boolean;
}

async function fetchMe(): Promise<AdminUser> {
  const r = await fetch("/api/admin-panel/auth/me", { credentials: "include" });
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
}

export function useAdmin() {
  return useQuery<AdminUser>({ queryKey: ["admin-me"], queryFn: fetchMe, retry: false });
}

export function useRequireAdmin() {
  const [, navigate] = useLocation();
  const query = useAdmin();
  useEffect(() => {
    if (query.isError) navigate("/panel/giris");
  }, [query.isError, navigate]);
  return query;
}
