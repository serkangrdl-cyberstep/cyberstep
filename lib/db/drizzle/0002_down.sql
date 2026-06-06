-- Rollback: 0002_subscription_reminder30d.sql
-- Reverses: ADD COLUMN reminder30d_sent_at on customer_service_subscriptions

ALTER TABLE "customer_service_subscriptions" DROP COLUMN IF EXISTS "reminder30d_sent_at";
