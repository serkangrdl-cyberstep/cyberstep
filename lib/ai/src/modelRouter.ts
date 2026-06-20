/**
 * Merkezi model yönlendiricisi.
 *
 * callModel():
 * - Model adını modelConfig'den alır (çağrı yapan kod model adı bilmez).
 * - system prompt varsa cache_control: ephemeral ekler (Anthropic prompt caching).
 * - system prompt yoksa cache_control eklenmez (dinamik içerik, cache faydası yok).
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

  const block = msg.content[0];
  return block?.type === "text" ? block.text.trim() : "";
}
