/**
 * Merkezi model yönlendiricisi.
 *
 * callModel():
 * - Model adını modelConfig'den alır (çağrı yapan kod model adı bilmez).
 * - system prompt varsa cache_control: ephemeral ekler (Anthropic prompt caching).
 * - system prompt yoksa cache_control eklenmez (dinamik içerik, cache faydası yok).
 * - Başarılı her çağrıda setAiCostLogger ile kaydedilen hook'u gerçek token sayılarıyla çağırır.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getModel } from "./modelConfig.js";
import type { ModelTask } from "./modelConfig.js";

export interface CallModelParams {
  task: ModelTask;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

type CostLogEntry = {
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheType: "none" | "anthropic_prompt";
};
type CostLogFn = (entry: CostLogEntry) => void;
let _costLogger: CostLogFn | null = null;

/** Wire a cost logger once at startup (api-server calls this). */
export function setAiCostLogger(fn: CostLogFn): void {
  _costLogger = fn;
}

export async function callModel(params: CallModelParams): Promise<string> {
  const { task, system, messages, maxTokens = 2048 } = params;
  const model = getModel(task);

  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages,
    ...(system
      ? {
          system: [
            {
              type: "text" as const,
              text: system,
              cache_control: { type: "ephemeral" as const },
            },
          ],
        }
      : {}),
  });

  if (_costLogger) {
    const u = msg.usage as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    };
    _costLogger({
      task,
      model,
      inputTokens:  u.input_tokens,
      outputTokens: u.output_tokens,
      cacheType:    (u.cache_read_input_tokens ?? 0) > 0 ? "anthropic_prompt" : "none",
    });
  }

  const block = msg.content[0];
  return block?.type === "text" ? block.text.trim() : "";
}
