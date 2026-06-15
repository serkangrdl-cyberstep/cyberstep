# CyberStep — İç Tarama Faz 2: AD & Kimlik Analizi + Anket Modülü
## Replit Agent Promptu

---

## BAĞLAM

Faz 1 tamamlandı:
- cyberstep-scan.ps1 ve cyberstep-scan.sh çalışıyor
- internal_scans tablosu ve skor motoru aktif
- Müşteri panelinde /hesabim/ic-tarama sayfası var

Bu prompt Faz 2'yi ekliyor:
1. PowerShell script'e AD modülü — domain var mı otomatik algılar
2. AD yoksa yerel güvenlik politikası analizi
3. Bash script'e kimlik modülü
4. Skor motoruna yeni AD/kimlik kontrolleri
5. Anket modülü — script'in göremediği verileri toplar
6. Müşteri panelinde anket sayfası

Mevcut dosyaları bul ve genişlet — sıfırdan yazmaya çalışma.

---

## BÖLÜM 1 — POWERSHELL: AD MODÜLÜ

`cyberstep-scan.ps1` dosyasını bul. Mevcut script'in sonuna,
JSON çıktı üretilmeden önce, şu bölümü ekle:

```powershell
# ── 7. KİMLİK & ERİŞİM (AD veya Yerel) ─────────────────────────────────────

$result.identity = @{
    ad_available    = $false
    mode            = "local"
    findings        = @()
}

# AD bağlantısını kontrol et
$adAvailable = $false
try {
    $domainInfo = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
    $adAvailable = $true
} catch { }

# AD Modülünü kontrol et
$adModuleAvailable = $null -ne (Get-Module -ListAvailable -Name "ActiveDirectory")

if ($adAvailable -and $adModuleAvailable) {
    # ── ACTIVE DIRECTORY MODU ─────────────────────────────────────────────
    $result.identity.ad_available = $true
    $result.identity.mode = "active_directory"

    try {
        Import-Module ActiveDirectory -ErrorAction Stop

        # Domain bilgisi
        $domain = Get-ADDomain
        $result.identity.domain_name        = $domain.DNSRoot
        $result.identity.domain_functional_level = $domain.DomainMode.ToString()
        $result.identity.forest_functional_level = (Get-ADForest).ForestMode.ToString()

        # Kullanıcı sayıları
        $allUsers     = Get-ADUser -Filter * -Properties Enabled, LastLogonDate,
                          PasswordExpired, PasswordNeverExpires, PasswordLastSet
        $enabledUsers = $allUsers | Where-Object { $_.Enabled -eq $true }
        $disabledUsers= $allUsers | Where-Object { $_.Enabled -eq $false }

        $result.identity.total_users    = @($allUsers).Count
        $result.identity.enabled_users  = @($enabledUsers).Count
        $result.identity.disabled_users = @($disabledUsers).Count

        # 90 günden fazla login yapmayan aktif kullanıcılar
        $staleThreshold = (Get-Date).AddDays(-90)
        $staleUsers = $enabledUsers | Where-Object {
            $_.LastLogonDate -ne $null -and $_.LastLogonDate -lt $staleThreshold
        }
        $result.identity.stale_users_90d = @($staleUsers).Count

        # Süresi dolmayan şifreler
        $neverExpire = $enabledUsers | Where-Object { $_.PasswordNeverExpires -eq $true }
        $result.identity.password_never_expires = @($neverExpire).Count

        # Süresi dolmuş şifreler
        $expiredPwd = $enabledUsers | Where-Object { $_.PasswordExpired -eq $true }
        $result.identity.password_expired = @($expiredPwd).Count

        # Domain Admins
        $domainAdmins = Get-ADGroupMember "Domain Admins" -Recursive |
                        Where-Object { $_.objectClass -eq "user" }
        $result.identity.domain_admin_count = @($domainAdmins).Count
        $result.identity.domain_admins = @($domainAdmins | Select-Object -First 10 |
            ForEach-Object { $_.SamAccountName })

        # Enterprise Admins
        try {
            $entAdmins = Get-ADGroupMember "Enterprise Admins" -Recursive
            $result.identity.enterprise_admin_count = @($entAdmins).Count
        } catch { $result.identity.enterprise_admin_count = $null }

        # Schema Admins
        try {
            $schemaAdmins = Get-ADGroupMember "Schema Admins" -Recursive
            $result.identity.schema_admin_count = @($schemaAdmins).Count
        } catch { $result.identity.schema_admin_count = $null }

        # Password Policy
        $pwPolicy = Get-ADDefaultDomainPasswordPolicy
        $result.identity.password_policy = @{
            min_length         = $pwPolicy.MinPasswordLength
            complexity_enabled = $pwPolicy.ComplexityEnabled
            max_age_days       = $pwPolicy.MaxPasswordAge.Days
            min_age_days       = $pwPolicy.MinPasswordAge.Days
            history_count      = $pwPolicy.PasswordHistoryCount
            lockout_threshold  = $pwPolicy.LockoutThreshold
            lockout_duration_min = $pwPolicy.LockoutDuration.TotalMinutes
            reversible_encryption = $pwPolicy.ReversibleEncryptionEnabled
        }

        # Fine-Grained Password Policies
        try {
            $fgpp = Get-ADFineGrainedPasswordPolicy -Filter *
            $result.identity.fine_grained_policies = @($fgpp).Count
        } catch { $result.identity.fine_grained_policies = 0 }

        # Kerberoastable hesaplar (SPN'li servis hesapları)
        $kerberoastable = Get-ADUser -Filter {
            ServicePrincipalName -ne "$null" -and Enabled -eq $true
        } -Properties ServicePrincipalName
        $result.identity.kerberoastable_accounts = @($kerberoastable).Count

        # AS-REP Roastable (ön kimlik doğrulama gerektirmeyen)
        $asrepRoastable = Get-ADUser -Filter {
            DoesNotRequirePreAuth -eq $true -and Enabled -eq $true
        }
        $result.identity.asrep_roastable = @($asrepRoastable).Count

        # AdminSDHolder korumalı hesaplar
        try {
            $adminSDHolder = Get-ADUser -Filter { AdminCount -eq 1 -and Enabled -eq $true }
            $result.identity.admin_sd_holder = @($adminSDHolder).Count
        } catch { $result.identity.admin_sd_holder = $null }

        # Son 30 günde kilitlenen hesaplar
        try {
            $lockout30 = Search-ADAccount -LockedOut | Where-Object {
                $_.LastBadPasswordAttempt -gt (Get-Date).AddDays(-30)
            }
            $result.identity.lockouts_30d = @($lockout30).Count
        } catch { $result.identity.lockouts_30d = $null }

        # GPO sayısı
        try {
            $gpos = Get-GPO -All
            $result.identity.gpo_count = @($gpos).Count
            $result.identity.gpo_unlinked = @($gpos |
                Where-Object { $_.GpoStatus -eq "AllSettingsDisabled" }).Count
        } catch {
            $result.identity.gpo_count = $null
            $result.errors += "gpo: $_"
        }

        # Son parola değişimi 365 günden eski olan admin hesapları
        $oldPwdAdmins = $domainAdmins | ForEach-Object {
            Get-ADUser $_ -Properties PasswordLastSet
        } | Where-Object {
            $_.PasswordLastSet -ne $null -and
            $_.PasswordLastSet -lt (Get-Date).AddDays(-365)
        }
        $result.identity.admins_old_password = @($oldPwdAdmins).Count

    } catch {
        $result.identity.ad_error = $_.ToString()
        $result.errors += "ad_module: $_"
    }

} elseif ($adAvailable -and -not $adModuleAvailable) {
    # AD var ama modül yok — ADSI ile temel bilgi
    $result.identity.ad_available = $true
    $result.identity.mode = "adsi_fallback"
    $result.identity.ad_module_missing = $true
    $result.identity.note = "AD modülü yüklü değil. RSAT aracını yükleyerek daha fazla bilgi toplayabilirsiniz."

    try {
        $searcher = New-Object DirectoryServices.DirectorySearcher
        $searcher.Filter = "(&(objectClass=user)(objectCategory=person))"
        $searcher.PageSize = 1000
        $results = $searcher.FindAll()
        $result.identity.total_users = $results.Count
    } catch { $result.errors += "adsi: $_" }

} else {
    # ── YEREL GÜVENLİK POLİTİKASI MODU ─────────────────────────────────
    $result.identity.mode = "local_security_policy"

    # Yerel şifre politikası (net accounts)
    try {
        $netAccounts = net accounts 2>&1
        $minPwdLen   = ($netAccounts | Select-String "Minimum password length").ToString() -replace "\D",""
        $maxPwdAge   = ($netAccounts | Select-String "Maximum password age").ToString() -replace "\D",""
        $lockoutThr  = ($netAccounts | Select-String "Lockout threshold").ToString() -replace "\D",""

        $result.identity.local_policy = @{
            min_password_length = if ($minPwdLen) { [int]$minPwdLen } else { $null }
            max_password_age_days = if ($maxPwdAge -and $maxPwdAge -ne "Unlimited") {
                [int]$maxPwdAge } else { $null }
            lockout_threshold = if ($lockoutThr) { [int]$lockoutThr } else { $null }
        }
    } catch { $result.errors += "net_accounts: $_" }

    # Yerel Administrators grubu
    try {
        $localAdmins = Get-LocalGroupMember -Group "Administrators"
        $result.identity.local_admins = @($localAdmins | ForEach-Object {
            @{ name = $_.Name; type = $_.PrincipalSource.ToString() }
        })
        $result.identity.local_admin_count = @($localAdmins).Count
    } catch { $result.errors += "local_admins: $_" }

    # Guest hesabı
    $guestEnabled = (Get-LocalUser -Name "Guest" -EA SilentlyContinue).Enabled
    $result.identity.guest_account_enabled = ($guestEnabled -eq $true)

    # Secedit ile güvenlik ayarları
    try {
        $tmpFile = "$env:TEMP\secedit_export.cfg"
        secedit /export /cfg $tmpFile /quiet 2>$null
        if (Test-Path $tmpFile) {
            $secedit = Get-Content $tmpFile
            $pwdComplexity = ($secedit | Select-String "PasswordComplexity").ToString() -match "= 1"
            $minPwdLen2    = ($secedit | Select-String "MinimumPasswordLength") -replace ".*= ",""
            $result.identity.secedit = @{
                password_complexity = $pwdComplexity
                min_password_length = if ($minPwdLen2) { [int]$minPwdLen2.Trim() } else { $null }
            }
            Remove-Item $tmpFile -Force
        }
    } catch { $result.errors += "secedit: $_" }

    # RDP MFA / Network Level Authentication
    try {
        $rdpNla = (Get-ItemProperty `
            "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" `
            -Name "UserAuthenticationRequired" -EA SilentlyContinue).UserAuthenticationRequired
        $result.identity.rdp_nla_enabled = ($rdpNla -eq 1)
    } catch { $result.errors += "rdp_nla: $_" }
}
```

---

## BÖLÜM 2 — BASH: KİMLİK MODÜLÜ

`cyberstep-scan.sh` dosyasını bul. JSON oluşturmadan önce şu bölümü ekle:

```bash
# ── 7. KİMLİK & ERİŞİM ──────────────────────────────────────────────────────

IDENTITY_MODE="local"
AD_AVAILABLE="false"
DOMAIN_NAME=""
DOMAIN_ADMIN_COUNT="null"
TOTAL_USERS="null"
STALE_USERS="null"
KERBEROASTABLE="null"
PW_MIN_LENGTH="null"
PW_COMPLEXITY="null"
PW_MAX_AGE="null"
LOCKOUT_THRESHOLD="null"
GUEST_ENABLED="false"

# Realm / SSSD / Winbind ile domain bağlantısı kontrol et
if command -v realm >/dev/null 2>&1; then
    REALM_STATUS=$(realm list 2>/dev/null | head -1)
    if [[ -n "$REALM_STATUS" ]]; then
        AD_AVAILABLE="true"
        IDENTITY_MODE="realm"
        DOMAIN_NAME=$(realm list 2>/dev/null | grep "domain-name" | awk '{print $2}')

        # Domain users
        if command -v getent >/dev/null 2>&1; then
            TOTAL_USERS=$(getent passwd 2>/dev/null | awk -F: '$3 >= 1000 && $3 < 65534' | wc -l)
        fi

        # Sudoers (domain admin proxy)
        DOMAIN_ADMIN_COUNT=$(grep -c "^%" /etc/sudoers 2>/dev/null || echo 0)
    fi
elif id "$(hostname)\\" 2>/dev/null || wbinfo -t 2>/dev/null; then
    AD_AVAILABLE="true"
    IDENTITY_MODE="winbind"
    DOMAIN_NAME=$(wbinfo --own-domain 2>/dev/null)
fi

# Yerel kullanıcı analizi (her durumda)
LOCAL_USERS_WITH_LOGIN=$(awk -F: '$3 >= 1000 && $3 < 65534 && $7 !~ /nologin|false/ {print $1}' \
    /etc/passwd 2>/dev/null | tr '\n' ',')
TOTAL_LOCAL=$(awk -F: '$3 >= 1000 && $3 < 65534' /etc/passwd 2>/dev/null | wc -l)
SYSTEM_ACCOUNTS=$(awk -F: '$3 < 1000 && $3 > 0' /etc/passwd 2>/dev/null | wc -l)

# Root şifresinin son değişimi
ROOT_PWD_CHANGED=$(passwd -S root 2>/dev/null | awk '{print $3}')

# Sudo yapılandırması
SUDO_NOPASSWD=$(grep -r "NOPASSWD" /etc/sudoers /etc/sudoers.d/ 2>/dev/null | \
    grep -v "^#" | wc -l)
SUDO_ALL=$(grep -r "ALL=(ALL" /etc/sudoers /etc/sudoers.d/ 2>/dev/null | \
    grep -v "^#" | wc -l)

# Guest / anonim
GUEST_ENABLED="false"
id "guest" >/dev/null 2>&1 && GUEST_ENABLED="true"

# PAM şifre politikası
PW_MIN_LENGTH=$(grep "^minlen" /etc/security/pwquality.conf 2>/dev/null | \
    awk '{print $3}')
PW_COMPLEXITY=$(grep "^minclass" /etc/security/pwquality.conf 2>/dev/null | \
    awk '{print $3}')
# Login.defs'den max age
PW_MAX_AGE=$(grep "^PASS_MAX_DAYS" /etc/login.defs 2>/dev/null | awk '{print $2}')
PW_MIN_AGE=$(grep "^PASS_MIN_DAYS" /etc/login.defs 2>/dev/null | awk '{print $2}')

# SSH key auth vs password
SSH_PUBKEY_AUTH=$(grep "^PubkeyAuthentication" /etc/ssh/sshd_config 2>/dev/null | \
    awk '{print $2}')
SSH_PERMIT_EMPTY=$(grep "^PermitEmptyPasswords" /etc/ssh/sshd_config 2>/dev/null | \
    awk '{print $2}')

# Son başarısız login denemeleri
FAILED_LOGINS=$(grep "Failed password" /var/log/auth.log 2>/dev/null | \
    grep "$(date +%b)" | wc -l || \
    journalctl _SYSTEMD_UNIT=sshd.service 2>/dev/null | \
    grep "Failed password" | grep "$(date +%b)" | wc -l)

# Sudo grup üyeleri
SUDO_MEMBERS=$(getent group sudo 2>/dev/null | cut -d: -f4 || \
               getent group wheel 2>/dev/null | cut -d: -f4)
```

Bash JSON çıktısına `identity` bölümünü ekle:

```bash
# Mevcut JSON'a identity bloğunu ekle (JSON oluşturma kısmını bul ve güncelle)
# identity alanını JSON'a şöyle ekle:

  "identity": {
    "mode": "$IDENTITY_MODE",
    "ad_available": $AD_AVAILABLE,
    "domain_name": "$DOMAIN_NAME",
    "total_local_users": $TOTAL_LOCAL,
    "local_users_with_shell": "$LOCAL_USERS_WITH_LOGIN",
    "system_accounts": $SYSTEM_ACCOUNTS,
    "sudo_nopasswd_entries": $SUDO_NOPASSWD,
    "sudo_all_entries": $SUDO_ALL,
    "sudo_members": "$SUDO_MEMBERS",
    "guest_account_enabled": $GUEST_ENABLED,
    "ssh_pubkey_auth": "$SSH_PUBKEY_AUTH",
    "ssh_permit_empty_passwords": "$SSH_PERMIT_EMPTY",
    "failed_logins_this_month": $FAILED_LOGINS,
    "password_policy": {
      "min_length": ${PW_MIN_LENGTH:-null},
      "complexity_classes": ${PW_COMPLEXITY:-null},
      "max_age_days": ${PW_MAX_AGE:-null},
      "min_age_days": ${PW_MIN_AGE:-null}
    }
  }
```

---

## BÖLÜM 3 — SKOR MOTORUNA YENİ KONTROLLER

`internal-scan-scorer.ts` dosyasını bul.
`calculateInternalScore()` fonksiyonuna yeni bir bölüm ekle:

```typescript
// ── AD / KİMLİK KONTROLLERİ ────────────────────────────────────────────────

const identity = data.identity;

if (identity) {

  // Domain Admin sayısı
  const domainAdminCount = identity.domain_admin_count;
  if (domainAdminCount !== null && domainAdminCount !== undefined) {
    if (domainAdminCount > 5) {
      score -= 15;
      findings.push({
        category: 'identity',
        finding: `Domain Admin sayısı: ${domainAdminCount} (kritik yüksek)`,
        severity: 'critical',
        points: 15,
        recommendation: `En fazla 2-3 Domain Admin olmalı. ${domainAdminCount - 3} hesabın yetkisi düşürülmeli.`
      });
    } else if (domainAdminCount > 3) {
      score -= 10;
      findings.push({
        category: 'identity',
        finding: `Domain Admin sayısı: ${domainAdminCount}`,
        severity: 'high',
        points: 10,
        recommendation: 'Best practice: 2 veya daha az Domain Admin. Fazla hesaplar kaldırılmalı.'
      });
    }
  }

  // Kerberoastable hesaplar
  const kerb = identity.kerberoastable_accounts;
  if (kerb !== null && kerb !== undefined && kerb > 2) {
    score -= 8;
    findings.push({
      category: 'identity',
      finding: `${kerb} Kerberoastable servis hesabı`,
      severity: 'high',
      points: 8,
      recommendation: 'SPN\'li servis hesapları güçlü parola (25+ karakter) ile korunmalı veya gMSA kullanılmalı.'
    });
  }

  // AS-REP Roastable
  const asrep = identity.asrep_roastable;
  if (asrep !== null && asrep !== undefined && asrep > 0) {
    score -= 10;
    findings.push({
      category: 'identity',
      finding: `${asrep} hesapta ön kimlik doğrulama devre dışı (AS-REP Roasting riski)`,
      severity: 'critical',
      points: 10,
      recommendation: 'Tüm kullanıcı hesaplarında "Do not require Kerberos preauthentication" kapatılmalı.'
    });
  }

  // Şifre politikası
  const pwPolicy = identity.password_policy || identity.local_policy || {};
  if (pwPolicy.min_length !== null && pwPolicy.min_length !== undefined) {
    if (pwPolicy.min_length < 8) {
      score -= 12;
      findings.push({
        category: 'identity',
        finding: `Minimum şifre uzunluğu: ${pwPolicy.min_length} karakter`,
        severity: 'critical',
        points: 12,
        recommendation: 'Minimum şifre uzunluğu en az 12 karakter olmalı. Parolalar yerine parola ifadesi (passphrase) teşvik edilmeli.'
      });
    } else if (pwPolicy.min_length < 12) {
      score -= 6;
      findings.push({
        category: 'identity',
        finding: `Minimum şifre uzunluğu: ${pwPolicy.min_length} karakter`,
        severity: 'medium',
        points: 6,
        recommendation: 'Minimum şifre uzunluğu 12\'ye yükseltilmesi önerilir.'
      });
    }
  }

  // Şifre karmaşıklığı kapalı
  if (pwPolicy.complexity_enabled === false) {
    score -= 8;
    findings.push({
      category: 'identity',
      finding: 'Şifre karmaşıklık kuralı devre dışı',
      severity: 'high',
      points: 8,
      recommendation: 'Büyük/küçük harf, rakam ve özel karakter zorunluluğu etkinleştirilmeli.'
    });
  }

  // Süresi dolmayan şifreler
  const neverExpire = identity.password_never_expires;
  if (neverExpire !== null && neverExpire !== undefined && neverExpire > 3) {
    score -= 8;
    findings.push({
      category: 'identity',
      finding: `${neverExpire} hesapta şifre süresi dolmuyor`,
      severity: 'high',
      points: 8,
      recommendation: 'Servis hesapları hariç tüm hesaplara şifre süresi uygulanmalı (90-180 gün).'
    });
  }

  // 90 günden eski hesaplar
  const staleUsers = identity.stale_users_90d;
  if (staleUsers !== null && staleUsers !== undefined && staleUsers > 5) {
    score -= 6;
    findings.push({
      category: 'identity',
      finding: `${staleUsers} hesap 90 günden fazladır giriş yapmadı`,
      severity: 'medium',
      points: 6,
      recommendation: '90 günden fazla aktif olmayan hesaplar devre dışı bırakılmalı.'
    });
  }

  // Sudo NOPASSWD (Linux)
  const sudoNoPasswd = identity.sudo_nopasswd_entries;
  if (sudoNoPasswd !== null && sudoNoPasswd !== undefined && sudoNoPasswd > 0) {
    score -= 10;
    findings.push({
      category: 'identity',
      finding: `${sudoNoPasswd} sudo kuralı şifresiz yetki veriyor (NOPASSWD)`,
      severity: 'high',
      points: 10,
      recommendation: 'NOPASSWD sudo kuralları kaldırılmalı. Tüm yetki yükseltmeleri şifre gerektirmeli.'
    });
  }

  // Guest hesabı aktif
  if (identity.guest_account_enabled === true) {
    score -= 5;
    findings.push({
      category: 'identity',
      finding: 'Guest hesabı etkin',
      severity: 'medium',
      points: 5,
      recommendation: 'Guest/misafir hesabı devre dışı bırakılmalı.'
    });
  }

  // SSH boş şifre izni (Linux)
  if (identity.ssh_permit_empty_passwords === 'yes') {
    score -= 15;
    findings.push({
      category: 'identity',
      finding: 'SSH boş şifreli girişe izin veriyor',
      severity: 'critical',
      points: 15,
      recommendation: 'sshd_config: PermitEmptyPasswords no yapılmalı. Hemen uygulanmalı.'
    });
  }

  // Geri dönüşümlü şifre şifreleme (AD)
  if (identity.password_policy?.reversible_encryption === true) {
    score -= 12;
    findings.push({
      category: 'identity',
      finding: 'AD geri dönüşümlü şifre şifreleme aktif',
      severity: 'critical',
      points: 12,
      recommendation: 'Geri dönüşümlü şifre şifreleme kapatılmalı — bu ayar şifreleri plain-text olarak saklar.'
    });
  }
}

breakdown.identity = score;
```

---

## BÖLÜM 4 — ANKET MODELİ

### 4.1 Veritabanı

```sql
CREATE TABLE IF NOT EXISTS internal_scan_surveys (
  id              serial PRIMARY KEY,
  customer_id     integer REFERENCES users(id) ON DELETE CASCADE,
  -- Yedekleme
  backup_enabled           boolean,
  backup_frequency         varchar(50),  -- daily/weekly/monthly/none
  backup_offsite           boolean,      -- off-site/cloud yedek var mı
  backup_immutable         boolean,      -- fidye yazılımına karşı değiştirilemez
  backup_last_test_date    date,         -- son test restore tarihi
  backup_rto_hours         integer,      -- hedef kurtarma süresi
  -- Olay Müdahale
  ir_plan_exists           boolean,      -- yazılı IR planı var mı
  ir_plan_last_test        date,         -- son tatbikat
  ir_team_defined          boolean,      -- sorumlular tanımlı mı
  -- Eğitim
  security_training        boolean,      -- güvenlik eğitimi veriliyor mu
  training_frequency       varchar(50),  -- annual/quarterly/adhoc/none
  phishing_simulation      boolean,      -- phishing testi yapılıyor mu
  -- Sigorta & Uyumluluk
  cyber_insurance          boolean,
  cyber_insurance_coverage_tl integer,  -- TL cinsinden
  kvkk_verbis_registered   boolean,
  kvkk_last_audit          date,
  iso_27001                boolean,
  pci_dss                  boolean,     -- kart verisi işliyorsa
  bddk_compliant           boolean,     -- finans sektörü
  -- Genel
  siem_exists              boolean,
  soc_exists               boolean,     -- SOC var mı (dış/iç)
  soc_type                 varchar(20), -- internal/external/none
  -- Metadata
  completed_at  timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
```

Drizzle schema'ya ekle, npm run db:push.

### 4.2 Anket Backend Endpoint'leri

```typescript
// GET /api/internal-scan/survey — mevcut anketi getir
router.get('/internal-scan/survey', customerAuth, async (req, res) => {
  const survey = await db.query.internalScanSurveys.findFirst({
    where: eq(internalScanSurveys.customerId, req.user.id)
  });
  res.json(survey || null);
});

// POST /api/internal-scan/survey — anketi kaydet/güncelle
router.post('/internal-scan/survey', customerAuth, async (req, res) => {
  const customerId = req.user.id;
  const data = req.body;

  // Upsert
  const existing = await db.query.internalScanSurveys.findFirst({
    where: eq(internalScanSurveys.customerId, customerId)
  });

  if (existing) {
    await db.update(internalScanSurveys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(internalScanSurveys.customerId, customerId));
  } else {
    await db.insert(internalScanSurveys).values({
      customerId, ...data
    });
  }

  // Toplam skoru güncelle — anket tamamlandı
  await updateCustomerTotalScore(customerId);

  res.json({ success: true });
});
```

### 4.3 Anket Skor Katkısı

`internal-scan-scorer.ts` içindeki `calculateInternalScore()` fonksiyonuna
survey parametresi ekle:

```typescript
// Mevcut fonksiyon imzasını güncelle:
function calculateInternalScore(
  data: any,
  survey?: any  // anket verisi opsiyonel
): InternalScoreResult {
  // ... mevcut kod ...

  // ── ANKET VERİSİ KONTROLLERİ ─────────────────────────────────────────────
  if (survey) {

    // Yedekleme
    if (survey.backup_enabled === false) {
      score -= 20;
      findings.push({
        category: 'backup',
        finding: 'Düzenli yedekleme yapılmıyor',
        severity: 'critical', points: 20,
        recommendation: 'En az günlük yedekleme politikası oluşturulmalı. 3-2-1 kuralı: 3 kopya, 2 farklı medya, 1 off-site.'
      });
    } else if (survey.backup_enabled === true) {
      if (!survey.backup_offsite) {
        score -= 8;
        findings.push({
          category: 'backup',
          finding: 'Off-site / cloud yedek yok',
          severity: 'high', points: 8,
          recommendation: 'Fidye yazılımı saldırısında lokal yedekler de şifrelenir. Off-site veya cloud yedek şart.'
        });
      }
      if (!survey.backup_immutable) {
        score -= 8;
        findings.push({
          category: 'backup',
          finding: 'Değiştirilemez (immutable) yedek yok',
          severity: 'high', points: 8,
          recommendation: 'Fidye yazılımı yedekleri de şifreleyebilir. WORM veya immutable storage kullanılmalı.'
        });
      }
      if (survey.backup_last_test_date) {
        const daysSinceTest = (Date.now() -
          new Date(survey.backup_last_test_date).getTime()) / 86400000;
        if (daysSinceTest > 180) {
          score -= 6;
          findings.push({
            category: 'backup',
            finding: `Yedek son ${Math.floor(daysSinceTest)} gündür test edilmedi`,
            severity: 'medium', points: 6,
            recommendation: 'Aylık test restore prosedürü oluşturulmalı. Çalışmayan yedek, yedek değildir.'
          });
        }
      }
    }

    // IR Planı
    if (survey.ir_plan_exists === false) {
      score -= 10;
      findings.push({
        category: 'ir_plan',
        finding: 'Yazılı olay müdahale planı yok',
        severity: 'high', points: 10,
        recommendation: 'Basit bir IR planı bile yoktan iyidir. Kim, ne zaman, nasıl müdahale eder yazılmalı.'
      });
    } else if (survey.ir_plan_exists && survey.ir_plan_last_test) {
      const daysSince = (Date.now() -
        new Date(survey.ir_plan_last_test).getTime()) / 86400000;
      if (daysSince > 365) {
        score -= 5;
        findings.push({
          category: 'ir_plan',
          finding: `IR planı ${Math.floor(daysSince/30)} aydır test edilmedi`,
          severity: 'medium', points: 5,
          recommendation: 'Yılda en az bir tatbikat yapılmalı.'
        });
      }
    }

    // Güvenlik Eğitimi
    if (survey.security_training === false) {
      score -= 8;
      findings.push({
        category: 'training',
        finding: 'Çalışan güvenlik eğitimi yok',
        severity: 'high', points: 8,
        recommendation: 'Yılda en az bir kez phishing farkındalık eğitimi zorunlu.'
      });
    }

    // KVKK
    if (survey.kvkk_verbis_registered === false) {
      score -= 10;
      findings.push({
        category: 'compliance',
        finding: 'VERBİS kaydı yok',
        severity: 'critical', points: 10,
        recommendation: 'KVKK kapsamındaki veri sorumlularının VERBİS kaydı yasal zorunluluk. İdari para cezası riski var.'
      });
    }

    // SIEM yoksa
    if (survey.siem_exists === false) {
      score -= 5;
      findings.push({
        category: 'monitoring',
        finding: 'SIEM / merkezi log toplama yok',
        severity: 'medium', points: 5,
        recommendation: 'Güvenlik olayları merkezi olarak loglanmalı. Wazuh (açık kaynak) başlangıç için uygun.'
      });
    }

    breakdown.survey = score;
  }
```

### 4.4 Upload Endpoint'ini Güncelle

`/api/internal-scan/upload` endpoint'inde survey verisini de çek:

```typescript
// calculateInternalScore çağrısını güncelle:
const survey = await db.query.internalScanSurveys.findFirst({
  where: eq(internalScanSurveys.customerId, customerId)
});

const internalScore = calculateInternalScore(scanData, survey || undefined);
```

---

## BÖLÜM 5 — MÜŞTERİ PANELİ: ANKET SAYFASI

`/hesabim/ic-tarama` sayfasına "Güvenlik Anketi" sekmesi ekle.

Sekme yapısı:
- Sekme 1: Tarama Sonuçları (mevcut)
- Sekme 2: Güvenlik Anketi (yeni)

### Anket bölümleri (her biri ayrı kart):

**1. Yedekleme Politikası**
```
Düzenli yedekleme yapıyor musunuz?           [Evet / Hayır]
Yedekleme sıklığı                             [Günlük / Haftalık / Aylık]
Off-site veya bulut yedek var mı?             [Evet / Hayır]
Değiştirilemez (immutable) yedek var mı?      [Evet / Hayır]
Son test restore tarihi                        [Tarih seçici]
Hedef kurtarma süresi (RTO) saat              [Sayı]
```

**2. Olay Müdahale**
```
Yazılı IR planı var mı?                        [Evet / Hayır]
Son tatbikat tarihi                            [Tarih seçici]
Sorumlular tanımlı mı?                        [Evet / Hayır]
```

**3. Eğitim**
```
Güvenlik eğitimi veriliyor mu?                 [Evet / Hayır]
E�itim sıklığı                                [Yıllık / Üç ayda / Sürekli / Yok]
Phishing simülasyonu yapılıyor mu?             [Evet / Hayır]
```

**4. Uyumluluk**
```
Siber sigorta var mı?                          [Evet / Hayır]
KVKK VERBİS kaydı var mı?                    [Evet / Hayır]
ISO 27001 sertifikası var mı?                  [Evet / Hayır]
SIEM / merkezi log toplama var mı?            [Evet / Hayır]
SOC var mı?                                   [İç / Dış / Yok]
```

Her kaydetmede `/api/internal-scan/survey` POST çağrılır.
Kaydedilince: "Anket kaydedildi — güvenlik skorunuz güncellendi" mesajı.

---

## TEST

1. AD ortamı olmadan PowerShell script çalıştır:
   `identity.mode` = "local_security_policy" dönmeli

2. AD ortamında çalıştır (domain joined makine):
   `identity.mode` = "active_directory" dönmeli
   `domain_admin_count`, `kerberoastable_accounts` dolu olmalı

3. Bash script Linux'ta çalıştır:
   `identity.sudo_nopasswd_entries` dolu mu?

4. Skor motoru AD verileriyle:
   - domain_admin_count: 6 → score -= 15
   - kerberoastable_accounts: 3 → score -= 8
   - asrep_roastable: 1 → score -= 10

5. Anket kaydedilince skor değişiyor mu?
   - backup_enabled: false → score -= 20
   - kvkk_verbis_registered: false → score -= 10

6. Müşteri panelinde "Güvenlik Anketi" sekmesi görünüyor mu?

7. Anket doldurulunca ve tarama sonuçları varsa `breakdown` içinde
   hem `identity` hem `survey` var mı?

---

## KISITLAR

- Mevcut cyberstep-scan.ps1 ve .sh dosyalarına EKLE — sıfırdan yazma
- Mevcut calculateInternalScore() fonksiyonuna EKLE — sıfırdan yazma
- AD modülü mevcut değilse hata fırlatma — graceful degradation
- survey parametresi opsiyonel — anket yoksa skor hesabı eskisi gibi çalışır
- ADSI fallback modunda skor düşürme yapma — veri eksik olabilir
- Tablo ve kolon isimlerini mevcut şemaya göre ayarla
- internalScanSurveys Drizzle schema adını mevcut konvansiyona uydur
