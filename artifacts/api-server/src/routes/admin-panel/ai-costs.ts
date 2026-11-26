import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const ESTIMATED_TASKS = new Set(["noc-triage", "noc-deep"]);

const router = Router();

router.get("/admin/ai-costs", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [totalsRow, byModelRows, byCustomerRows, byTaskRows] = await Promise.all([
      pool.query<{ total: string; calls: string; cached: string; input_tokens: string; output_tokens: string }>(
        `SELECT
           COALESCE(SUM(cost_usd), 0)            AS total,
           COUNT(*)                               AS calls,
           COALESCE(SUM(CASE WHEN cache_type = 'soc_memory' THEN 1 ELSE 0 END), 0) AS cached,
           COALESCE(SUM(input_tokens), 0)         AS input_tokens,
           COALESCE(SUM(output_tokens), 0)        AS output_tokens
         FROM ai_cost_log WHERE recorded_at >= $1`,
        [monthStart],
      ),
      pool.query<{ model: string; total: string; calls: string }>(
        `SELECT model,
                COALESCE(SUM(cost_usd), 0) AS total,
                COUNT(*)                   AS calls
         FROM ai_cost_log WHERE recorded_at >= $1
         GROUP BY model ORDER BY SUM(cost_usd) DESC`,
        [monthStart],
      ),
      pool.query<{ customer_id: number | null; total: string; calls: string }>(
        `SELECT customer_id,
                COALESCE(SUM(cost_usd), 0) AS total,
                COUNT(*)                   AS calls
         FROM ai_cost_log WHERE recorded_at >= $1
         GROUP BY customer_id ORDER BY SUM(cost_usd) DESC LIMIT 25`,
        [monthStart],
      ),
      pool.query<{ task: string; total: string; calls: string; cached: string }>(
        `SELECT COALESCE(task, service)   AS task,
                COALESCE(SUM(cost_usd), 0) AS total,
                COUNT(*)                   AS calls,
                COALESCE(SUM(CASE WHEN cache_type = 'soc_memory' THEN 1 ELSE 0 END), 0) AS cached
         FROM ai_cost_log WHERE recorded_at >= $1
         GROUP BY COALESCE(task, service) ORDER BY SUM(cost_usd) DESC`,
        [monthStart],
      ),
    ]);

    const t = totalsRow.rows[0];
    const total = Number(t?.total ?? 0);
    const dayOfMonth = new Date().getDate();
    const projection = dayOfMonth > 0 ? (total / dayOfMonth) * 30 : total;

    res.json({
      month: {
        total,
        calls:        Number(t?.calls ?? 0),
        cached:       Number(t?.cached ?? 0),
        inputTokens:  Number(t?.input_tokens ?? 0),
        outputTokens: Number(t?.output_tokens ?? 0),
      },
      byTask: byTaskRows.rows.map((r) => ({
        task:        r.task,
        total:       Number(r.total),
        calls:       Number(r.calls),
        cached:      Number(r.cached),
        isEstimated: ESTIMATED_TASKS.has(r.task) || r.task.startsWith("gemini-"),
      })),
      byModel: byModelRows.rows.map((r) => ({
        model: r.model,
        total: Number(r.total),
        calls: Number(r.calls),
      })),
      byCustomer: byCustomerRows.rows.map((r) => ({
        customerId: r.customer_id,
        total:      Number(r.total),
        calls:      Number(r.calls),
      })),
      projectionUsd: Number(projection.toFixed(4)),
    });
  } catch (err) {
    logger.error({ err }, "SOC ai-costs failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
