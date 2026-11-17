/**
 * Skor v2 bulgularından deterministik "öncelikli aksiyon" listesi üretir.
 * Yapay zeka senaryosu olmayan raporlarda (ör. TPRM tedarikçi raporu) kullanılır;
 * her aksiyon doğrudan ölçülmüş bir bulguya dayanır, tahmin içermez.
 */

export interface FindingLike { category: string; severity: string; title: string; deduction: number }
export interface ActionItem { oncelik: number; aksiyon: string; neden: string }

const SEV_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function actionsFromFindings(findings: FindingLike[], max = 6): ActionItem[] {
  const sorted = [...findings]
    .filter((f) => f.deduction > 0)
    .sort((a, b) => (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0) || b.deduction - a.deduction);

  const cves: string[] = [];
  const ports: string[] = [];
  const out: Array<{ key: string; aksiyon: string; neden: string }> = [];
  const seen = new Set<string>();
  const push = (key: string, aksiyon: string, neden: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, aksiyon, neden });
  };

  for (const f of sorted) {
    const t = f.title;
    if (/CVE-\d{4}-\d+/.test(t)) {
      const id = /CVE-\d{4}-\d+/.exec(t)![0];
      if (!cves.includes(id)) cves.push(id);
      push("cve", "", "");
    } else if (/internete açık/i.test(t)) {
      const port = /^(\d+)\//.exec(t)?.[1];
      if (port && !ports.includes(port)) ports.push(port);
      push("ports", "", "");
    } else if (/USOM/i.test(t)) {
      push("usom", "USOM kaydının nedenini araştırıp içeriği temizleyin ve USOM'a çıkarma başvurusu yapın.", "USOM listesindeki adresler Türkiye'de ulusal düzeyde engellenebilir; bu kayıt tedarik zinciri güvenini doğrudan etkiler.");
    } else if (/URLhaus|Safe Browsing/i.test(t)) {
      push("malware", "Web sitesini ve sunucuyu zararlı yazılım açısından tarayıp temizleyin; liste sağlayıcılarından yeniden inceleme isteyin.", "Zararlı içerik dağıtımı kaydı tespit edildi; temizlik yapılmadan tarayıcılar ve e-posta sistemleri siteyi engellemeye devam eder.");
    } else if (/kara liste/i.test(t)) {
      push("dnsbl", "Alan adı/IP'nin yer aldığı spam kara listelerine çıkarma başvurusu yapın ve kaynağı (ele geçirilmiş hesap veya sunucu) giderin.", "Kara listedeki adreslerden gönderilen e-postalar karşı tarafta reddedilebilir veya spama düşer.");
    } else if (/VirusTotal|AbuseIPDB/i.test(t)) {
      push("rep", "Alan adı/IP itibarını düşüren etkinliği (spam, zararlı bağlantı, tarama trafiği) araştırıp giderin.", "Harici itibar servisleri bu adresi şüpheli işaretlemiş; itibar düzelmeden engellenme riski sürer.");
    } else if (/SPF/i.test(t)) {
      push("spf", "SPF kaydını yetkili gönderici listesiyle tamamlayıp '-all' ile sonlandırın.", "Zayıf veya eksik SPF, alan adı adına sahte e-posta gönderilmesini kolaylaştırır.");
    } else if (/DMARC/i.test(t)) {
      push("dmarc", "DMARC politikasını p=quarantine ve ardından p=reject yönünde sıkılaştırın; rua raporlarını izleyin.", "DMARC yokken veya yalnızca izleme modundayken sahte e-postalar engellenmez.");
    } else if (/DKIM/i.test(t)) {
      push("dkim", "E-posta gönderen sistemlerde DKIM imzalamayı etkinleştirin.", "DKIM imzası, e-postaların değiştirilmediğini ve alan adınızdan geldiğini doğrular.");
    } else if (/veri sızıntı|veri ihlali/i.test(t)) {
      push("breach", "Sızıntıda yer alan hesapların parolalarını sıfırlayın ve çok faktörlü doğrulamayı zorunlu kılın.", "Sızan kimlik bilgileri hesap ele geçirme saldırılarında kullanılır.");
    } else if (/SSL|sertifika/i.test(t)) {
      push("ssl", "SSL/TLS sertifikasını yenileyin ve otomatik yenilemeyi (ör. ACME/Let's Encrypt) etkinleştirin.", "Süresi dolan veya doğrulanamayan sertifika tarayıcı uyarısına ve hizmet kesintisine yol açar.");
    } else if (/HTTP güvenlik başlıkları/i.test(t)) {
      push("headers", "HTTP güvenlik başlıklarını yapılandırın: HSTS, X-Content-Type-Options, X-Frame-Options (veya CSP frame-ancestors) ve Content-Security-Policy.", "Başlıklar tarayıcı tabanlı saldırılara karşı ek bir savunma katmanı sağlar; yapılandırması düşük maliyetlidir.");
    }
  }

  return out.slice(0, max).map((o, i) => {
    if (o.key === "cve") {
      return { oncelik: i + 1, aksiyon: `${cves.slice(0, 4).join(", ")} zafiyetlerinden etkilenen bileşeni güncelleyin veya yamalayın.`, neden: "Bilinen zafiyetler saldırganlarca otomatik taranır; CISA KEV listesindekiler aktif olarak sömürülmektedir." };
    }
    if (o.key === "ports") {
      return { oncelik: i + 1, aksiyon: `İnternete açık gereksiz servisleri (port ${ports.slice(0, 6).join(", ")}) kapatın veya VPN/IP kısıtlamasıyla erişime sınırlayın.`, neden: "İnternete açık yönetim ve veri servisleri doğrudan saldırı yüzeyidir." };
    }
    return { oncelik: i + 1, aksiyon: o.aksiyon, neden: o.neden };
  });
}
