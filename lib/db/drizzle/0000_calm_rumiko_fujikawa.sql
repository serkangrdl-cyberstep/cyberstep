CREATE TYPE "public"."answer_type" AS ENUM('evet', 'kismen', 'bilmiyorum', 'hayir');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('in_progress', 'completed', 'report_ready');--> statement-breakpoint
CREATE TYPE "public"."assessment_type" AS ENUM('mini', 'full');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"sector" text NOT NULL,
	"employee_count" text NOT NULL,
	"assessment_type" "assessment_type" DEFAULT 'mini' NOT NULL,
	"status" "assessment_status" DEFAULT 'in_progress' NOT NULL,
	"total_score" integer,
	"max_score" integer,
	"risk_level" text,
	"red_alarm_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"reminder_sent_at" timestamp,
	"company_domain" text,
	"referral_code" text
);
--> statement-breakpoint
CREATE TABLE "assessment_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"question_number" integer NOT NULL,
	"answer" "answer_type" NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"total_score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"score_percent" integer NOT NULL,
	"risk_level" text NOT NULL,
	"red_alarm_count" integer NOT NULL,
	"red_alarm_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_analysis" text DEFAULT '' NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"domain_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_token" text,
	"verification_token" text,
	"verified_at" timestamp,
	"verification_expires_at" timestamp,
	"verification_duration_years" integer,
	"certification_tier" integer DEFAULT 1 NOT NULL,
	"admin_notes" text,
	"review_status" text DEFAULT 'pending_review' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"domain_scan_id" integer,
	"estimated_breach_cost_min" integer,
	"estimated_breach_cost_max" integer,
	"risk_reduction_percent" integer,
	"weekly_action_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kvkk_penalty_min" integer,
	"kvkk_penalty_max" integer,
	"kvkk_risk_level" text,
	"kvkk_risk_articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kvkk_risk_summary" text,
	"sector_benchmark_percent" integer,
	"sector_benchmark_comment" text,
	"verbis_required" boolean,
	"verbis_risk_level" text,
	"verbis_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"insurance_readiness_percent" integer,
	"insurance_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maturity_level" text,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer,
	"plan_slug" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"iyzico_payment_id" text,
	"iyzico_token" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"kdv_amount" numeric(10, 2),
	"net_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"company_name" text,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"subscription_plan" text,
	"subscription_status" text DEFAULT 'inactive' NOT NULL,
	"password_reset_token" text,
	"password_reset_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "consulting_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Shield' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text NOT NULL,
	"website_url" text,
	"sales_rep_name" text,
	"sales_rep_email" text,
	"additional_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#10b981' NOT NULL,
	"contact_email" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"title_en" text,
	"excerpt_en" text,
	"content_en" text,
	"social_text_tr" text,
	"social_text_en" text,
	"cover_image_base64" text,
	"author_name" text DEFAULT 'CyberStep.io' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"seo_title" text,
	"seo_title_en" text,
	"meta_description" text,
	"meta_description_en" text,
	"focus_keyword" text,
	"focus_keyword_en" text,
	"seo_tags" jsonb,
	"seo_tags_en" jsonb,
	"linkedin_post_tr" text,
	"linkedin_post_en" text,
	"instagram_carousel_tr" jsonb,
	"instagram_carousel_en" jsonb,
	"instagram_caption_tr" text,
	"instagram_caption_en" text,
	"visual_prompts_tr" jsonb,
	"visual_prompts_en" jsonb,
	"refs_json" jsonb,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"subscribed_at" timestamp DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "social_media_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_day_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message_tr" text NOT NULL,
	"message_en" text,
	"image_base64" text,
	"bg_color" text DEFAULT '#0f172a' NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"send_newsletter" boolean DEFAULT false NOT NULL,
	"newsletter_sent" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"type" text DEFAULT 'mini' NOT NULL,
	"domain" text NOT NULL,
	"text" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"is_red_alarm" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "domain_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"domain" text NOT NULL,
	"email" text,
	"spf_pass" boolean DEFAULT false NOT NULL,
	"spf_record" text,
	"dmarc_pass" boolean DEFAULT false NOT NULL,
	"dmarc_record" text,
	"dkim_pass" boolean DEFAULT false NOT NULL,
	"dkim_selectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mx_pass" boolean DEFAULT false NOT NULL,
	"mx_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ssl_pass" boolean DEFAULT false NOT NULL,
	"ssl_expiry" text,
	"ssl_issuer" text,
	"ssl_days_until_expiry" integer,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"hibp_breach_count" integer DEFAULT 0 NOT NULL,
	"hibp_breaches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blacklisted" boolean DEFAULT false NOT NULL,
	"blacklist_count" integer DEFAULT 0 NOT NULL,
	"blacklist_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shadow_it_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"http_headers_score" integer DEFAULT 0 NOT NULL,
	"http_headers_details" jsonb DEFAULT '{"hsts":false,"xFrameOptions":false,"xContentTypeOptions":false,"csp":false,"referrerPolicy":false}'::jsonb,
	"urlhaus_listed" boolean DEFAULT false NOT NULL,
	"urlhaus_threat" text,
	"usom_listed" boolean DEFAULT false NOT NULL,
	"ct_subdomains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ct_subdomain_count" integer DEFAULT 0 NOT NULL,
	"cve_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shodan_open_ports" jsonb,
	"shodan_vuln_count" integer DEFAULT 0 NOT NULL,
	"shodan_country" text,
	"shodan_isp" text,
	"virustotal_reputation" integer,
	"virustotal_malicious" integer DEFAULT 0 NOT NULL,
	"virustotal_suspicious" integer DEFAULT 0 NOT NULL,
	"abuseipdb_score" integer,
	"abuseipdb_total_reports" integer DEFAULT 0 NOT NULL,
	"abuseipdb_country" text,
	"abuseipdb_isp" text,
	"safe_browsing_flagged" boolean,
	"safe_browsing_threats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ssl_labs_grade" text,
	"badge_token" text,
	"referral_source" text,
	"kep_configured" boolean,
	"kep_relays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kep_secure" boolean,
	"attack_scenarios_json" jsonb,
	"attack_scenarios_status" text DEFAULT 'none',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"notified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "isr_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"deal_id" integer,
	"customer_id" integer,
	"type" text DEFAULT 'note' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"outcome" text,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_by_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"sector" text,
	"notes" text,
	"ai_profile" text,
	"preferred_vendor_ids" jsonb DEFAULT '[]'::jsonb,
	"avg_decision_days" integer,
	"deals_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"customer_email" text DEFAULT '' NOT NULL,
	"customer_company" text,
	"customer_phone" text,
	"vendor_id" integer,
	"vendor_name" text,
	"product_keywords" text,
	"request_text" text,
	"original_subject" text,
	"original_body" text,
	"ai_summary" text,
	"ai_priority_reason" text,
	"status" text DEFAULT 'new' NOT NULL,
	"intake_channel" text DEFAULT 'manual' NOT NULL,
	"assigned_rep_id" integer,
	"assigned_rep_email" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"lost_reason" text,
	"notes" text,
	"email_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_distributors" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"contact_email" text NOT NULL,
	"phone" text,
	"notes" text,
	"additional_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_email_inbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"message_id" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_email" text,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"processed_as" text,
	"deal_id" integer,
	"rfq_id" integer,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "isr_email_inbox_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "isr_margin_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vendor_id" integer,
	"name" text NOT NULL,
	"min_margin_pct" numeric(5, 2) DEFAULT '15' NOT NULL,
	"target_margin_pct" numeric(5, 2) DEFAULT '25' NOT NULL,
	"max_discount_pct" numeric(5, 2) DEFAULT '10' NOT NULL,
	"auto_approve_below" numeric(18, 4),
	"require_approval_above" numeric(18, 4),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_quote_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_response_id" integer,
	"quote_id" integer,
	"sku" text,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(18, 4),
	"unit_price" numeric(18, 4),
	"discount" numeric(5, 2) DEFAULT '0',
	"line_total" numeric(18, 4),
	"currency" text DEFAULT 'TRY' NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"quote_number" text NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"subtotal" numeric(18, 4),
	"kdv_rate" numeric(5, 2) DEFAULT '20',
	"kdv_amount" numeric(18, 4),
	"total" numeric(18, 4),
	"valid_days" integer DEFAULT 30 NOT NULL,
	"notes" text,
	"terms" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by_email" text,
	"approved_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"deal_id" integer,
	"remind_at" timestamp NOT NULL,
	"note" text,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_by_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_rfq_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"rfq_id" integer,
	"deal_id" integer NOT NULL,
	"from_email" text NOT NULL,
	"subject" text,
	"body" text,
	"ai_parsed" jsonb,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"valid_until" text,
	"notes" text,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isr_rfqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"distributor_id" integer,
	"sent_to_email" text NOT NULL,
	"sent_to_name" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"email_message_id" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "isr_vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"logo_url" text,
	"sales_rep_name" text,
	"sales_rep_email" text,
	"deal_reg_url" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"admin_user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_admin_user_id" integer,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"max_users" integer DEFAULT 1 NOT NULL,
	"max_assessments" integer DEFAULT 10 NOT NULL,
	"isr_enabled" boolean DEFAULT false NOT NULL,
	"logo_url" text,
	"primary_color" text,
	"ai_provider" text DEFAULT 'gemini-replit' NOT NULL,
	"ai_api_key" text,
	"ai_model" text,
	"quote_terms" text,
	"quote_valid_days" integer DEFAULT 30 NOT NULL,
	"quote_footer" text,
	"imap_host" text,
	"imap_user" text,
	"imap_pass" text,
	"smtp_host" text,
	"smtp_user" text,
	"smtp_pass" text,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"template_id" integer,
	"to_email" text NOT NULL,
	"to_name" text,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"related_type" text,
	"related_id" integer,
	"error" text,
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"categories" text[] DEFAULT '{}',
	"tier" text DEFAULT 'silver' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"monthly_fee" integer DEFAULT 0,
	"subscription_status" text DEFAULT 'trial',
	"password_hash" text,
	"description" text,
	"total_projects_completed" integer DEFAULT 0,
	"total_revenue" integer DEFAULT 0,
	"rating" integer,
	"referral_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "work_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"assessment_id" integer,
	"domain_scan_id" integer,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"estimated_cost" integer,
	"commission_rate" integer DEFAULT 15,
	"status" text DEFAULT 'open' NOT NULL,
	"partner_id" integer,
	"assigned_at" timestamp,
	"completed_at" timestamp,
	"verified_at" timestamp,
	"completion_note" text,
	"score_before" integer,
	"score_after" integer,
	"company_name" text,
	"domain" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_advantages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"partner_name" text NOT NULL,
	"description" text NOT NULL,
	"discount_percent" integer,
	"badge_text" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tprm_questionnaire_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_sector" text NOT NULL,
	"supplier_domain" text NOT NULL,
	"supplier_name" text,
	"token" text NOT NULL,
	"scan_score" integer,
	"scan_data" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tprm_questionnaire_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tprm_questionnaire_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"supplier_contact_name" text NOT NULL,
	"supplier_contact_email" text NOT NULL,
	"answers" jsonb NOT NULL,
	"self_score" integer NOT NULL,
	"combined_score" integer,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"scan_id" integer,
	"overall_score" integer,
	"sequence_step" integer DEFAULT 0 NOT NULL,
	"next_send_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer,
	"event_type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"items_pushed" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ciso_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text NOT NULL,
	"phone" text,
	"sector" text,
	"employee_count" text,
	"current_ciso" text,
	"message" text,
	"tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_activities" ADD CONSTRAINT "isr_activities_deal_id_isr_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."isr_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_activities" ADD CONSTRAINT "isr_activities_customer_id_isr_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."isr_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_deals" ADD CONSTRAINT "isr_deals_customer_id_isr_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."isr_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_deals" ADD CONSTRAINT "isr_deals_vendor_id_isr_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."isr_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_distributors" ADD CONSTRAINT "isr_distributors_vendor_id_isr_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."isr_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_email_inbox" ADD CONSTRAINT "isr_email_inbox_deal_id_isr_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."isr_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_email_inbox" ADD CONSTRAINT "isr_email_inbox_rfq_id_isr_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."isr_rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_margin_rules" ADD CONSTRAINT "isr_margin_rules_vendor_id_isr_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."isr_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_quote_lines" ADD CONSTRAINT "isr_quote_lines_rfq_response_id_isr_rfq_responses_id_fk" FOREIGN KEY ("rfq_response_id") REFERENCES "public"."isr_rfq_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_quotes" ADD CONSTRAINT "isr_quotes_deal_id_isr_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."isr_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_reminders" ADD CONSTRAINT "isr_reminders_deal_id_isr_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."isr_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_rfq_responses" ADD CONSTRAINT "isr_rfq_responses_rfq_id_isr_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."isr_rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_rfq_responses" ADD CONSTRAINT "isr_rfq_responses_deal_id_isr_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."isr_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_rfqs" ADD CONSTRAINT "isr_rfqs_deal_id_isr_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."isr_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "isr_rfqs" ADD CONSTRAINT "isr_rfqs_distributor_id_isr_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."isr_distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tprm_questionnaire_responses" ADD CONSTRAINT "tprm_questionnaire_responses_link_id_tprm_questionnaire_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."tprm_questionnaire_links"("id") ON DELETE no action ON UPDATE no action;