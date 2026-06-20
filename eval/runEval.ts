/**
 * runEval.ts — Golden set evaluator
 * Çalıştır: tsx eval/runEval.ts
 *
 * eval/golden/*.json dosyalarındaki her test case için:
 *   - getModel(task) === expectedModel
 *   - callModel request'inde cache_control varlığı/yokluğu beklentiye uyuyor
 */

import { anthropic } from "../lib/integrations-anthropic-ai/src/index.ts";
import { getModel } from "../lib/ai/src/modelConfig.ts";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Spy ──────────────────────────────────────────────────────────────────────
const capturedReqs: Record<string, unknown>[] = [];

type CreateParams = {
  model?: string;
  system?: unknown;
  messages?: unknown[];
  max_tokens?: number;
};

// @ts-ignore
anthropic.messages.create = async (params: CreateParams) => {
  capturedReqs.push(structuredClone(params) as Record<string, unknown>);
  return { content: [{ type: "text", text: "eval-mock" }] };
};

const { callModel } = await import("../lib/ai/src/modelRouter.ts");

// ── Golden loader ─────────────────────────────────────────────────────────────
const goldenDir = join(__dir, "golden");
const files = readdirSync(goldenDir).filter(f => f.endsWith(".json"));

type GoldenCase = {
  id: string;
  task: string;
  description: string;
  expectedModel: string;
  hasCacheControl: boolean;
  testSystem: string | null;
  testUser: string;
};

const cases: GoldenCase[] = files.flatMap(f =>
  JSON.parse(readFileSync(join(goldenDir, f), "utf8")) as GoldenCase[]
);

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures: string[] = [];

for (const tc of cases) {
  process.stdout.write(`  [${tc.id}] ${tc.description} … `);
  capturedReqs.length = 0;

  // getModel check
  const gotModel = getModel(tc.task as Parameters<typeof getModel>[0]);
  if (gotModel !== tc.expectedModel) {
    console.log(`FAIL`);
    failures.push(`${tc.id}: getModel returned "${gotModel}", expected "${tc.expectedModel}"`);
    failed++;
    continue;
  }

  // callModel request check
  await callModel({
    task: tc.task as Parameters<typeof getModel>[0],
    ...(tc.testSystem ? { system: tc.testSystem } : {}),
    messages: [{ role: "user", content: tc.testUser }],
    maxTokens: 100,
  });

  const req = capturedReqs[0] as CreateParams & {
    system?: Array<{ cache_control?: { type?: string } }>;
  };

  const gotCache = Array.isArray(req?.system) &&
    req.system[0]?.cache_control?.type === "ephemeral";

  if (gotCache !== tc.hasCacheControl) {
    console.log(`FAIL`);
    failures.push(`${tc.id}: cache_control=${gotCache}, expected ${tc.hasCacheControl}`);
    failed++;
    continue;
  }

  const gotNoSystemField = req?.system === undefined;
  if (!tc.hasCacheControl && !gotNoSystemField) {
    console.log(`FAIL`);
    failures.push(`${tc.id}: system field present but should be absent`);
    failed++;
    continue;
  }

  console.log(`PASS`);
  passed++;
}

// ── Özet ──────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(52)}`);
console.log(`Eval Sonucu: ${passed} PASS / ${failed} FAIL  (${cases.length} golden case)`);
if (failures.length > 0) {
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
console.log("─".repeat(52));
process.exit(failed > 0 ? 1 : 0);
