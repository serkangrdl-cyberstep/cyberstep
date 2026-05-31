import { useQuery } from "@tanstack/react-query";

interface BadgeEarned {
  earnedAt: string;
  sharedAt: string | null;
  badge: {
    id: number;
    slug: string;
    name: string;
    description: string;
    icon: string;
    isShareable: boolean;
  };
}

export function BadgesWidget() {
  const { data: earned } = useQuery<BadgeEarned[]>({
    queryKey: ["my-badges"],
    queryFn: () => fetch("/api/portal/badges/my", { credentials: "include" }).then(r => r.json()),
    staleTime: 1000 * 60 * 10,
  });

  if (!earned || earned.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 space-y-3">
      <p className="font-semibold text-white text-sm">Kazanılan Rozetler</p>
      <div className="flex flex-wrap gap-3">
        {earned.map(e => (
          <div
            key={e.badge.slug}
            title={e.badge.description ?? ""}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-700 bg-slate-900/60 min-w-[72px] text-center hover:border-primary/40 transition-colors cursor-default"
          >
            <span className="text-2xl">{e.badge.icon}</span>
            <span className="text-[10px] text-slate-300 leading-tight">{e.badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
