-- Rollback: 0004_renewal_token_cols.sql
-- Reverses: ADD COLUMN renewal_token, renewal_token_expires_at on customer_service_subscriptions

ALTER TABLE "customer_service_subscriptions" DROP COLUMN IF EXISTS "renewal_token_expires_at";
ALTER TABLE "customer_service_subscriptions" DROP COLUMN IF EXISTS "renewal_token";
