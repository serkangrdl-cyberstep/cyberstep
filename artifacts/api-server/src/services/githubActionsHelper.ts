import https from "https";
import { logger } from "../lib/logger";

interface GhRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

interface GhRunsResponse {
  workflow_runs: GhRun[];
}

function ghGet(pat: string, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method: "GET",
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "CyberStep-Server",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on("error", reject);
    req.end();
  });
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
  const body = JSON.stringify({ ref, ...(inputs ? { inputs } : {}) });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path: `/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "CyberStep-Server",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        resolve({ dispatched: res.statusCode === 204, httpStatus: res.statusCode ?? 0 });
      },
    );
    req.on("error", (err) => {
      logger.warn({ err: String(err) }, "githubActionsHelper: dispatch HTTP error");
      resolve({ dispatched: false, httpStatus: 0 });
    });
    req.write(body);
    req.end();
  });
}

export function watchRunInBackground(opts: {
  pat: string;
  repo: string;
  workflowId: string;
  dispatchedAt: Date;
  logContext?: Record<string, unknown>;
  timeoutMs?: number;
}): void {
  const { pat, repo, workflowId, dispatchedAt, logContext = {}, timeoutMs = 10 * 60 * 1000 } = opts;

  setImmediate(async () => {
    try {
      const initialWaitMs = 45_000;
      await sleep(initialWaitMs);

      const deadline = Date.now() + timeoutMs - initialWaitMs;
      const runsPath = `/repos/${repo}/actions/workflows/${workflowId}/runs?per_page=10&event=workflow_dispatch`;

      let run: GhRun | null = null;

      for (let attempt = 0; attempt < 3 && !run; attempt++) {
        const raw = await ghGet(pat, runsPath);
        const data = JSON.parse(raw.toString()) as GhRunsResponse;
        const candidates = (data.workflow_runs ?? []).filter(
          (r) => new Date(r.created_at) >= dispatchedAt,
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
        const raw = await ghGet(pat, `/repos/${repo}/actions/runs/${run.id}`);
        run = JSON.parse(raw.toString()) as GhRun;
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
