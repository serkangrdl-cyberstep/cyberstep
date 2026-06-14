export function getIsrEmail(assignedTo?: string | null): string {
  const map: Record<string, string> = {
    "isr-team": process.env["ISR_TEAM_EMAIL"] ?? "isr@cyberstep.io",
    "serkan":   process.env["ISR_SERKAN_EMAIL"] ?? "serkan@cyberstep.io",
  };
  return map[assignedTo ?? "isr-team"] ?? (process.env["ISR_TEAM_EMAIL"] ?? "isr@cyberstep.io");
}

export function getIsrBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) { const f = domains.split(",")[0]?.trim(); if (f) return `https://${f}`; }
  return "http://localhost:80";
}
