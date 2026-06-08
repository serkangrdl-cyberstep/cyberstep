import { useQuery } from "@tanstack/react-query";

export interface ServicePriceMap {
  [slug: string]: { label: string; amount: number; unit: string };
}

export function useServicePrices() {
  return useQuery<ServicePriceMap>({
    queryKey: ["service-prices"],
    queryFn: () => fetch("/api/public/prices").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}

export function formatPrice(amount: number, unit: string, free = "Ücretsiz", lang?: string): string {
  if (amount === 0) return lang === "en" ? "Free" : free;
  const formatted = new Intl.NumberFormat("tr-TR").format(amount);
  if (lang === "en") {
    const unitStr = unit === "yıl" ? "/ yr" : unit === "ay" ? "/ mo" : unit === "tarama" ? "/ scan" : "one-time";
    return `${formatted} TL ${unitStr}`;
  }
  const unitStr = unit === "yıl" ? "/ yıl" : unit === "ay" ? "/ ay" : unit === "tarama" ? "/ tarama" : "tek seferlik";
  return `${formatted} TL ${unitStr}`;
}
