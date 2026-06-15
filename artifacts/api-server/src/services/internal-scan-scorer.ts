export interface InternalScoreFinding {
  category: string;
  finding: string;
  severity: "critical" | "high" | "medium" | "low";
  points: number;
  recommendation: string;
}

export interface InternalScoreResult {
  score: number;
  breakdown: Record<string, number>;
  findings: InternalScoreFinding[];
}

export function calculateInternalScore(data: Record<string, unknown>): InternalScoreResult {
  let score = 100;
  const findings: InternalScoreFinding[] = [];
  const breakdown: Record<string, number> = {};

  const os = data["os"] as Record<string, unknown> | undefined;
  const security = data["security"] as Record<string, unknown> | undefined;
  const users = data["users"] as Record<string, unknown> | undefined;
  const network = data["network"] as Record<string, unknown> | undefined;
  const services = data["services"] as Record<string, unknown> | undefined;

  // ── İŞLETİM SİSTEMİ ───────────────────────────────────────────────────────
  if (os?.["is_eol"]) {
    score -= 20;
    findings.push({
      category: "os",
      finding: "EOL işletim sistemi tespit edildi",
      severity: "critical",
      points: 20,
      recommendation: "Desteklenen bir OS versiyonuna yükseltme yapın — güvenlik yaması alınamıyor.",
    });
  }

  const lastPatchRaw = os?.["last_patch_date"];
  if (lastPatchRaw && typeof lastPatchRaw === "string") {
    const lastPatch = new Date(lastPatchRaw);
    if (!isNaN(lastPatch.getTime())) {
      const daysSincePatch = (Date.now() - lastPatch.getTime()) / 86400000;
      if (daysSincePatch > 90) {
        score -= 15;
        findings.push({
          category: "os",
          finding: `Son yama ${Math.floor(daysSincePatch)} gün önce`,
          severity: "high",
          points: 15,
          recommendation: "Otomatik güncellemeyi etkinleştirin veya aylık yama sürecini başlatın.",
        });
      } else if (daysSincePatch > 30) {
        score -= 8;
        findings.push({
          category: "os",
          finding: `Son yama ${Math.floor(daysSincePatch)} gün önce`,
          severity: "medium",
          points: 8,
          recommendation: "Yamalar 30 günden eski — yakında güncelleme yapılmalı.",
        });
      }
    }
  }

  breakdown["os"] = score;

  // ── GÜVENLİK ─────────────────────────────────────────────────────────────
  const av = security?.["av"] as Record<string, unknown> | undefined;
  const avDetected = security?.["av_detected"];
  const avEnabled = av?.["enabled"];
  if (!avDetected && !avEnabled) {
    score -= 15;
    findings.push({
      category: "security",
      finding: "AV/EDR tespit edilmedi",
      severity: "critical",
      points: 15,
      recommendation: "Microsoft Defender for Endpoint veya CrowdStrike Falcon Go önerilir.",
    });
  }

  const firewall = security?.["firewall"] as Record<string, unknown> | undefined;
  const fwOk = firewall?.["private_enabled"] || security?.["firewall_active"];
  if (!fwOk) {
    score -= 10;
    findings.push({
      category: "security",
      finding: "Güvenlik duvarı kapalı",
      severity: "high",
      points: 10,
      recommendation: "Windows Firewall veya UFW etkinleştirilmeli.",
    });
  }

  const bitlocker = security?.["bitlocker"] as Record<string, unknown> | undefined;
  const encOk = bitlocker?.["enabled"] || security?.["luks_encryption"];
  if (!encOk) {
    score -= 10;
    findings.push({
      category: "security",
      finding: "Disk şifreleme aktif değil",
      severity: "medium",
      points: 10,
      recommendation: "BitLocker (Windows) veya LUKS (Linux) etkinleştirilmeli.",
    });
  }

  if (security?.["ssh_root_login"] === "yes") {
    score -= 8;
    findings.push({
      category: "security",
      finding: "SSH root girişi açık",
      severity: "high",
      points: 8,
      recommendation: "sshd_config: PermitRootLogin no yapılmalı.",
    });
  }

  breakdown["security"] = score;

  // ── KULLANICI ─────────────────────────────────────────────────────────────
  const domainAdmins = users?.["domain_admin_count"];
  if (domainAdmins !== null && domainAdmins !== undefined && Number(domainAdmins) > 3) {
    score -= 10;
    findings.push({
      category: "users",
      finding: `Domain Admin sayısı: ${domainAdmins}`,
      severity: "high",
      points: 10,
      recommendation: "Best practice: 2 veya daha az Domain Admin. Fazla hesaplar kaldırılmalı.",
    });
  }

  const localAdmins = users?.["local_admin_count"];
  if (localAdmins !== undefined && Number(localAdmins) > 2) {
    score -= 5;
    findings.push({
      category: "users",
      finding: `${localAdmins} yerel admin hesabı`,
      severity: "medium",
      points: 5,
      recommendation: "Gereksiz yerel admin hesapları kaldırılmalı veya düşürülmeli.",
    });
  }

  const pwPolicy = users?.["password_policy"] as Record<string, unknown> | undefined;
  if (pwPolicy && Number(pwPolicy["min_length"]) < 8) {
    score -= 8;
    findings.push({
      category: "users",
      finding: `Şifre min uzunluğu: ${pwPolicy["min_length"]}`,
      severity: "high",
      points: 8,
      recommendation: "Minimum şifre uzunluğu 12 karakter olarak ayarlanmalı.",
    });
  }

  breakdown["users"] = score;

  // ── AĞ ────────────────────────────────────────────────────────────────────
  const shares = (network?.["shares"] as unknown[]) ?? [];
  if (shares.length > 5) {
    score -= 5;
    findings.push({
      category: "network",
      finding: `${shares.length} açık ağ paylaşımı`,
      severity: "medium",
      points: 5,
      recommendation: "Kullanılmayan paylaşımlar kapatılmalı, erişim yetkileri gözden geçirilmeli.",
    });
  }

  const secServices = services?.["security_services"] as Record<string, unknown> | undefined;
  if (secServices?.["remote_registry"]) {
    score -= 5;
    findings.push({
      category: "services",
      finding: "Remote Registry servisi çalışıyor",
      severity: "medium",
      points: 5,
      recommendation: "Uzak kayıt defteri erişimi kapatılmalı (Services → RemoteRegistry → Disabled).",
    });
  }
  if (secServices?.["telnet"]) {
    score -= 10;
    findings.push({
      category: "services",
      finding: "Telnet servisi aktif",
      severity: "critical",
      points: 10,
      recommendation: "Telnet şifresiz iletişim kurar. Hemen kapatılmalı, SSH kullanılmalı.",
    });
  }

  breakdown["network"] = score;

  return {
    score: Math.max(0, score),
    breakdown,
    findings: findings.sort((a, b) => b.points - a.points),
  };
}
