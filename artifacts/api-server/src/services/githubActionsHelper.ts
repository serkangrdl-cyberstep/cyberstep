import axios from "axios";
import { logger } from "../lib/logger";

interface GhRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  display_title: string;
}

interface GhRunsResponse {
  workflow_runs: GhRun[];
}

function ghGet<T>(pat: string, path: string): Promise<T> {
  return axios
    .get<T>(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "CyberStep-Server",
      },
      timeout: 20_000,
    })
    .then((r) => r.data);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export interface DispatchResult {
  dispatched: boolean;
  httpStatus: number;
}

export interface RunResult {
  runId: number;
  conclusion: string;
  runUrl: string;
}

export async function dispatchWorkflow(opts: {
  pat: string;
  repo: string;
  workflowId: string;
  ref?: string;
  inputs?: Record<string, string>;
}): Promise<DispatchResult> {
  const { pat, repo, workflowId, ref = "main", inputs } = opts;
  const body = { ref, ...(inputs ? { inputs } : {}) };

  try {
    const res = await axios.post(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
      body,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "CyberStep-Server",
        },
        timeout: 15_000,
        validateStatus: () => true,
      },
    );
    return { dispatched: res.status === 204, httpStatus: res.status };
  } catch (err) {
    logger.warn({ err: String(err) }, "githubActionsHelper: dispatch HTTP error");
    return { dispatched: false, httpStatus: 0 };
  }
}

export function watchRunInBackground(opts: {
  pat: string;
  repo: string;
  workflowId: string;
  dispatchedAt: Date;
  correlationId?: string;
  logContext?: Record<string, unknown>;
  timeoutMs?: number;
}): void {
  const { pat, repo, workflowId, dispatchedAt, correlationId, logContext = {}, timeoutMs = 10 * 60 * 1000 } = opts;

  setImmediate(async () => {
    try {
      const initialWaitMs = 45_000;
      await sleep(initialWaitMs);

      const deadline = Date.now() + timeoutMs - initialWaitMs;
      const runsPath = `/repos/${repo}/actions/workflows/${workflowId}/runs?per_page=10&event=workflow_dispatch`;

      let run: GhRun | null = null;

      // correlationId (carried in the run-name via the workflow's `correlation_id`
      // input) uniquely identifies *this* dispatch's run. Without it, two dispatches
      // racing within the same poll window (e.g. cron + manual) could both match the
      // same timestamp-filtered candidate. Timestamp filtering is kept as a fallback
      // for callers that don't pass a correlationId.
      for (let attempt = 0; attempt < 3 && !run; attempt++) {
        const data = await ghGet<GhRunsResponse>(pat, runsPath);
        const candidates = (data.workflow_runs ?? []).filter((r) =>
          correlationId
            ? r.display_title?.includes(correlationId)
            : new Date(r.created_at) >= dispatchedAt,
        );
        run = candidates[0] ?? null;
        if (!run) await sleep(15_000);
      }

      if (!run) {
        logger.warn({ workflow: workflowId, ...logContext }, "githubActionsHelper: run not found after dispatch (queued but never started?)");
        return;
      }

      logger.info({ runId: run.id, runUrl: run.html_url, workflow: workflowId, ...logContext }, "githubActionsHelper: run found, polling for completion");

      while (
        (run.status === "queued" || run.status === "in_progress" || run.status === "waiting") &&
        Date.now() < deadline
      ) {
        await sleep(30_000);
        run = await ghGet<GhRun>(pat, `/repos/${repo}/actions/runs/${run.id}`);
      }

      if (run.status === "completed") {
        const level = run.conclusion === "success" ? "info" : "warn";
        logger[level](
          { runId: run.id, conclusion: run.conclusion, runUrl: run.html_url, workflow: workflowId, ...logContext },
          `githubActionsHelper: run completed — conclusion=${run.conclusion}`,
        );
      } else {
        logger.warn(
          { runId: run.id, status: run.status, runUrl: run.html_url, workflow: workflowId, ...logContext },
          "githubActionsHelper: run timed out waiting for completion",
        );
      }
    } catch (err) {
      logger.warn({ err: String(err), workflow: workflowId, ...logContext }, "githubActionsHelper: watchRun error");
    }
  });
}
