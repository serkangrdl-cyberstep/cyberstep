import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface Partner {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  categories: string[];
  tier: string;
  status: string;
  monthlyFee: number | null;
  subscriptionStatus: string | null;
  description: string | null;
  totalProjectsCompleted: number | null;
  createdAt: string;
}

export function usePartner() {
  return useQuery<Partner>({
    queryKey: ["partner-me"],
    queryFn: async () => {
      const res = await fetch("/api/partner-auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    retry: false,
  });
}

export function useRequirePartner() {
  const { data, isLoading, isError } = usePartner();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/ortak/giris");
    }
  }, [isLoading, isError, setLocation]);

  return { partner: data, isLoading };
}
