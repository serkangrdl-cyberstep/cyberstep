/**
 * Renders an email template by substituting {{variable}} placeholders.
 * All values are HTML-escaped for safety.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key];
    if (val == null) return `{{${key}}}`;
    return escapeHtml(String(val));
  });
}

export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/** Standard variables available for all tenant email templates */
export const STANDARD_VARIABLES: Record<string, string> = {
  companyName:    "Müşteri şirket adı",
  contactName:    "İletişim kişisi adı",
  dealId:         "Deal ID numarası",
  assessmentId:   "Değerlendirme ID",
  riskLevel:      "Risk seviyesi (Kritik / Yüksek / Orta / Düşük)",
  scorePercent:   "Yüzde puan",
  tenantName:     "Workspace / şirket adı",
  senderName:     "Gönderen adı",
  senderEmail:    "Gönderen e-posta",
  baseUrl:        "Site URL",
  date:           "Bugünün tarihi",
};
