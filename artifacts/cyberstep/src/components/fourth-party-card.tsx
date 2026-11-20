import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";

interface Row { provider: string; category: string; vendorCount: number; share: number; vendors: string[]; high: boolean }
interface Resp { totalVendors: number; analyzedVendors: number; concentration: Row[] }

/** Portföy genelinde dördüncü taraf yoğunlaşması: tedarikçilerinizin ortak bağlı olduğu hizmet sağlayıcılar. */
export function FourthPartyCard() {
  const { data } = useQuery<Resp>({
    queryKey: ["tprm-fourth-parties"],
    queryFn: () => fetch("/api/tprm/fourth-parties", { credentials: "include" }).then((r) => (r.ok ? r.json() : { totalVendors: 0, analyzedVendors: 0, concentration: [] })),
  });
  const shared = (data?.concentration ?? []).filter((c) => c.vendorCount >= 2).slice(0, 8);
  if (!data || data.analyzedVendors === 0 || shared.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Dördüncü taraf yoğunlaşması</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {data.analyzedVendors}/{data.totalVendors} tedarikçinin dışarıdan görülebilen hizmet sağlayıcıları (e-posta, DNS, bulut/CDN, web). Bu liste tam değildir; veri paylaşılan alt hizmet sağlayıcılar tedarikçi anketiyle sorulur.
      </p>
      <ul className="divide-y text-sm">
        {shared.map((c) => (
          <li key={c.provider + c.category} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <span><strong>{c.provider}</strong> <span className="text-xs text-muted-foreground">· {c.category}</span></span>
              <span className={`text-xs font-medium ${c.high ? "text-red-600" : "text-muted-foreground"}`}>
                {c.vendorCount} tedarikçi (%{Math.round(c.share * 100)}){c.high ? " · yoğunlaşma" : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{c.vendors.slice(0, 6).join(", ")}{c.vendors.length > 6 ? ` +${c.vendors.length - 6}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
