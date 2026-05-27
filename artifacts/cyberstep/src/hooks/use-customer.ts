import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

export interface CustomerUser {
  id: number;
  email: string;
  fullName: string;
  companyName: string | null;
  totpEnabled: boolean;
  subscriptionPlan: string | null;
  subscriptionStatus: string;
  createdAt: string;
}

async function fetchCustomerMe(): Promise<CustomerUser> {
  const r = await fetch("/api/auth/me", { credentials: "include" });
  if (!r.ok) throw new Error("Unauthorized");
  return r.json();
}

export function useCustomer() {
  return useQuery<CustomerUser>({
    queryKey: ["customer-me"],
    queryFn: fetchCustomerMe,
    retry: false,
    staleTime: 60_000,
  });
}

export function useRequireCustomer() {
  const [, navigate] = useLocation();
  const query = useCustomer();
  useEffect(() => {
    if (query.isError) navigate("/giris");
  }, [query.isError, navigate]);
  return query;
}
