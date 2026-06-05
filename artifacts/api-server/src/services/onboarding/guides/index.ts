import { MICROSOFT_365_GUIDE } from "./microsoft365";
import { CVE_PRO_GUIDE } from "./cve-pro";
import { PENTEST_GUIDE } from "./pentest";
import { SERVICENOW_GUIDE } from "./servicenow";
import { PHISHING_GUIDE } from "./phishing";

export { MICROSOFT_365_GUIDE, CVE_PRO_GUIDE, PENTEST_GUIDE, SERVICENOW_GUIDE, PHISHING_GUIDE };

const GUIDES_BY_SLUG: Record<string, unknown> = {
  "microsoft-365": MICROSOFT_365_GUIDE,
  "cve-izleme-pro": CVE_PRO_GUIDE,
  "pentest-lite-tek": PENTEST_GUIDE,
  "pentest-lite-5domain": PENTEST_GUIDE,
  "pentest-lite-yillik": PENTEST_GUIDE,
  "servicenow": SERVICENOW_GUIDE,
  "phishing-simulation": PHISHING_GUIDE,
};

export function getGuideBySlug(slug: string): unknown | null {
  return GUIDES_BY_SLUG[slug] ?? null;
}

export function hasGuide(slug: string): boolean {
  return slug in GUIDES_BY_SLUG;
}

export const GUIDE_SLUGS = Object.keys(GUIDES_BY_SLUG);
