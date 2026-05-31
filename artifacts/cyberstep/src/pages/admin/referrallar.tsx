import { useQuery } from "@tanstack/react-query";
import { adminFetchJson } from "@/lib/admin-fetch";
import { Share2, Trophy, CheckCircle2, Clock, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending:  { label: "Bekliyor",   color: "text-yellow-400", icon: Clock },
  rewarded: { label: "Odullendi",  color: "text-emerald-400", icon: CheckCircle2 },
  expired:  { label: "Suresi Doldu", color: "text-slate-500", icon: XCircle },
};

export default function AdminReferrallarPage() {
  const { data: codes = [], isLoading: codesLoading } = useQuery<ReferralCode[]>({
    queryKey: ["admin-referral-codes"],
    queryFn: () => adminFetchJson<ReferralCode[]>("/api/admin/referrals/codes"),
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<ReferralEvent[]>({
    queryKey: ["admin-referral-events"],
    queryFn: () => adminFetchJson<ReferralEvent[]>("/api/admin/referrals"),
  });

  const totalReferrals = events.length;
  const rewarded = events.filter(e => e.status === "rewarded").length;
  const pending = events.filter(e => e.status === "pending").length;
  const convRate = totalReferrals > 0 ? Math.round((rewarded / totalReferrals) * 100) : 0;

  return (
    <AdminLayout title="Referral Programi" description="Musteri davet istatistikleri ve odulleri">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Davet", value: totalReferrals, color: "text-white" },
          { label: "Odullendi",    value: rewarded,        color: "text-emerald-400" },
          { label: "Bekliyor",     value: pending,         color: "text-yellow-400" },
          { label: "Donusum",      value: `%${convRate}`,  color: "text-blue-400" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leaderboard */}
      <Card className="bg-slate-900 border-slate-700 mb-4">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            En Cok Davet Eden Musteriler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {codesLoading ? <p className="text-slate-400 text-sm">Yukleniyor...</p> : (
            <div className="space-y-2">
              {codes
                .sort((a, b) => b.successfulReferrals - a.successfulReferrals)
                .slice(0, 10)
                .map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                    <span className={`text-sm font-bold w-6 shrink-0 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-500"}`}>
                      {i + 1}.
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-300 text-sm">{c.customerName ?? `Musteri #${c.customerId}`}</p>
                      <p className="text-xs text-slate-500">{c.code} — {c.customerEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-semibold text-sm">{c.successfulReferrals} basarili</p>
                      <p className="text-xs text-slate-500">{c.totalReferrals} toplam</p>
                    </div>
                  </div>
                ))}
              {codes.length === 0 && <p className="text-slate-400 text-sm">Henuz referral kodu olusturulmadi.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Son Referral Etkinlikleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? <p className="text-slate-400 text-sm">Yukleniyor...</p> : events.length === 0 ? (
            <p className="text-slate-400 text-sm">Henuz referral etkinligi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                    <th className="text-left pb-2">Davet Eden</th>
                    <th className="text-left pb-2">Davet Edilen</th>
                    <th className="text-left pb-2">Durum</th>
                    <th className="text-left pb-2">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 50).map(e => {
                    const statusCfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG["pending"]!;
                    const Icon = statusCfg.icon;
                    return (
                      <tr key={e.id} className="border-b border-slate-800 last:border-0">
                        <td className="py-2.5 pr-4 text-slate-300">{e.referrerName ?? `#${e.referrerCustomerId}`}</td>
                        <td className="py-2.5 pr-4 text-slate-400">{e.referredEmail}</td>
                        <td className={`py-2.5 pr-4 ${statusCfg.color} flex items-center gap-1`}>
                          <Icon className="h-3 w-3" />{statusCfg.label}
                        </td>
                        <td className="py-2.5 text-slate-500 text-xs">
                          {new Date(e.createdAt).toLocaleDateString("tr-TR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
