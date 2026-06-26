export function calculateSuspicionScore(data: {
  original_domain: string;
  variant_domain: string;
  is_active: boolean;
  http_status: number | null;
  page_title: string | null;
  variant_type: string;
}): { is_suspicious: boolean; reason: string | null } {
  const { original_domain, is_active, http_status, page_title, variant_type } =
    data;

  if (!is_active) {
    return { is_suspicious: false, reason: null };
  }

  const titleLower = (page_title ?? "").toLowerCase();
  const { name: originalName } = parseName(original_domain);
  const originalLower = originalName.toLowerCase();

  // Homoglyph + 200 → kesinlikle şüpheli
  if (variant_type === "homoglyph" && http_status === 200) {
    return {
      is_suspicious: true,
      reason: "Aktif site, homoglyph domain ve HTTP 200 yanıtı",
    };
  }

  // Page title orijinal marka adını içeriyorsa
  if (originalLower.length >= 3 && titleLower.includes(originalLower)) {
    return {
      is_suspicious: true,
      reason: "Aktif site, orijinal marka adı page title'da",
    };
  }

  // TLD swap + HTTP 200
  if (variant_type === "tld_swap" && http_status === 200) {
    return {
      is_suspicious: true,
      reason: "Aktif site, TLD varyasyonu ve HTTP 200 yanıtı",
    };
  }

  // Phishing anahtar kelimeleri
  const phishingKeywords = [
    "login",
    "giriş",
    "panel",
    "secure",
    "hesap",
    "şifre",
    "sifre",
    "doğrula",
    "dogrula",
    "otp",
    "verify",
    "account",
    "password",
  ];
  const hasPhishingKeyword = phishingKeywords.some((kw) =>
    titleLower.includes(kw)
  );
  if (http_status === 200 && hasPhishingKeyword) {
    return {
      is_suspicious: true,
      reason: "Aktif site, page title kimlik avı anahtar kelimesi içeriyor",
    };
  }

  return { is_suspicious: false, reason: null };
}

function parseName(domain: string): { name: string } {
  const lower = domain.toLowerCase();
  if (lower.endsWith(".com.tr") || lower.endsWith(".net.tr") || lower.endsWith(".org.tr")) {
    return { name: lower.slice(0, lower.lastIndexOf(".", lower.length - 3)) };
  }
  const dotIdx = lower.lastIndexOf(".");
  return { name: dotIdx === -1 ? lower : lower.slice(0, dotIdx) };
}
