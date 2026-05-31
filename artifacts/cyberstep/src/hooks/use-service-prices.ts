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

export function formatPrice(amount: number, unit: string, free = "Ücretsiz"): string {
  if (amount === 0) return free;
  const formatted = new Intl.NumberFormat("tr-TR").format(amount);
  const unitStr = unit === "yıl" ? "/ yıl" : unit === "ay" ? "/ ay" : unit === "tarama" ? "/ tarama" : "tek seferlik";
  return `${formatted} TL ${unitStr}`;
}
