import { promises as dns } from "dns";

const OVERALL_TIMEOUT_MS = 8000;
const HTTP_TIMEOUT_MS = 5000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function extractPageTitle(html: string): Promise<string | null> {
  const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return match ? match[1].trim() : null;
}

async function httpProbe(
  domain: string
): Promise<{ http_status: number | null; page_title: string | null }> {
  const urls = [`http://${domain}`, `https://${domain}`];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
      }).finally(() => clearTimeout(timer));
      const text = await res.text().catch(() => "");
      const page_title = await extractPageTitle(text);
      return { http_status: res.status, page_title };
    } catch {
      // try next URL
    }
  }
  return { http_status: null, page_title: null };
}

export async function checkVariantDomain(variant: string): Promise<{
  is_registered: boolean;
  is_active: boolean;
  ip_address: string | null;
  http_status: number | null;
  page_title: string | null;
  registrar: string | null;
}> {
  const defaultResult = {
    is_registered: false,
    is_active: false,
    ip_address: null,
    http_status: null,
    page_title: null,
    registrar: null,
  };

  try {
    const result = await withTimeout(
      (async () => {
        // Step 1: A record
        let aRecords: string[] = [];
        try {
          aRecords = await dns.resolve4(variant);
        } catch {
          return defaultResult;
        }

        const ip_address = aRecords[0] ?? null;

        // Step 2: MX record
        let is_active = false;
        try {
          const mxRecords = await dns.resolveMx(variant);
          if (mxRecords.length > 0) is_active = true;
        } catch {
          // no MX
        }

        // Step 3: HTTP probe
        const { http_status, page_title } = await httpProbe(variant);
        if (http_status !== null) is_active = true;

        return {
          is_registered: true,
          is_active,
          ip_address,
          http_status,
          page_title,
          registrar: null,
        };
      })(),
      OVERALL_TIMEOUT_MS
    );

    return result ?? defaultResult;
  } catch {
    return defaultResult;
  }
}
