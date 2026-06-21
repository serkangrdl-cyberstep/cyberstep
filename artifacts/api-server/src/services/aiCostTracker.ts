/**
 * Merkezi AI Maliyet Takip Servisi
 * Tüm Claude ve Gemini çağrılarının maliyetini tek tabloda toplar.
 */
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":          { input: 3.0,   output: 15.0  },
  "claude-haiku-4-5":           { input: 0.8,   output: 4.0   },
  "claude-haiku-4-5-20251001":  { input: 0.8,   output: 4.0   },
  "claude-opus-4-6":            { input: 15.0,  output: 75.0  },
  "gemini-2.0-flash":           { input: 0.075, output: 0.30  },
  "gemini-1.5-pro":             { input: 1.25,  output: 5.0   },
};

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function logAiCost(params: {
  task?: string;
  service: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheType?: "none" | "anthropic_prompt" | "soc_memory";
  customerId?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const costUsd = calcCost(params.model, params.inputTokens, params.outputTokens);
  try {
    await pool.query(
      `INSERT INTO ai_cost_log
         (task, service, model, input_tokens, output_tokens, cost_usd, cache_type, customer_id, metadata, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        params.task ?? null,
        params.service,
        params.model,
        params.inputTokens,
        params.outputTokens,
        costUsd,
        params.cacheType ?? "none",
        params.customerId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
  } catch (err) {
    logger.warn({ err, params }, "AI cost log: insert failed (non-critical)");
  }
}

export async function getDailyCost(date?: string): Promise<number> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_cost_log WHERE recorded_at::date = $1`,
      [d],
    );
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function getMonthlyCostByService(year: number, month: number): Promise<Array<{
  service: string;
  total_cost: number;
  total_calls: number;
  avg_cost: number;
}>> {
  try {
    const { rows } = await pool.query(
      `SELECT service,
              ROUND(SUM(cost_usd)::numeric, 4) AS total_cost,
              COUNT(*) AS total_calls,
              ROUND(AVG(cost_usd)::numeric, 6) AS avg_cost
       FROM ai_cost_log
       WHERE EXTRACT(YEAR FROM recorded_at) = $1
         AND EXTRACT(MONTH FROM recorded_at) = $2
       GROUP BY service
       ORDER BY total_cost DESC`,
      [year, month],
    );
    return rows as Array<{ service: string; total_cost: number; total_calls: number; avg_cost: number }>;
  } catch {
    return [];
  }
}
