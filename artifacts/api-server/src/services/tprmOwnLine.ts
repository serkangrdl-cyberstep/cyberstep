const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Aylık özet satırı: skor değişimi iki tarama arasındaki farktır (tam ay karşılaştırması değildir). */
export function ownDomainLine(v: { supplierDomain: string; lastScanScore: number | null; prevScanScore: number | null; riskLevel: string | null }): string {
  const d = esc(v.supplierDomain);
  if (v.lastScanScore === null) return `<li>${d}: henüz skorlanmadı</li>`;
  const delta = v.prevScanScore !== null && v.prevScanScore !== v.lastScanScore
    ? ` (önceki taramaya göre ${v.lastScanScore - v.prevScanScore > 0 ? "+" : ""}${v.lastScanScore - v.prevScanScore})` : "";
  return `<li>${d}: ${v.lastScanScore}/100${v.riskLevel ? `, ${esc(v.riskLevel)} risk` : ""}${delta}</li>`;
}
