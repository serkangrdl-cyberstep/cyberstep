/**
 * smoke-a.ts — Faz A smoke testleri
 * Çalıştır: tsx eval/smoke-a.ts
 *
 * Ne test eder:
 *   - MODEL_CONFIG doğruluğu (getModel dönüş değerleri)
 *   - callModel request construction (model adı, cache_control varlığı/yokluğu, max_tokens)
 *   - system prompt olan görevlerde cache_control:ephemeral ekleniyor mu
 *   - system prompt olmayan görevlerde cache_control HİÇ gönderilmiyor mu
 *
 * Gerçek API çağrısı yapılmaz — anthropic.messages.create spy ile intercept edilir.
 */

// 1) anthropic singleton'ı yakala — ÖNCE import et
import { anthropic } from "../lib/integrations-anthropic-ai/src/index.ts";

// 2) Spy kur: singleton'ın create metodunu patch et.
//    modelRouter.ts aynı modülü import ettiği için (ESM cache: resolved path aynı)
//    aynı instance'ı kullanır — patch görülür.
const capturedRequests: Record<string, unknown>[] = [];

type CreateParams = {
  model?: string;
  max_tokens?: number;
  messages?: unknown[];
  system?: unknown;
};

// @ts-ignore — intentional test spy
anthropic.messages.create = async (params: CreateParams) => {
  capturedRequests.push(structuredClone(params) as Record<string, unknown>);
  // Minimal valid response shape
  return { content: [{ type: "text", text: "smoke-mock-response" }] };
};

// 3) callModel ve getModel'i PATCH SONRASI import et
import { callModel } from "../lib/ai/src/modelRouter.ts";
import { getModel } from "../lib/ai/src/modelConfig.ts";

// ─── Test runner ───────────────────────────────────────────────────────────────
type Result = { name: string; pass: boolean; got?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, got?: string) {
  results.push({ name, pass: cond, got });
  console.log(`  ${cond ? "✓ PASS" : "✗ FAIL"}  ${name}${cond ? "" : `  (got: ${got ?? "undefined"})`}`);
}

// ─── [A0] MODEL_CONFIG / getModel doğrulama ───────────────────────────────────
console.log("\n[A0] MODEL_CONFIG — getModel() doğrulama");
check("getModel(digest)       = claude-sonnet-4-6",         getModel("digest")         === "claude-sonnet-4-6",          getModel("digest"));
check("getModel(board-report) = claude-sonnet-4-6",         getModel("board-report")   === "claude-sonnet-4-6",          getModel("board-report"));
check("getModel(lead-teaser)  = claude-haiku-4-5-20251001", getModel("lead-teaser")    === "claude-haiku-4-5-20251001",  getModel("lead-teaser"));
check("getModel(cve-content)  = claude-sonnet-4-6",         getModel("cve-content")    === "claude-sonnet-4-6",          getModel("cve-content"));
check("getModel(ai-client-claude) = claude-sonnet-4-6",     getModel("ai-client-claude") === "claude-sonnet-4-6",        getModel("ai-client-claude"));

// ─── [smoke-A1] digest — system prompt VARsa cache_control:ephemeral ─────────
console.log("\n[smoke-A1] digest — cache_control:ephemeral bekleniyor");
capturedRequests.length = 0;

await callModel({
  task: "digest",
  system: "Sen bir Türk siber güvenlik uzmanısın.",
  messages: [{ role: "user", content: "Bu hafta kritik haberleri özetle." }],
  maxTokens: 100,
});

const a1 = capturedRequests[0] as CreateParams & { system?: Array<{ type?: string; text?: string; cache_control?: { type?: string } }> };
console.log("  request body:", JSON.stringify(a1, null, 2));

check("a1 model=claude-sonnet-4-6",             a1?.model === "claude-sonnet-4-6",         a1?.model);
check("a1 system is array",                     Array.isArray(a1?.system),                 JSON.stringify(a1?.system));
check("a1 system[0].type=text",                 a1?.system?.[0]?.type === "text",          a1?.system?.[0]?.type);
check("a1 system[0].cache_control.type=ephemeral",
  a1?.system?.[0]?.cache_control?.type === "ephemeral",
  JSON.stringify(a1?.system?.[0]?.cache_control));
check("a1 max_tokens=100",                      a1?.max_tokens === 100,                    String(a1?.max_tokens));
check("a1 messages[0].role=user",               (a1?.messages as Array<{role?: string}>)?.[0]?.role === "user", "ok");

// ─── [smoke-A2] board-report — system prompt VARsa cache_control:ephemeral ───
console.log("\n[smoke-A2] board-report — cache_control:ephemeral bekleniyor");
capturedRequests.length = 0;

await callModel({
  task: "board-report",
  system: "Sen kurumsal bir siber güvenlik danışmanısın. Yalnızca JSON dön.",
  messages: [{ role: "user", content: '{"company":"TestCo","score":68}' }],
  maxTokens: 200,
});

const a2 = capturedRequests[0] as CreateParams & { system?: Array<{ cache_control?: { type?: string } }> };
console.log("  request body:", JSON.stringify(a2, null, 2));

check("a2 model=claude-sonnet-4-6",             a2?.model === "claude-sonnet-4-6",         a2?.model);
check("a2 system[0].cache_control.type=ephemeral",
  a2?.system?.[0]?.cache_control?.type === "ephemeral",
  JSON.stringify(a2?.system?.[0]?.cache_control));
check("a2 max_tokens=200",                      a2?.max_tokens === 200,                    String(a2?.max_tokens));

// ─── [smoke-A3] lead-teaser — system YOKsa cache_control OLMAMALI ─────────────
console.log("\n[smoke-A3] lead-teaser — system field OLMAMALI (cache_control yok)");
capturedRequests.length = 0;

await callModel({
  task: "lead-teaser",
  messages: [{ role: "user", content: "Domain: acme.com.tr. Bulgu: SSL sertifikası süresi dolmuş." }],
  maxTokens: 150,
});

const a3 = capturedRequests[0] as CreateParams;
console.log("  request body:", JSON.stringify(a3, null, 2));

check("a3 model=claude-haiku-4-5-20251001",     a3?.model === "claude-haiku-4-5-20251001", a3?.model);
check("a3 system field absent",                 a3?.system === undefined,                  JSON.stringify(a3?.system));
check("a3 max_tokens=150",                      a3?.max_tokens === 150,                    String(a3?.max_tokens));

// ─── Özet ──────────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n${"─".repeat(52)}`);
console.log(`Smoke-A Sonucu: ${passed} PASS / ${failed} FAIL`);
if (failed > 0) {
  console.log("BAŞARISIZ testler:");
  results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}`));
  console.log("─".repeat(52));
  process.exit(1);
}
console.log("─".repeat(52));
