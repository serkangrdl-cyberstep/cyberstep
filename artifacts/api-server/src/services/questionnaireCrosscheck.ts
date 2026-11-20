/**
 * Tedarikçi beyanı ile dış tarama bulgularını karşılaştırır. Beyan skoru ve tarama skoru
 * BİRLEŞTİRİLMEZ; yalnızca taramayla doğrulanabilen sorularda çelişki işaretlenir.
 */

export interface CrosscheckAnswer { questionId: number; answer: string }
export interface CrosscheckScan {
  spfRecord?: string | null;
  dmarcRecord?: string | null;
  cveSummary?: Array<{ cveId?: string; cvssScore?: number }> | null;
  uncheckedSources?: string[] | null;
  /** Hudson Rock: çalışan hesabı sızıntı kaydı sayısı (null = ölçülemedi) */
  hudsonEmployees?: number | null;
  /** Beyan edilen alt hizmet sağlayıcı sayısı (null = bu anket sürümünde toplanmadı) */
  subprocessorCount?: number | null;
}
export interface Contradiction { questionId: number; beyan: string; bulgu: string }

const ANSWER_LABEL: Record<string, string> = { evet: "Evet", kismen: "Kısmen", hayir: "Hayır" };

export function crosscheckAnswers(answers: CrosscheckAnswer[], scan: CrosscheckScan): Contradiction[] {
  const out: Contradiction[] = [];
  const unchecked = new Set(scan.uncheckedSources ?? []);
  const byId = new Map(answers.map((a) => [a.questionId, a.answer]));

  // Soru 3: SPF/DKIM/DMARC uyguluyorum → SPF/DMARC tarama bulgusuyla çelişiyor mu? (DKIM seçici tahminine dayandığı için kullanılmaz)
  if (byId.get(3) === "evet" && !unchecked.has("email")) {
    const problems: string[] = [];
    const spf = (scan.spfRecord ?? "").toLowerCase();
    if (!spf) problems.push("SPF kaydı bulunamadı");
    else if (/(^|\s)\+all\b/.test(spf)) problems.push("SPF '+all' ile herkese izin veriyor");
    const dmarc = /(?:^|;)\s*p\s*=\s*(reject|quarantine|none)/i.exec(scan.dmarcRecord ?? "")?.[1]?.toLowerCase();
    if (!scan.dmarcRecord) problems.push("DMARC kaydı bulunamadı");
    else if (dmarc === "none") problems.push("DMARC yalnızca izleme modunda (p=none)");
    if (problems.length > 0) {
      out.push({ questionId: 3, beyan: `${ANSWER_LABEL.evet}`, bulgu: `Tarama: ${problems.join("; ")}.` });
    }
  }

  // Soru 14: çalınmış kimlik bilgilerini izliyorum → dış kayıtta çalışan sızıntısı var mı?
  if (byId.get(14) === "evet" && (scan.hudsonEmployees ?? 0) > 0) {
    out.push({ questionId: 14, beyan: ANSWER_LABEL.evet!, bulgu: `Tarama: ${scan.hudsonEmployees} çalışan hesabı için infostealer sızıntı kaydı bulundu.` });
  }

  // Soru 11: alt hizmet sağlayıcı listem var → ankette liste paylaşılmış mı?
  if (byId.get(11) === "evet" && scan.subprocessorCount === 0) {
    out.push({ questionId: 11, beyan: ANSWER_LABEL.evet!, bulgu: "Anket: Liste tutulduğu beyan edildi ancak alt hizmet sağlayıcı bilgisi paylaşılmadı." });
  }

  // Soru 4: zamanında güncelleme → doğrulanmış yüksek/kritik CVE var mı?
  if (byId.get(4) === "evet") {
    const high = (scan.cveSummary ?? []).filter((c) => (c.cvssScore ?? 0) >= 7 && c.cveId);
    if (high.length > 0) {
      const list = high.slice(0, 3).map((c) => `${c.cveId} (CVSS ${c.cvssScore})`).join(", ");
      out.push({ questionId: 4, beyan: ANSWER_LABEL.evet!, bulgu: `Tarama: güncellenmemiş bileşende bilinen zafiyet tespit edildi — ${list}.` });
    }
  }
  return out;
}
