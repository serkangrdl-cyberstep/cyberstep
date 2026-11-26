/** TPRM satış hattı aşamaları. Eski teaser akışının durumları (scanning/scanned/teaser_sent/viewed/interested) ilgili aşamaya eşlenir. */
export const STAGES = [
  { id: "new", label: "Yeni", bg: "bg-blue-900/30", border: "border-blue-700/50", chip: "bg-blue-100 text-blue-700" },
  { id: "contacted", label: "Arandı", bg: "bg-indigo-900/30", border: "border-indigo-700/50", chip: "bg-indigo-100 text-indigo-700" },
  { id: "pilot", label: "Pilot görüşmesi", bg: "bg-orange-900/30", border: "border-orange-700/50", chip: "bg-orange-100 text-orange-700" },
  { id: "proposal", label: "Teklif", bg: "bg-purple-900/30", border: "border-purple-700/50", chip: "bg-purple-100 text-purple-700" },
  { id: "contract", label: "Sözleşme", bg: "bg-cyan-900/30", border: "border-cyan-700/50", chip: "bg-cyan-100 text-cyan-700" },
  { id: "won", label: "Kazanıldı", bg: "bg-green-900/30", border: "border-green-700/50", chip: "bg-green-100 text-green-700" },
  { id: "lost", label: "Kaybedildi", bg: "bg-red-900/30", border: "border-red-700/50", chip: "bg-red-100 text-red-700" },
] as const;

const LEGACY: Record<string, string> = { scanning: "new", scanned: "new", teaser_sent: "contacted", viewed: "contacted", interested: "pilot" };

export function stageOf(status: string | null | undefined): string {
  const s = status ?? "new";
  if (STAGES.some(x => x.id === s)) return s;
  return LEGACY[s] ?? "new";
}

export const SOURCE_LABELS: Record<string, string> = { manual: "Elle", kvkk_lead: "KVKK Lead", lead_discovery: "Domain keşfi" };
