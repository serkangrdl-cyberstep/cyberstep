import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface ReferralEvent {
  id: number; referralCodeId: number; referrerCustomerId: number;
  referredEmail: string; status: string; createdAt: string;
  rewardedAt?: string; referralCode?: string; referrerName?: string;
}

interface ReferralCode {
  id: number; customerId: number; code: string; totalReferrals: number;
  successfulReferrals: number; pendingReferrals: number; totalRewardMonths: number;
  createdAt: string; customerName?: string; customerEmail?: string;
}

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function adminFetch(path: string) {
  const res = await fetch(`${BASE()}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Bekliyor",       cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  rewarded: { label: "Odullendi",      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  expired:  { label: "Suresi Doldu",   cls: "bg-muted text-muted-foreground" },
};

export default function Referrallar() {
  const { data: codes = [], isLoading: codesLoading } = useQuery<ReferralCode[]>({
    queryKey: ["digest-referral-codes"],
    queryFn: () => adminFetch("/api/admin/referrals/codes"),
    retry: false,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<ReferralEvent[]>({
    queryKey: ["digest-referral-events"],
    queryFn: () => adminFetch("/api/admin/referrals"),
    retry: false,
  });

  const totalReferrals = events.length;
  const rewarded = events.filter(e => e.status === "rewarded").length;
  const pending = events.filter(e => e.status === "pending").length;
  const convRate = totalReferrals > 0 ? Math.round((rewarded / totalReferrals) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Referral Programi</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Musteri referral kodlari ve davet gecmisi.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Toplam Davet", value: totalReferrals },
          { label: "Basarili", value: rewarded },
          { label: "Bekleyen", value: pending },
          { label: "Donus Orani", value: `%${convRate}` },
        ].map(s => (
          <div key={s.label} className="border border-border rounded-xl bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">
              {codesLoading || eventsLoading ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Referral Kodlari ({codes.length})
        </p>
        {codesLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz referral kodu yok.</p>
        ) : (
          <div className="space-y-2">
            {codes.map(code => (
              <div key={code.id} className="border border-border rounded-xl bg-card px-4 py-3 flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-mono text-sm font-semibold text-foreground">{code.code}</p>
                  {code.customerEmail && (
                    <p className="text-xs text-muted-foreground">{code.customerName ?? ""} — {code.customerEmail}</p>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Toplam: {code.totalReferrals}</span>
                  <span className="text-green-600 dark:text-green-400">Basarili: {code.successfulReferrals}</span>
                  <span>Bekleyen: {code.pendingReferrals}</span>
                  <span>Odül: {code.totalRewardMonths} ay</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Son Davetler ({events.length})
        </p>
        {eventsLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz davet yok.</p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 30).map(ev => {
              const st = STATUS_MAP[ev.status] ?? STATUS_MAP["expired"];
              return (
                <div key={ev.id} className="border border-border rounded-xl bg-card px-4 py-3 flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm text-foreground">{ev.referredEmail}</p>
                    {ev.referrerName && (
                      <p className="text-xs text-muted-foreground">
                        Davet eden: {ev.referrerName}
                        {ev.referralCode && <span className="ml-1 font-mono">({ev.referralCode})</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ev.createdAt), "d MMM yyyy", { locale: tr })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
