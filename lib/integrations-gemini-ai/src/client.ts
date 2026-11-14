import { GoogleGenAI } from "@google/genai";

// İki çalışma biçimi:
//  - Replit: AI_INTEGRATIONS_GEMINI_BASE_URL + AI_INTEGRATIONS_GEMINI_API_KEY (Replit proxy'si, apiVersion "")
//  - Replit dışı (Railway vb.): GEMINI_API_KEY — resmi Gemini API'si, SDK varsayılanlarıyla
const geminiBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

if (!geminiKey) {
  throw new Error(
    "Gemini API anahtarı yok: Replit'te AI_INTEGRATIONS_GEMINI_API_KEY, Replit dışında GEMINI_API_KEY tanımlayın.",
  );
}
if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && !geminiBaseUrl) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
  );
}

export const ai = new GoogleGenAI(
  geminiBaseUrl
    ? { apiKey: geminiKey, httpOptions: { apiVersion: "", baseUrl: geminiBaseUrl } }
    : { apiKey: geminiKey },
);
