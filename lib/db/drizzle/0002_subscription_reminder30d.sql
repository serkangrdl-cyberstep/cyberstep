ALTER TABLE "customer_service_subscriptions" ADD COLUMN IF NOT EXISTS "reminder30d_sent_at" timestamp with time zone;
