ALTER TABLE "customer_service_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_token" text;
ALTER TABLE "customer_service_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_token_expires_at" timestamp with time zone;
