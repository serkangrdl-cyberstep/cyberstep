/**
 * Merkezi model konfigürasyonu.
 * Her görev (task) için hangi modelin kullanılacağını tek yerden tanımlar.
 * Model değişiklikleri burada yapılır — çağrı yapan kodda model adı olmaz.
 *
 * stale: true → bilinçli teknik borç; bu görev eski pin kullanıyor, ayrı PR ile yükseltilmeli.
 */

export type ModelTask =
  // ── Faz A ────────────────────────────────────────────────────────────────
  | "cve-content"
  | "digest"
  | "board-report"
  | "lead-teaser"
  | "ai-client-claude"
  // ── Faz B ────────────────────────────────────────────────────────────────
  | "bulletin"
  | "news-enrich"
  | "ciso-board-report"
  | "policy-gen"
  | "intel-report"
  | "social-content"
  | "security-report"
  | "blog"
  | "pentest-lite"
  // ── Faz C ────────────────────────────────────────────────────────────────
  | "attack-scenarios"
  | "bas-lite"
  | "growth-engine"
  | "attack-path"
  | "observability"
  | "index-report"
  | "demo-report"
  | "ai-tools-report"
  | "ciso-weekly-digest"
  | "noc-triage"
  | "noc-deep"
  // ── Faz C (devam) ────────────────────────────────────────────────────────
  | "lead-scoring"
  | "market-watch"
  | "ioc-query"
  | "onboarding-email"
  | "teaser-report"
  // ── Faz C (compliance-sensitive) ─────────────────────────────────────────
  | "kvkk-assess"
  | "eu-aiact";

export interface ModelEntry {
  model: string;
  stale?: true;
}

export const MODEL_CONFIG: Record<ModelTask, ModelEntry> = {
  // ── Faz A ────────────────────────────────────────────────────────────────
  "cve-content":       { model: "claude-sonnet-4-6" },
  "digest":            { model: "claude-sonnet-4-6" },
  "board-report":      { model: "claude-sonnet-4-6" },
  "lead-teaser":       { model: "claude-haiku-4-5-20251001" },
  "ai-client-claude":  { model: "claude-sonnet-4-6" },
  // ── Faz B ────────────────────────────────────────────────────────────────
  "bulletin":          { model: "claude-sonnet-4-6" },
  "news-enrich":       { model: "claude-sonnet-4-6" },
  "ciso-board-report": { model: "claude-sonnet-4-6" },
  "policy-gen":        { model: "claude-haiku-4-5" },
  "intel-report":      { model: "claude-sonnet-4-6" },
  "social-content":    { model: "claude-haiku-4-5" },
  "security-report":   { model: "claude-haiku-4-5-20251001" },
  "blog":              { model: "claude-sonnet-4-6" },
  "pentest-lite":      { model: "claude-sonnet-4-6" },
  // ── Faz C ────────────────────────────────────────────────────────────────
  "attack-scenarios":  { model: "claude-haiku-4-5" },
  "bas-lite":          { model: "claude-sonnet-4-5", stale: true },   // STALE: ayrı PR ile 4-6'ya yükselt
  "growth-engine":     { model: "claude-sonnet-4-5", stale: true },   // STALE: ayrı PR ile 4-6'ya yükselt
  "attack-path":       { model: "claude-sonnet-4-5", stale: true },   // STALE: ayrı PR ile 4-6'ya yükselt
  "observability":     { model: "claude-haiku-4-5" },
  "index-report":      { model: "claude-sonnet-4-6" },
  "demo-report":       { model: "claude-sonnet-4-6" },
  "ai-tools-report":   { model: "claude-haiku-4-5" },
  "ciso-weekly-digest": { model: "claude-haiku-4-5" },
  "noc-triage":        { model: "claude-haiku-4-5" },
  "noc-deep":          { model: "claude-sonnet-4-6" },
  // ── Faz C (devam) ────────────────────────────────────────────────────────
  "lead-scoring":      { model: "claude-sonnet-4-6" },
  "market-watch":      { model: "claude-haiku-4-5" },
  "ioc-query":         { model: "claude-haiku-4-5" },
  "onboarding-email":  { model: "claude-haiku-4-5" },
  "teaser-report":     { model: "claude-sonnet-4-20250514", stale: true }, // STALE: dated pin, ayrı PR ile güncel versiyona yükselt
  // ── Faz C (compliance-sensitive) ─────────────────────────────────────────
  "kvkk-assess":       { model: "claude-sonnet-4-6" }, // KVKK 12. Madde & BTK bildirim — compliance-critical, sonnet zorunlu
  "eu-aiact":          { model: "claude-sonnet-4-6" }, // AB Yapay Zeka Yasası uyum raporu — compliance-critical, sonnet zorunlu
};

export function getModel(task: ModelTask): string {
  return MODEL_CONFIG[task].model;
}
