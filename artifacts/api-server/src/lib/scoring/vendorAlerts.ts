/**
 * Tedarikçi uyarı kuralları (saf fonksiyonlar).
 * Önceki ve yeni Skor v2 sonucunu karşılaştırıp müşteriye bildirilecek
 * değişiklikleri üretir. Eski (v1) skorla karşılaştırma yapılmaz.
 */

import type { ScoreV2Result, ScoreV2Risk } from "./scoreV2";

/** Bu kadar puanlık düşüş tek başına uyarı sebebidir. */
export const SCORE_DROP_THRESHOLD = 10;
/** Aynı tedarikçi için yeni kritik bulgu yoksa uyarılar arası asgari süre. */
export const ALERT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const RISK_RANK: Record<ScoreV2Risk, number> = { "Düşük": 0, "Orta": 1, "Yüksek": 2, "Kritik": 3 };

export type AlertReason =
  | { kind: "new_critical"; titles: string[] }
  | { kind: "risk_escalation"; from: ScoreV2Risk; to: ScoreV2Risk }
  | { kind: "score_drop"; from: number; to: number };

export interface VendorAlertDecision {
  reasons: AlertReason[];
  /** Soğuma süresini aşan, mutlaka gönderilmesi gereken bir sebep var mı (yeni kritik bulgu). */
  urgent: boolean;
}

export function detectVendorAlert(prev: ScoreV2Result | null, next: ScoreV2Result): VendorAlertDecision {
  if (!prev) return { reasons: [], urgent: false };
  const reasons: AlertReason[] = [];

  const prevCritical = new Set(prev.findings.filter(f => f.severity === "critical").map(f => f.title));
  const newCritical = next.findings.filter(f => f.severity === "critical" && !prevCritical.has(f.title)).map(f => f.title);
  if (newCritical.length > 0) reasons.push({ kind: "new_critical", titles: newCritical });

  if (RISK_RANK[next.risk] > RISK_RANK[prev.risk] && RISK_RANK[next.risk] >= RISK_RANK["Yüksek"]) {
    reasons.push({ kind: "risk_escalation", from: prev.risk, to: next.risk });
  }

  if (prev.score - next.score >= SCORE_DROP_THRESHOLD) {
    reasons.push({ kind: "score_drop", from: prev.score, to: next.score });
  }

  return { reasons, urgent: newCritical.length > 0 };
}

/** Soğuma süresi içinde son uyarı gönderildiyse ve acil değilse uyarıyı bastır. */
export function shouldSendAlert(decision: VendorAlertDecision, lastAlertAt: Date | null, now = Date.now()): boolean {
  if (decision.reasons.length === 0) return false;
  if (decision.urgent) return true;
  return !lastAlertAt || now - lastAlertAt.getTime() >= ALERT_COOLDOWN_MS;
}

export function describeReason(r: AlertReason): string {
  switch (r.kind) {
    case "new_critical": return `Yeni kritik bulgu: ${r.titles.join("; ")}`;
    case "risk_escalation": return `Risk seviyesi ${r.from} → ${r.to}`;
    case "score_drop": return `Skor ${r.from} → ${r.to} (−${r.from - r.to})`;
  }
}
