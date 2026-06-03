/**
 * Ürün Analitiği — PostHog Entegrasyonu
 *
 * POSTHOG_API_KEY set edilmemişse tüm çağrılar sessizce atlanır.
 * Fire-and-forget — hiçbir zaman bir isteği bloke etmez.
 */

import { logger } from "../lib/logger";

const POSTHOG_HOST = process.env["POSTHOG_HOST"] ?? "https://app.posthog.com";
const API_KEY = process.env["POSTHOG_API_KEY"];

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

// ─── Temel event gönderici ─────────────────────────────────────────────────────

function captureEvent(
  distinctId: string,
  event: string,
  properties?: EventProperties,
): void {
  if (!API_KEY) return;

  setImmediate(async () => {
    try {
      await fetch(`${POSTHOG_HOST}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: API_KEY,
          event,
          distinct_id: distinctId,
          properties: {
            ...properties,
            platform: "cyberstep",
            $lib: "cyberstep-server",
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.debug({ err, event }, "PostHog capture failed (non-critical)");
    }
  });
}

// ─── Tip-güvenli olay fonksiyonları ───────────────────────────────────────────

export function trackPortalLogin(customerId: number, userAgent?: string): void {
  captureEvent(String(customerId), "portal_login", {
    source: userAgent,
  });
}

export function trackDomainAdded(customerId: number, domain: string, totalDomains: number): void {
  captureEvent(String(customerId), "domain_added", {
    domain,
    total_domains: totalDomains,
  });
}

export function trackScanStarted(customerId: number, domain: string, scanType: "manual" | "scheduled" = "manual"): void {
  captureEvent(String(customerId), "scan_started", {
    domain,
    scan_type: scanType,
  });
}

export function trackReportDownloaded(customerId: number, reportType: string, domain?: string): void {
  captureEvent(String(customerId), "report_downloaded", {
    report_type: reportType,
    domain,
  });
}

export function trackPlanUpgraded(customerId: number, fromPlan: string, toPlan: string): void {
  captureEvent(String(customerId), "plan_upgraded", {
    from_plan: fromPlan,
    to_plan: toPlan,
  });
}

export function trackSubscriptionCancelled(
  customerId: number,
  plan: string,
  reason?: string,
  monthsActive?: number,
): void {
  captureEvent(String(customerId), "subscription_cancelled", {
    plan,
    reason,
    months_active: monthsActive,
  });
}

export function trackOnboardingStep(
  customerId: number,
  step: string,
  daysSinceSignup: number,
): void {
  captureEvent(String(customerId), "onboarding_step_completed", {
    step,
    day_of_onboarding: daysSinceSignup,
  });
}

export function trackUpsellShown(customerId: number, ruleId: string, currentPlan: string): void {
  captureEvent(String(customerId), "upsell_shown", {
    rule_id: ruleId,
    current_plan: currentPlan,
  });
}

export function trackEvent(customerId: string, event: string, properties?: EventProperties): void {
  captureEvent(customerId, event, properties);
}
