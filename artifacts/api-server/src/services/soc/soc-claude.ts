/**
 * Claude wrapper with cost tracking + response caching for the SOC service.
 *
 * - Prepends an optional system prompt to the user prompt (the Replit AI client
 *   takes a single prompt string).
 * - Caches responses by a hash of (model + full prompt); cache hits are logged
 *   with cost 0 and `cached: true`.
 * - The fast tier prefers `claude-haiku-4-5`; if that model is unavailable the
 *   call falls back to `claude-sonnet-4-6` and records the model actually used.
 */

import { createHash } from "crypto";
import { getClaudeAiFn } from "../ai-client";
import { getModel, type ModelTask } from "@workspace/ai";
import { logger } from "../../lib/logger";
import { socCacheGet, socCacheSet, socCacheKey } from "./soc-cache";
import { estimateTokens, computeCost, logAIUsage } from "./soc-cost";

export const SOC_MODEL_FAST = "noc-triage";   // task name → claude-haiku-4-5
export const SOC_MODEL_DEEP = "noc-deep";      // task name → claude-sonnet-4-6

export interface CostInfo {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cached: boolean;
}

export interface CallOptions {
  systemPrompt?: string;
  customerId?: number | null;
  caseId?: number | null;
  useCase?: string;
  cache?: boolean; // default true
  cacheTtlSeconds?: number;
}

function hashPrompt(model: string, prompt: string): string {
  return createHash("sha256").update(`${model}\n${prompt}`).digest("hex").slice(0, 32);
}

/**
 * Call Claude with cost accounting. Returns [text, costInfo].
 * Throws only if BOTH the requested model and the Sonnet fallback fail.
 */
export async function callClaudeWithCost(
  prompt: string,
  model: string,
  opts: CallOptions = {},
): Promise<[string, CostInfo]> {
  const fullPrompt = opts.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt;
  const useCache = opts.cache !== false;
  const cacheKey = socCacheKey(["soc-ai", hashPrompt(model, fullPrompt)]);

  if (useCache) {
    const hit = socCacheGet(cacheKey);
    if (hit !== null) {
      const resolvedModel = getModel(model as ModelTask);
      const info: CostInfo = { model: resolvedModel, inputTokens: 0, outputTokens: 0, costUsd: 0, cached: true };
      await logAIUsage({
        customerId: opts.customerId, caseId: opts.caseId, model: resolvedModel,
        useCase: opts.useCase ?? "triage", inputTokens: 0, outputTokens: 0, costUsd: 0, cached: true,
      });
      return [hit, info];
    }
  }

  let usedTask = model;
  let text = "";
  try {
    text = await getClaudeAiFn(model)(fullPrompt);
  } catch (err) {
    if (model !== SOC_MODEL_DEEP) {
      logger.warn({ err, model }, "SOC AI model unavailable, falling back to noc-deep");
      usedTask = SOC_MODEL_DEEP;
      text = await getClaudeAiFn(SOC_MODEL_DEEP)(fullPrompt);
    } else {
      throw err;
    }
  }

  const resolvedModel = getModel(usedTask as ModelTask);
  const inputTokens = estimateTokens(fullPrompt);
  const outputTokens = estimateTokens(text);
  const costUsd = computeCost(resolvedModel, inputTokens, outputTokens);
  const info: CostInfo = { model: resolvedModel, inputTokens, outputTokens, costUsd, cached: false };

  if (useCache && text) socCacheSet(cacheKey, text, opts.cacheTtlSeconds);

  await logAIUsage({
    customerId: opts.customerId, caseId: opts.caseId, model: resolvedModel,
    useCase: opts.useCase ?? "triage", inputTokens, outputTokens, costUsd, cached: false,
  });

  return [text, info];
}

/** Extract the first JSON object from a (possibly fenced) Claude response. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}
