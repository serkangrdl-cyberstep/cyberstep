import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BadgeRow {
  achievement: { id: number; customerId: number; earnedAt: string; sharedAt: string | null };
  badge: { id: number; slug: string; name: string; description: string; icon: string };
}

export default function AdminRozetler() {
  const { data, isLoading } = useQuery<BadgeRow[]>({
    queryKey: ["admin-badges"],
    queryFn: () => fetch("/api/admin/badges", { credentials: "include" }).then(r => r.json()),
  });

  const byBadge = (data ?? []).reduce<Record<string, { badge: BadgeRow["badge"]; count: number }>>((acc, row) => {
    const key = row.badge.slug;
    if (!acc[key]) acc[key] = { badge: row.badge, count: 0 };
    acc[key]!.count++;
    return acc;
  }, {});

  return (
    <AdminLayout title="Rozet Yönetimi" description="Müşteri başarı rozetleri ve leaderboard">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-slate-800/40 border-slate-700">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-slate-400 mb-1">Toplam Kazanım</p>
              <p className="text-2xl font-bold text-white">{data?.length ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/40 border-slate-700">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-slate-400 mb-1">Rozet Çeşidi</p>
              <p className="text-2xl font-bold text-white">{Object.keys(byBadge).length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/40 border-slate-700">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-slate-400 mb-1">Paylaşılan</p>
              <p className="text-2xl font-bold text-white">{data?.filter(r => r.achievement.sharedAt).length ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/40 border-slate-700">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-slate-400 mb-1">Bu Hafta</p>
              <p className="text-2xl font-bold text-white">
                {data?.filter(r => {
                  const d = new Date(r.achievement.earnedAt);
                  const week = new Date(); week.setDate(week.getDate() - 7);
                  return d > week;
                }).length ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* By badge */}
        <Card className="bg-slate-800/40 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Rozet Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(byBadge).sort((a, b) => b.count - a.count).map(({ badge, count }) => (
                <div key={badge.slug} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/40">
                  <span className="text-2xl">{badge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{badge.name}</p>
                    <p className="text-xs text-slate-400">{badge.description}</p>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary/30 shrink-0">{count}x</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent earned */}
        <Card className="bg-slate-800/40 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Son Kazanımlar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-700/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(data ?? []).slice(0, 50).map(row => (
                  <div key={row.achievement.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{row.badge.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{row.badge.name}</p>
                        <p className="text-xs text-slate-400">Müşteri #{row.achievement.customerId}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(row.achievement.earnedAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
