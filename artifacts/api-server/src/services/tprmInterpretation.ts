import { TPRM_QUESTIONS } from "./tprmQuestions";

export type Answer = "evet" | "kismen" | "hayir";
export type Band = "guclu" | "orta" | "zayif";

/** Bu sorulardan birine "Hayır" denmesi, toplam puandan bağımsız kırmızı bayraktır. */
export const CRITICAL_QUESTION_IDS = [2, 12, 6, 5, 19] as const;

const PTS = { evet: 10, kismen: 5, hayir: 0 } as const;

export function bandOf(score: number): Band {
  return score >= 80 ? "guclu" : score >= 60 ? "orta" : "zayif";
}
export const BAND_LABEL: Record<Band, string> = { guclu: "Güçlü", orta: "Orta", zayif: "Zayıf" };

export interface CategoryScore { category: string; score: number; band: Band; answered: number }
export interface Interpretation {
  band: Band; bandLabel: string;
  categories: CategoryScore[];
  redFlags: Array<{ questionId: number; text: string }>;
  /** Tarama skoru yoksa null */
  scanBand: "iyi" | "orta" | "zayif" | null;
  guidance: string;
}

function scanBandOf(scan: number | null | undefined): Interpretation["scanBand"] {
  if (scan == null) return null;
  return scan >= 70 ? "iyi" : scan >= 55 ? "orta" : "zayif";
}

export function guidanceFor(band: Band, scanBand: Interpretation["scanBand"], hasRedFlag: boolean, hasContradiction: boolean): string {
  const parts: string[] = [];
  if (band === "guclu") {
    parts.push(scanBand === "zayif" || scanBand === "orta"
      ? "Beyan güçlü ama dış tarama aynı seviyede değil: tarama bulgularını tedarikçiyle paylaşıp düzeltme isteyin ve ISO/sızma testi gibi kanıt belgesi talep edin."
      : "Beyan ve tarama büyük ölçüde tutarlı: yıllık yeniden değerlendirme yeterlidir.");
  } else if (band === "orta") {
    parts.push("Zayıf kalan kategoriler için tedarikçiden yazılı düzeltme planı isteyin ve 90 gün içinde anketi yenileyin.");
  } else {
    parts.push("Beyan zayıf: kritik bir tedarikçiyse sözleşmeye güvenlik şartı ekleyin, kanıt belgesi zorunlu tutun ve alternatif tedarikçi planı hazırlayın.");
  }
  if (hasRedFlag) parts.push("Kırmızı bayraklı konular toplam puandan bağımsız olarak kapanana kadar açık risk sayılmalıdır.");
  if (hasContradiction) parts.push("Taramayla çelişen beyanlar var: bu beyanlar belge veya görüşmeyle doğrulanmadan güvenilmemelidir.");
  parts.push("Beyan puanı doğrulanmamıştır; tarama skoruna eklenmez.");
  return parts.join(" ");
}

export function interpret(
  answers: Array<{ questionId: number; answer: Answer }>,
  selfScore: number,
  opts: { scanScore?: number | null; contradictionCount?: number } = {},
): Interpretation {
  const cat = new Map<string, string>(TPRM_QUESTIONS.map((q) => [q.id, q.category] as [number, string]).map(([id, c]) => [String(id), c]));
  const text = new Map<number, string>(TPRM_QUESTIONS.map((q) => [q.id, q.text]));
  const agg = new Map<string, { sum: number; n: number }>();
  for (const a of answers) {
    const c = cat.get(String(a.questionId));
    if (!c) continue;
    const cur = agg.get(c) ?? { sum: 0, n: 0 };
    cur.sum += PTS[a.answer]; cur.n += 1;
    agg.set(c, cur);
  }
  const categories = [...agg.entries()].map(([category, v]) => {
    const score = Math.round((v.sum * 100) / (v.n * 10));
    return { category, score, band: bandOf(score), answered: v.n };
  });
  const redFlags = answers
    .filter((a) => a.answer === "hayir" && (CRITICAL_QUESTION_IDS as readonly number[]).includes(a.questionId))
    .map((a) => ({ questionId: a.questionId, text: text.get(a.questionId) ?? "" }));
  const band = bandOf(selfScore);
  const scanBand = scanBandOf(opts.scanScore);
  return { band, bandLabel: BAND_LABEL[band], categories, redFlags, scanBand, guidance: guidanceFor(band, scanBand, redFlags.length > 0, (opts.contradictionCount ?? 0) > 0) };
}
