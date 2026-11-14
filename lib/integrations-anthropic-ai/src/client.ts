import Anthropic from "@anthropic-ai/sdk";

// İki çalışma biçimi:
//  - Replit: AI_INTEGRATIONS_ANTHROPIC_BASE_URL + AI_INTEGRATIONS_ANTHROPIC_API_KEY (otomatik tanımlanır)
//  - Replit dışı (Railway vb.): ANTHROPIC_API_KEY — resmi Anthropic API'si kullanılır
const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error(
    "Anthropic API anahtarı yok: Replit'te AI_INTEGRATIONS_ANTHROPIC_API_KEY, Replit dışında ANTHROPIC_API_KEY tanımlayın.",
  );
}
if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && !baseURL) {
  throw new Error(
    "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
  );
}

export const anthropic = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
