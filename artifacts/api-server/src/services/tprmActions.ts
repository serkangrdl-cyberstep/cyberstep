import type { Interpretation } from "./tprmInterpretation";

/** Tedarikçiden istenebilecek aksiyon önerileri (saf fonksiyon; müşteri düzenleyip onaylar). */
export interface SuggestedAction { sourceKey: string; title: string; detail: string; dueDays: number }

export interface SuggestInput {
  spfRecord?: string | null;
  dmarcRecord?: string | null;
  cveSummary?: Array<{ cveId?: string; cvssScore?: number }> | null;
  hudsonEmployees?: number | null;
  /** Anket yapıldıysa; yoksa null */
  answers?: Array<{ questionId: number; answer: "evet" | "kismen" | "hayir" }> | null;
  interpretation?: Pick<Interpretation, "redFlags"> | null;
  contradictions?: Array<{ questionId: number; text: string; bulgu: string }> | null;
}

export function suggestActions(i: SuggestInput): SuggestedAction[] {
  const out: SuggestedAction[] = [];
  if (!i.spfRecord) out.push({ sourceKey: "spf", title: "SPF kaydı ekleyin", detail: "Alan adınız için SPF kaydı bulunamadı. E-posta gönderen sunucularınızı tanımlayan bir SPF kaydı yayınlayın.", dueDays: 30 });
  if (!i.dmarcRecord) out.push({ sourceKey: "dmarc", title: "DMARC kaydı ekleyin", detail: "DMARC kaydı bulunamadı. Önce izleme (p=none) ile başlayıp raporları inceleyerek quarantine/reject politikasına geçin.", dueDays: 30 });
  const high = (i.cveSummary ?? []).filter((c) => (c.cvssScore ?? 0) >= 7 && c.cveId);
  if (high.length) {
    const ids = high.slice(0, 5).map((c) => c.cveId).join(", ");
    out.push({ sourceKey: "cve", title: "Yüksek riskli güvenlik açıklarını kapatın", detail: `Dışarıdan görünen sistemlerde CVSS 7 ve üzeri açıklar tespit edildi (${ids}${high.length > 5 ? " ve diğerleri" : ""}). Yamalayın veya erişimi kısıtlayın, sonucu bildirin.`, dueDays: 14 });
  }
  if ((i.hudsonEmployees ?? 0) > 0) out.push({ sourceKey: "infostealer", title: "Sızan çalışan hesaplarını sıfırlayın", detail: "Çalışan hesapları için infostealer sızıntı kaydı bulundu. İlgili hesapların parolalarını sıfırlayın, oturumları sonlandırın ve MFA'yı zorunlu kılın.", dueDays: 14 });
  for (const f of i.interpretation?.redFlags ?? []) {
    out.push({ sourceKey: `rf-${f.questionId}`, title: "Kritik kontrol eksikliğini giderin", detail: `Anket beyanınıza göre şu kontrol yok: "${f.text}". Kontrolü devreye alın veya telafi edici önlemi yazılı olarak bildirin.`, dueDays: 14 });
  }
  for (const c of i.contradictions ?? []) {
    out.push({ sourceKey: `cx-${c.questionId}`, title: "Beyan ile bulgu arasındaki çelişkiyi açıklayın", detail: `"${c.text}" sorusundaki beyanınız taramayla çelişiyor. ${c.bulgu} Açıklama veya belge paylaşın.`, dueDays: 30 });
  }
  const iso = i.answers?.find((a) => a.questionId === 22);
  if (iso && iso.answer !== "evet") out.push({ sourceKey: "iso", title: "Geçerli bir bilgi güvenliği belgesi paylaşın", detail: "ISO 27001, SOC 2 veya eşdeğer bir belgeniz ve kapsamı hakkında bilgi paylaşın; yoksa edinme planınızı bildirin.", dueDays: 60 });
  return out;
}

export const ACTION_STATUSES = ["open", "supplier_done", "verified", "waived"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const DECISIONS = ["accept", "monitor", "exit"] as const;
export type Decision = (typeof DECISIONS)[number];

export function validateActionItems(raw: unknown, now = new Date()): Array<{ sourceKey: string; title: string; detail: string; dueDate: Date }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ sourceKey: string; title: string; detail: string; dueDate: Date }> = [];
  for (const r of raw.slice(0, 20)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = typeof o["title"] === "string" ? o["title"].trim().slice(0, 160) : "";
    if (!title) continue;
    const detail = typeof o["detail"] === "string" ? o["detail"].trim().slice(0, 800) : "";
    const sourceKey = typeof o["sourceKey"] === "string" && o["sourceKey"].trim() ? o["sourceKey"].trim().slice(0, 40) : "manual";
    const due = new Date(String(o["dueDate"] ?? ""));
    const dueDate = isNaN(due.getTime()) || due.getTime() < now.getTime() - 86_400_000 ? new Date(now.getTime() + 30 * 86_400_000) : due;
    out.push({ sourceKey, title, detail, dueDate });
  }
  return out;
}

export const isOverdue = (status: string, due: Date, now = new Date()) => (status === "open") && due.getTime() < now.getTime();
