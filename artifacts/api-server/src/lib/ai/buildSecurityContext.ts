import { db } from "@workspace/db";
import {
  customersTable,
  domainScansTable,
  internalScansTable,
  internalScanSurveysTable,
  fortinetIntegrationsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export async function buildSecurityContext(customerId: number): Promise<string> {
  const lines: string[] = [];

  // 1. Müşteri bilgisi
  const customer = await db.query.customersTable.findFirst({
    where: eq(customersTable.id, customerId),
    columns: { email: true, companyName: true },
  });

  lines.push("=== ŞİRKET BİLGİSİ ===");
  lines.push(`Şirket: ${customer?.companyName ?? "Bilinmiyor"}`);
  lines.push(`E-posta: ${customer?.email ?? "Bilinmiyor"}`);

  // 2. Dış tarama — domain_scans tablosundan email üzerinden
  const emailDomain = customer?.email?.split("@")[1] ?? "";
  let externalScan = null;
  if (emailDomain) {
    externalScan = await db.query.domainScansTable.findFirst({
      where: eq(domainScansTable.email, customer?.email ?? ""),
      orderBy: desc(domainScansTable.createdAt),
    });
    if (!externalScan) {
      // domain bazlı fallback
      externalScan = await db.query.domainScansTable.findFirst({
        where: eq(domainScansTable.domain, emailDomain),
        orderBy: desc(domainScansTable.createdAt),
      });
    }
  }

  if (externalScan) {
    lines.push("");
    lines.push("=== DIŞ TARAMA SONUÇLARI ===");
    lines.push(`Domain: ${externalScan.domain}`);
    lines.push(`Dış Güvenlik Skoru: ${externalScan.overallScore}/100`);
    if (externalScan.letterGrade) lines.push(`Not: ${externalScan.letterGrade}`);
    lines.push(`SPF: ${externalScan.spfPass ? "VAR (geçerli)" : "YOK veya eksik"}`);
    lines.push(`DMARC: ${externalScan.dmarcPass ? "VAR (politika uygulanıyor)" : "YOK veya monitor-only"}`);
    lines.push(`DKIM: ${externalScan.dkimPass ? "VAR" : "YOK"}`);
    if (externalScan.sslDaysUntilExpiry !== null && externalScan.sslDaysUntilExpiry !== undefined) {
      lines.push(`SSL Sertifikası: ${externalScan.sslDaysUntilExpiry} gün kaldı`);
    }
    if (externalScan.openPortsCount) {
      lines.push(`Açık Port Sayısı: ${externalScan.openPortsCount}`);
    }
    if (externalScan.httpHeadersScore !== null) {
      lines.push(`HTTP Güvenlik Başlıkları: ${externalScan.httpHeadersScore}/100`);
    }
    if (externalScan.hasCdn) {
      lines.push(`WAF/CDN: ${externalScan.cdnProvider ?? "Tespit edildi"}`);
    }
    if (externalScan.criticalCveCount && externalScan.criticalCveCount > 0) {
      lines.push(`Kritik CVE Sayısı: ${externalScan.criticalCveCount}`);
    }
    if (externalScan.sector) {
      lines.push(`Sektör: ${externalScan.sector}`);
    }
  }

  // 3. İç tarama
  const internalScan = await db.query.internalScansTable.findFirst({
    where: eq(internalScansTable.customerId, customerId),
    orderBy: desc(internalScansTable.scannedAt),
  });

  if (internalScan?.rawData) {
    const raw = internalScan.rawData as Record<string, unknown>;
    lines.push("");
    lines.push("=== İÇ TARAMA SONUÇLARI ===");
    lines.push(`İç Güvenlik Skoru: ${internalScan.internalScore}/100`);
    lines.push(`Tarama Tarihi: ${internalScan.scannedAt?.toLocaleDateString("tr-TR") ?? "Bilinmiyor"}`);
    lines.push(`Tarama Tipi: ${internalScan.scanType === "internal_script_windows" ? "Windows" : "Linux"}`);
    lines.push(`Sunucu: ${internalScan.hostname ?? "Bilinmiyor"}`);

    // OS
    const os = raw["os"] as Record<string, unknown> | undefined;
    if (os) {
      lines.push(`İşletim Sistemi: ${os["name"] ?? ""} ${os["version"] ?? ""}`);
      if (os["is_eol"]) lines.push("⚠ EOL (desteksiz) işletim sistemi tespit edildi");
      if (os["last_patch_date"]) lines.push(`Son Yama: ${os["last_patch_date"]}`);
      if (os["auto_update"] === false) lines.push("⚠ Otomatik güncelleme kapalı");
    }

    // Güvenlik
    const security = raw["security"] as Record<string, unknown> | undefined;
    if (security) {
      const av = security["av"] as Record<string, unknown> | undefined;
      if (!av?.["enabled"] && !security["av_detected"]) {
        lines.push("⚠ AV/EDR tespit edilmedi");
      } else if (av?.["name"]) {
        lines.push(`AV/EDR: ${av["name"]}`);
        if (av["signature_outdated"]) lines.push("⚠ AV imzaları güncel değil");
      }
      const fw = security["firewall"] as Record<string, unknown> | undefined;
      if (fw && !fw["private_enabled"] && !fw["domain_enabled"]) {
        lines.push("⚠ Güvenlik duvarı kapalı");
      }
      const bl = security["bitlocker"] as Record<string, unknown> | undefined;
      if (bl?.["enabled"] === false) lines.push("⚠ BitLocker disk şifreleme kapalı");
      if (security["luks_encryption"] === false) lines.push("⚠ LUKS disk şifreleme kapalı");
      if (security["ssh_root_login"] === "yes") lines.push("⚠ SSH root girişi açık");
    }

    // Kimlik / AD
    const identity = raw["identity"] as Record<string, unknown> | undefined;
    if (identity) {
      lines.push(`Kimlik Modu: ${identity["mode"] ?? "bilinmiyor"}`);
      if (identity["domain_admin_count"] !== null && identity["domain_admin_count"] !== undefined) {
        lines.push(`Domain Admin Sayısı: ${identity["domain_admin_count"]}`);
      }
      if (Number(identity["kerberoastable_accounts"]) > 0) {
        lines.push(`⚠ Kerberoastable hesap: ${identity["kerberoastable_accounts"]}`);
      }
      if (Number(identity["asrep_roastable"]) > 0) {
        lines.push(`⚠ AS-REP Roastable hesap: ${identity["asrep_roastable"]}`);
      }
      if (Number(identity["password_never_expires"]) > 3) {
        lines.push(`⚠ Şifre süresi dolmayan hesap: ${identity["password_never_expires"]}`);
      }
      if (Number(identity["stale_users_90d"]) > 5) {
        lines.push(`⚠ 90+ gün giriş yapmayan hesap: ${identity["stale_users_90d"]}`);
      }
      const pw = identity["password_policy"] as Record<string, unknown> | undefined;
      if (pw) {
        lines.push(`Şifre min uzunluk: ${pw["min_length"] ?? pw["min_password_length"] ?? "bilinmiyor"}`);
        if (pw["complexity_enabled"] === false) lines.push("⚠ Şifre karmaşıklık kuralı kapalı");
      }
      if (Number(identity["sudo_nopasswd_entries"]) > 0) {
        lines.push(`⚠ Sudo NOPASSWD kuralı: ${identity["sudo_nopasswd_entries"]}`);
      }
      if (identity["ssh_permit_empty_passwords"] === "yes") {
        lines.push("⚠ SSH boş şifreye izin veriyor");
      }
      if (identity["guest_account_enabled"] === true) {
        lines.push("⚠ Guest hesabı etkin");
      }
    }

    // Skor breakdown
    if (internalScan.scoreBreakdown) {
      const bd = internalScan.scoreBreakdown as Record<string, number>;
      lines.push("");
      lines.push("Kategori Skorları:");
      for (const [k, v] of Object.entries(bd)) {
        lines.push(`  ${k}: ${v}`);
      }
    }
  }

  // 4. Anket
  const survey = await db.query.internalScanSurveysTable.findFirst({
    where: eq(internalScanSurveysTable.customerId, customerId),
  });

  if (survey) {
    lines.push("");
    lines.push("=== GÜVENLİK ANKETİ ===");

    lines.push(`Yedekleme: ${survey.backupEnabled ? "VAR" : "YOK"}`);
    if (survey.backupEnabled) {
      lines.push(`  Sıklık: ${survey.backupFrequency ?? "Belirtilmemiş"}`);
      lines.push(`  Off-site yedek: ${survey.backupOffsite ? "VAR" : "YOK"}`);
      lines.push(`  Immutable yedek: ${survey.backupImmutable ? "VAR" : "YOK"}`);
      if (survey.backupLastTestDate) {
        const days = Math.floor(
          (Date.now() - new Date(survey.backupLastTestDate).getTime()) / 86400000,
        );
        lines.push(`  Son restore testi: ${days} gün önce`);
      }
    }

    lines.push(`IR Planı: ${survey.irPlanExists ? "VAR" : "YOK"}`);
    if (survey.irPlanExists && survey.irPlanLastTest) {
      const days = Math.floor(
        (Date.now() - new Date(survey.irPlanLastTest).getTime()) / 86400000,
      );
      lines.push(`  Son tatbikat: ${days} gün önce`);
    }
    if (survey.irTeamDefined !== null) {
      lines.push(`  IR ekibi tanımlı: ${survey.irTeamDefined ? "EVET" : "HAYIR"}`);
    }

    lines.push(`Güvenlik Eğitimi: ${survey.securityTrainingEnabled ? "VAR" : "YOK"}`);
    if (survey.securityTrainingEnabled && survey.trainingFrequency) {
      lines.push(`  Sıklık: ${survey.trainingFrequency}`);
    }
    lines.push(`Phishing Simülasyonu: ${survey.phishingSimulation ? "VAR" : "YOK"}`);

    lines.push(`KVKK VERBİS: ${survey.kvkkVerbisRegistered ? "KAYITLI" : "KAYITSIZ"}`);
    lines.push(`Siber Sigorta: ${survey.cyberInsurance ? "VAR" : "YOK"}`);
    lines.push(`ISO 27001: ${survey.iso27001 ? "VAR" : "YOK"}`);
    lines.push(`PCI-DSS: ${survey.pciDss ? "KAPSAM VAR" : "KAPSAM YOK"}`);
    lines.push(`SIEM: ${survey.siemExists ? "VAR" : "YOK"}`);
    lines.push(`SOC: ${survey.socType ?? "YOK"}`);
  }

  // 5. Fortinet Fabric / FortiGate API verileri
  const fortinet = await db.query.fortinetIntegrationsTable.findFirst({
    where: eq(fortinetIntegrationsTable.customerId, customerId),
    orderBy: desc(fortinetIntegrationsTable.updatedAt),
    columns: {
      status: true, eventsReceived: true, correlationsCount: true, blocksCount: true,
      fgFirmwareVersion: true, fgFirmwareEol: true, fgFirmwareOutdated: true,
      fgPolicyAnalysis: true, fgVpnData: true, fgEndpoints: true, fgSyncedAt: true,
    },
  });

  if (fortinet) {
    lines.push("");
    lines.push("=== FORTİNET SECURITY FABRIC ===");
    lines.push(`Olay Akışı: ${fortinet.status === "connected" ? "Bağlı" : "Bağlı değil"}`);
    lines.push(`Alınan olay: ${fortinet.eventsReceived}, Korelasyon: ${fortinet.correlationsCount}, Engellenen IP: ${fortinet.blocksCount}`);

    if (fortinet.fgFirmwareVersion) {
      lines.push(`FortiOS Versiyonu: ${fortinet.fgFirmwareVersion}`);
      if (fortinet.fgFirmwareEol) lines.push("⚠ FortiOS EOL — destek sona erdi, kritik güvenlik riski");
      else if (fortinet.fgFirmwareOutdated) lines.push("⚠ FortiOS güncel değil");
    }

    if (fortinet.fgPolicyAnalysis) {
      const pa = fortinet.fgPolicyAnalysis;
      lines.push(`Firewall Policy: ${pa.total} toplam`);
      if (pa.any_source > 0) lines.push(`⚠ Any-kaynak policy: ${pa.any_source} (herkese açık kurallar)`);
      if (pa.any_destination > 0) lines.push(`⚠ Any-hedef policy: ${pa.any_destination}`);
      if (pa.logging_disabled > 0) lines.push(`⚠ Log kapalı policy: ${pa.logging_disabled} (görünmez trafik)`);
      if (pa.disabled_policies > 0) lines.push(`Devre dışı policy: ${pa.disabled_policies}`);
      if (!pa.implicit_deny_exists) lines.push("⚠ Implicit Deny kuralı yok");
    }

    if (fortinet.fgVpnData) {
      const vpn = fortinet.fgVpnData;
      if (vpn.ssl_vpn_enabled) {
        lines.push(`SSL VPN aktif kullanıcı: ${vpn.ssl_vpn_active_users}`);
        if (vpn.mfa_enabled === false) lines.push("⚠ SSL VPN aktif ancak MFA yok — kritik risk");
      }
      if (vpn.ipsec_tunnels_up > 0) lines.push(`IPSec tünel: ${vpn.ipsec_tunnels_up} aktif`);
    }

    if (fortinet.fgEndpoints) {
      const ep = fortinet.fgEndpoints;
      if (ep.total_endpoints !== null) {
        lines.push(`FortiClient Endpoint: ${ep.total_endpoints} toplam, ${ep.compliant} uyumlu, ${ep.non_compliant} uyumsuz`);
        if (ep.non_compliant > 0) lines.push(`⚠ ${ep.non_compliant} uyumsuz endpoint var`);
      } else if (ep.note) {
        lines.push(`FortiClient: ${ep.note}`);
      }
    }

    if (fortinet.fgSyncedAt) {
      lines.push(`Son FortiGate API sync: ${new Date(fortinet.fgSyncedAt).toLocaleDateString("tr-TR")}`);
    }
  }

  return lines.join("\n");
}
