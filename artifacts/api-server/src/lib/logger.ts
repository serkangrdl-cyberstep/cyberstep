import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      // HTTP transport headers
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      // Sensitive fields at top level of logged objects
      "password", "passwordHash", "token", "botToken", "secret",
      "api_key", "apiKey", "client_secret", "clientSecret",
      "bot_token_enc", "username_enc", "password_enc",
      "secret_enc", "webhook_secret_enc", "api_key_enc",
      // One level deep — e.g. { body: { password: "..." } }
      "*.password", "*.passwordHash", "*.token", "*.botToken",
      "*.secret", "*.api_key", "*.apiKey", "*.client_secret",
      "*.bot_token_enc", "*.username_enc", "*.password_enc",
      "*.secret_enc", "*.webhook_secret_enc", "*.api_key_enc",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
