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

export function calculateInternalScore(
  data: Record<string, unknown>,
  survey?: Record<string, unknown>,
): InternalScoreResult {
  let score = 100;
  const findings: InternalScoreFinding[] = [];
  const breakdown: Record<string, number> = {};

  const os = data["os"] as Record<string, unknown> | undefined;
  const security = data["security"] as Record<string, unknown> | undefined;
  const users = data["users"] as Record<string, unknown> | undefined;
  const network = data["network"] as Record<string, unknown> | undefined;
  const services = data["services"] as Record<string, unknown> | undefined;
  const identity = data["identity"] as Record<string, unknown> | undefined;

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

  // ── KİMLİK & AD KONTROLLER ────────────────────────────────────────────────
  if (identity) {
    const identityMode = identity["mode"] as string | undefined;

    // Domain Admin sayısı (AD modunda)
    const domainAdminCount = identity["domain_admin_count"];
    if (domainAdminCount !== null && domainAdminCount !== undefined) {
      const cnt = Number(domainAdminCount);
      if (cnt > 5) {
        score -= 15;
        findings.push({
          category: "identity",
          finding: `Domain Admin sayısı: ${cnt} (kritik yüksek)`,
          severity: "critical",
          points: 15,
          recommendation: `En fazla 2-3 Domain Admin olmalı. ${cnt - 3} hesabın yetkisi düşürülmeli.`,
        });
      } else if (cnt > 3) {
        score -= 10;
        findings.push({
          category: "identity",
          finding: `Domain Admin sayısı: ${cnt}`,
          severity: "high",
          points: 10,
          recommendation: "Best practice: 2 veya daha az Domain Admin. Fazla hesaplar kaldırılmalı.",
        });
      }
    }

    // Kerberoastable hesaplar
    const kerb = identity["kerberoastable_accounts"];
    if (kerb !== null && kerb !== undefined && Number(kerb) > 2) {
      score -= 8;
      findings.push({
        category: "identity",
        finding: `${kerb} Kerberoastable servis hesabı`,
        severity: "high",
        points: 8,
        recommendation:
          "SPN'li servis hesapları güçlü parola (25+ karakter) ile korunmalı veya gMSA kullanılmalı.",
      });
    }

    // AS-REP Roastable
    const asrep = identity["asrep_roastable"];
    if (asrep !== null && asrep !== undefined && Number(asrep) > 0) {
      score -= 10;
      findings.push({
        category: "identity",
        finding: `${asrep} hesapta ön kimlik doğrulaması kapalı (AS-REP Roasting riski)`,
        severity: "critical",
        points: 10,
        recommendation:
          "Tüm kullanıcı hesaplarında \"Do not require Kerberos preauthentication\" kapatılmalı.",
      });
    }

    // Parola politikası (AD veya yerel)
    const idPwPolicy =
      (identity["password_policy"] as Record<string, unknown> | undefined) ??
      (identity["local_policy"] as Record<string, unknown> | undefined);
    if (idPwPolicy) {
      const minLen = idPwPolicy["min_length"] ?? idPwPolicy["min_password_length"];
      if (minLen !== null && minLen !== undefined && Number(minLen) < 8) {
        score -= 12;
        findings.push({
          category: "identity",
          finding: `Minimum şifre uzunluğu yetersiz: ${minLen} karakter`,
          severity: "critical",
          points: 12,
          recommendation:
            "Minimum 12 karakter zorunlu yapılmalı. Parolalar yerine parola ifadesi (passphrase) teşvik edilmesi önerilir.",
        });
      } else if (minLen !== null && minLen !== undefined && Number(minLen) < 12) {
        score -= 6;
        findings.push({
          category: "identity",
          finding: `Minimum şifre uzunluğu: ${minLen} karakter`,
          severity: "medium",
          points: 6,
          recommendation: "Minimum 12 karakter olarak yükseltilmeli.",
        });
      }

      if (idPwPolicy["complexity_enabled"] === false) {
        score -= 8;
        findings.push({
          category: "identity",
          finding: "Şifre karmaşıklık kuralı devre dışı",
          severity: "high",
          points: 8,
          recommendation:
            "Büyük/küçük harf, rakam ve özel karakter zorunluluğu etkinleştirilmeli.",
        });
      }

      const maxAge = idPwPolicy["max_age_days"] ?? idPwPolicy["max_password_age_days"];
      if (maxAge === null || maxAge === undefined || maxAge === 0) {
        score -= 8;
        findings.push({
          category: "identity",
          finding: "Şifre süresi dolmuyor",
          severity: "high",
          points: 8,
          recommendation:
            "Servis hesapları hariç tüm hesaplara şifre süresi uygulanmalı (90-180 gün).",
        });
      }
    }

    // 90 günden eski kullanıcılar
    const staleUsers = identity["stale_users_90d"];
    if (staleUsers !== null && staleUsers !== undefined && Number(staleUsers) > 5) {
      score -= 6;
      findings.push({
        category: "identity",
        finding: `${staleUsers} hesap 90 günden fazladır giriş yapmamış`,
        severity: "medium",
        points: 6,
        recommendation: "90 günden fazla aktif olmayan hesaplar devre dışı bırakılmalı.",
      });
    }

    // Sudo NOPASSWD (Linux)
    const sudoNoPasswd = identity["sudo_nopasswd_entries"];
    if (sudoNoPasswd !== null && sudoNoPasswd !== undefined && Number(sudoNoPasswd) > 0) {
      score -= 10;
      findings.push({
        category: "identity",
        finding: `${sudoNoPasswd} sudo kuralı şifresiz yetki yükseltmeye izin veriyor`,
        severity: "high",
        points: 10,
        recommendation:
          "NOPASSWD sudo kuralları kaldırılmalı. Tüm yetki yükseltmeleri şifre gerektirmeli.",
      });
    }

    // Guest hesabı
    if (identity["guest_account_enabled"] === true) {
      score -= 5;
      findings.push({
        category: "identity",
        finding: "Guest hesabı etkin",
        severity: "medium",
        points: 5,
        recommendation: "Guest/misafir hesabı devre dışı bırakılmalı.",
      });
    }

    // SSH boş parola
    if (identity["ssh_permit_empty_passwords"] === "yes") {
      score -= 15;
      findings.push({
        category: "identity",
        finding: "SSH boş parola girişine izin veriliyor",
        severity: "critical",
        points: 15,
        recommendation: "sshd_config: PermitEmptyPasswords no hemen uygulanmalı.",
      });
    }

    // Geri dönüşümlü şifreleme (AD)
    const pwPolicyFull = identity["password_policy"] as Record<string, unknown> | undefined;
    if (pwPolicyFull?.["reversible_encryption"] === true) {
      score -= 12;
      findings.push({
        category: "identity",
        finding: "AD geri dönüşümlü şifreleme aktif",
        severity: "critical",
        points: 12,
        recommendation:
          "Geri dönüşümlü şifreleme kapatılmalı — bu ayar şifreleri düz metin olarak saklar.",
      });
    }

    // ADSI fallback (modül eksik) — bilgi bulgusu
    if (identityMode === "adsi_fallback") {
      findings.push({
        category: "identity",
        finding: "AD modülü (RSAT) kurulu değil — sınırlı analiz",
        severity: "low",
        points: 0,
        recommendation:
          "PowerShell RSAT modülü kurularak daha kapsamlı AD analizi yapılabilir: Install-WindowsFeature RSAT-AD-PowerShell",
      });
    }

    breakdown["identity"] = score;
  }

  // ── ANKET VERİSİ KONTROLLER ────────────────────────────────────────────────
  if (survey) {
    // Yedekleme
    if (survey["backup_enabled"] === false) {
      score -= 20;
      findings.push({
        category: "backup",
        finding: "Düzenli yedekleme yapılmıyor",
        severity: "critical",
        points: 20,
        recommendation:
          "En az günlük yedekleme politikası oluşturulmalı. 3-2-1 kuralı: 3 kopya, 2 farklı medya, 1 off-site.",
      });
    } else if (survey["backup_enabled"] === true) {
      if (!survey["backup_offsite"]) {
        score -= 8;
        findings.push({
          category: "backup",
          finding: "Off-site / bulut yedek yok",
          severity: "high",
          points: 8,
          recommendation:
            "Fidye yazılımı saldırısında lokal yedekler de etkilenebilir. Buluta yedekleme eklenmeli.",
        });
      }
      if (!survey["backup_immutable"]) {
        score -= 5;
        findings.push({
          category: "backup",
          finding: "Değiştirilemez (immutable) yedek yok",
          severity: "medium",
          points: 5,
          recommendation:
            "WORM veya immutable storage ile yedekleri fidye yazılımına karşı koruyun.",
        });
      }
      const lastTestRaw = survey["backup_last_test_date"];
      if (lastTestRaw && typeof lastTestRaw === "string") {
        const daysSinceTest = (Date.now() - new Date(lastTestRaw).getTime()) / 86400000;
        if (daysSinceTest > 180) {
          score -= 6;
          findings.push({
            category: "backup",
            finding: `Yedek son ${Math.floor(daysSinceTest)} gündür test edilmedi`,
            severity: "medium",
            points: 6,
            recommendation: "Aylık test restore prosedürü oluşturulmalı.",
          });
        }
      }
    }

    // Olay Müdahale Planı
    if (survey["ir_plan_exists"] === false) {
      score -= 10;
      findings.push({
        category: "ir_plan",
        finding: "Yazılı olay müdahale planı yok",
        severity: "high",
        points: 10,
        recommendation:
          "Basit bir IR planı bile yoktan iyidir. Kim, ne zaman, nasıl müdahale eder yazılmalı.",
      });
    } else if (survey["ir_plan_exists"] === true && survey["ir_plan_last_test"]) {
      const daysSince =
        (Date.now() - new Date(survey["ir_plan_last_test"] as string).getTime()) / 86400000;
      if (daysSince > 365) {
        score -= 5;
        findings.push({
          category: "ir_plan",
          finding: `IR planı ${Math.floor(daysSince / 30)} aydır test edilmedi`,
          severity: "medium",
          points: 5,
          recommendation: "Yılda en az bir tatbikat yapılmalı.",
        });
      }
    }

    // Güvenlik Eğitimi
    if (survey["security_training_enabled"] === false) {
      score -= 8;
      findings.push({
        category: "training",
        finding: "Güvenlik farkındalık eğitimi yapılmıyor",
        severity: "high",
        points: 8,
        recommendation:
          "Yılda en az bir kez phishing farkındalık eğitimi düzenlenmeli.",
      });
    }

    if (survey["phishing_simulation"] === false && survey["security_training_enabled"] === true) {
      score -= 4;
      findings.push({
        category: "training",
        finding: "Phishing simülasyonu yapılmıyor",
        severity: "low",
        points: 4,
        recommendation:
          "Simüle edilmiş phishing testleri çalışanların farkındalığını ölçmenin en etkili yoludur.",
      });
    }

    // KVKK
    if (survey["kvkk_verbis_registered"] === false) {
      score -= 10;
      findings.push({
        category: "compliance",
        finding: "KVKK VERBİS kaydı yok",
        severity: "critical",
        points: 10,
        recommendation:
          "KVKK kapsamındaki veri sorumlularının VERBİS kaydı yasal zorunluluk. İdari para cezası riski var.",
      });
    }

    // SIEM
    if (survey["siem_exists"] === false) {
      score -= 5;
      findings.push({
        category: "monitoring",
        finding: "SIEM / merkezi log toplama yok",
        severity: "medium",
        points: 5,
        recommendation:
          "Güvenlik olayları merkezi olarak loglanmalı. Wazuh (açık kaynak) başlangıç için uygundur.",
      });
    }

    breakdown["survey"] = score;
  }

  return {
    score: Math.max(0, score),
    breakdown,
    findings: findings.sort((a, b) => b.points - a.points),
  };
}
