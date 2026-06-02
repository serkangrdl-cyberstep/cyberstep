ALTER TABLE "customer_service_subscriptions" ADD COLUMN IF NOT EXISTS "reminder7d_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_service_subscriptions" ADD COLUMN IF NOT EXISTS "reminder1d_sent_at" timestamp with time zone;
