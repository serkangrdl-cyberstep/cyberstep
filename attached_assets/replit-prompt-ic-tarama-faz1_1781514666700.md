# CyberStep — İç Tarama Faz 1: Temel Envanter Scripti
## Replit Agent Promptu

---

## BAĞLAM

CyberStep şu an sadece dışarıdan tarama yapıyor.
Bu prompt iç tarama altyapısının ilk fazını kuruyor:
- Müşteri kendi ağında PowerShell veya Bash script çalıştırır
- JSON çıktı üretilir
- Platform API'sine gönderilir veya dosya olarak yüklenir
- Platform İç Tarama Skoru hesaplar, mevcut dış skorla birleştirir

Stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM + React
Yeni dosyalar oluşturulacak — mevcut koda minimum dokunuş.

---

## BÖLÜM 1 — POWERSHELL SCRIPT (Windows)

Dosya: `scripts/internal-scan/cyberstep-scan.ps1`

```powershell
<#
.SYNOPSIS
    CyberStep İç Tarama Scripti - Windows
.DESCRIPTION
    Sistemin güvenlik durumunu değerlendirir ve JSON çıktı üretir.
    Yönetici yetkisi önerilir, bazı bilgiler standart kullanıcı ile de toplanabilir.
.EXAMPLE
    .\cyberstep-scan.ps1 -CustomerId "cust_123" -ApiKey "cs_xxx" -ApiUrl "https://cyberstep.io"
    .\cyberstep-scan.ps1 -OutputFile "scan-result.json"  # Offline mod
#>

param(
    [string]$CustomerId = "",
    [string]$ApiKey = "",
    [string]$ApiUrl = "https://cyberstep.io",
    [string]$OutputFile = ""
)

$ErrorActionPreference = "SilentlyContinue"
$result = @{
    scan_type    = "internal_script_windows"
    scan_version = "1.0.0"
    scanned_at   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    customer_id  = $CustomerId
    hostname     = $env:COMPUTERNAME
    os           = @{}
    network      = @{}
    users        = @{}
    security     = @{}
    services     = @{}
    errors       = @()
}

Write-Host "CyberStep İç Tarama Başlıyor..." -ForegroundColor Cyan

# ── 1. İŞLETİM SİSTEMİ ──────────────────────────────────────────────────────
try {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $lastBoot = $os.LastBootUpTime

    $result.os = @{
        name            = $os.Caption
        version         = $os.Version
        build           = $os.BuildNumber
        architecture    = $os.OSArchitecture
        install_date    = $os.InstallDate.ToString("yyyy-MM-dd")
        last_boot       = $lastBoot.ToString("yyyy-MM-dd HH:mm")
        uptime_days     = [math]::Round(((Get-Date) - $lastBoot).TotalDays, 1)
        is_eol          = $os.Version -match "^(5\.|6\.0|6\.1)" # XP, Vista, 7
        domain_joined   = ($cs.PartOfDomain -eq $true)
        domain          = $cs.Domain
        total_ram_gb    = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
    }

    # Son yamalar
    $patches = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10
    $result.os.last_patch_date = if ($patches) { $patches[0].InstalledOn.ToString("yyyy-MM-dd") } else { $null }
    $result.os.recent_patches  = @($patches | ForEach-Object { $_.HotFixID })

    # Otomatik güncelleme
    $au = (Get-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -EA SilentlyContinue)
    $result.os.auto_update = ($au.AUOptions -eq 4)

} catch { $result.errors += "os: $_" }

# ── 2. AĞ ADAPTÖRLERI ───────────────────────────────────────────────────────
try {
    $adapters = Get-NetIPConfiguration | Where-Object { $_.IPv4Address }
    $result.network.adapters = @($adapters | ForEach-Object {
        @{
            interface = $_.InterfaceAlias
            ip        = $_.IPv4Address.IPAddress
            gateway   = $_.IPv4DefaultGateway.NextHop
        }
    })
} catch { $result.errors += "network_adapters: $_" }

# Açık portlar
try {
    $connections = Get-NetTCPConnection -State Listen
    $result.network.open_ports = @($connections | ForEach-Object {
        @{ port = $_.LocalPort; pid = $_.OwningProcess }
    } | Sort-Object { $_.port })
} catch { $result.errors += "open_ports: $_" }

# Paylaşılan klasörler
try {
    $shares = Get-SmbShare | Where-Object { $_.Name -notmatch '^\w+\$$' }
    $result.network.shares = @($shares | ForEach-Object {
        @{ name = $_.Name; path = $_.Path; description = $_.Description }
    })
} catch { $result.errors += "shares: $_" }

# ── 3. KULLANICI YÖNETİMİ ────────────────────────────────────────────────────
try {
    $localUsers = Get-LocalUser
    $result.users.local = @($localUsers | ForEach-Object {
        @{
            name        = $_.Name
            enabled     = $_.Enabled
            last_logon  = if ($_.LastLogon) { $_.LastLogon.ToString("yyyy-MM-dd") } else { $null }
            password_required = $_.PasswordRequired
        }
    })
    $result.users.local_admin_count = @(
        Get-LocalGroupMember "Administrators" -EA SilentlyContinue
    ).Count
} catch { $result.errors += "users: $_" }

# Domain kullanıcıları (domain joined ise)
if ($result.os.domain_joined) {
    try {
        $domainAdmins = Get-ADGroupMember "Domain Admins" -EA SilentlyContinue
        $result.users.domain_admin_count = if ($domainAdmins) { @($domainAdmins).Count } else { $null }

        # Password policy
        $pwPolicy = Get-ADDefaultDomainPasswordPolicy -EA SilentlyContinue
        if ($pwPolicy) {
            $result.users.password_policy = @{
                min_length      = $pwPolicy.MinPasswordLength
                complexity      = $pwPolicy.ComplexityEnabled
                max_age_days    = $pwPolicy.MaxPasswordAge.Days
                lockout_threshold = $pwPolicy.LockoutThreshold
            }
        }
    } catch { $result.errors += "domain_users: $_" }
}

# ── 4. GÜVENLİK ─────────────────────────────────────────────────────────────
try {
    # Windows Defender / AV
    $defender = Get-MpComputerStatus -EA SilentlyContinue
    if ($defender) {
        $result.security.av = @{
            name               = "Windows Defender"
            enabled            = $defender.AntivirusEnabled
            realtime_enabled   = $defender.RealTimeProtectionEnabled
            signature_date     = $defender.AntivirusSignatureLastUpdated.ToString("yyyy-MM-dd")
            signature_outdated = ($defender.AntivirusSignatureLastUpdated -lt (Get-Date).AddDays(-7))
        }
    }

    # Üçüncü parti AV kontrolü
    $avProducts = Get-CimInstance -Namespace "root/SecurityCenter2" -ClassName "AntiVirusProduct" -EA SilentlyContinue
    $result.security.av_products = @($avProducts | ForEach-Object { $_.displayName })

    # Windows Firewall
    $fw = Get-NetFirewallProfile -EA SilentlyContinue
    $result.security.firewall = @{
        domain_enabled  = ($fw | Where-Object { $_.Name -eq "Domain" }).Enabled
        private_enabled = ($fw | Where-Object { $_.Name -eq "Private" }).Enabled
        public_enabled  = ($fw | Where-Object { $_.Name -eq "Public" }).Enabled
    }

    # BitLocker
    $bl = Get-BitLockerVolume -EA SilentlyContinue
    $result.security.bitlocker = @{
        enabled = ($bl | Where-Object { $_.ProtectionStatus -eq "On" }).Count -gt 0
        volumes = @($bl | ForEach-Object {
            @{ drive = $_.MountPoint; status = $_.ProtectionStatus.ToString() }
        })
    }

    # UAC
    $uac = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -EA SilentlyContinue
    $result.security.uac_enabled = ($uac.EnableLUA -eq 1)

} catch { $result.errors += "security: $_" }

# ── 5. SERVİSLER ─────────────────────────────────────────────────────────────
try {
    # Çalışan servisler
    $services = Get-Service | Where-Object { $_.Status -eq "Running" }
    $result.services.running_count = @($services).Count

    # Kritik güvenlik servisleri
    $result.services.security_services = @{
        windows_defender  = (Get-Service "WinDefend" -EA SilentlyContinue).Status -eq "Running"
        windows_update    = (Get-Service "wuauserv" -EA SilentlyContinue).Status -eq "Running"
        event_log         = (Get-Service "EventLog" -EA SilentlyContinue).Status -eq "Running"
        remote_registry   = (Get-Service "RemoteRegistry" -EA SilentlyContinue).Status -eq "Running" # risk
        telnet            = (Get-Service "TlntSvr" -EA SilentlyContinue).Status -eq "Running" # risk
    }

    # Scheduled tasks — şüpheli olanlar
    $tasks = Get-ScheduledTask | Where-Object {
        $_.State -eq "Ready" -and $_.TaskPath -notlike "\Microsoft\*"
    }
    $result.services.custom_scheduled_tasks = @($tasks | ForEach-Object {
        @{ name = $_.TaskName; path = $_.TaskPath; state = $_.State.ToString() }
    })

} catch { $result.errors += "services: $_" }

# ── 6. DISK ─────────────────────────────────────────────────────────────────
try {
    $disks = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used }
    $result.disks = @($disks | ForEach-Object {
        @{
            drive     = $_.Name
            used_gb   = [math]::Round($_.Used / 1GB, 1)
            free_gb   = [math]::Round($_.Free / 1GB, 1)
            total_gb  = [math]::Round(($_.Used + $_.Free) / 1GB, 1)
        }
    })
} catch { $result.errors += "disks: $_" }

# ── ÇIKTI ────────────────────────────────────────────────────────────────────
$json = $result | ConvertTo-Json -Depth 8 -Compress:$false

Write-Host "Tarama Tamamlandı." -ForegroundColor Green
Write-Host "Hata sayısı: $($result.errors.Count)" -ForegroundColor $(if ($result.errors.Count -eq 0) { "Green" } else { "Yellow" })

# Dosyaya yaz
if ($OutputFile) {
    $json | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "Dosya kaydedildi: $OutputFile" -ForegroundColor Cyan
}

# API'ye gönder
if ($ApiKey -and $ApiUrl) {
    try {
        $headers = @{
            "Authorization" = "Bearer $ApiKey"
            "Content-Type"  = "application/json"
        }
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/internal-scan/upload" `
            -Method POST -Headers $headers -Body $json
        Write-Host "Platform'a gönderildi. Skor: $($response.internalScore)" -ForegroundColor Green
    } catch {
        Write-Host "API gönderimi başarısız: $_" -ForegroundColor Red
        Write-Host "Dosyayı manuel yükleyin." -ForegroundColor Yellow
    }
}

Write-Output $json
```

---

## BÖLÜM 2 — BASH SCRIPT (Linux)

Dosya: `scripts/internal-scan/cyberstep-scan.sh`

```bash
#!/bin/bash
# CyberStep İç Tarama Scripti - Linux
# Kullanım: ./cyberstep-scan.sh [--customer-id ID] [--api-key KEY] [--output FILE]

SCAN_VERSION="1.0.0"
SCANNED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HOSTNAME=$(hostname)
CUSTOMER_ID=""
API_KEY=""
API_URL="https://cyberstep.io"
OUTPUT_FILE=""

# Argümanları parse et
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --customer-id) CUSTOMER_ID="$2"; shift ;;
        --api-key) API_KEY="$2"; shift ;;
        --api-url) API_URL="$2"; shift ;;
        --output) OUTPUT_FILE="$2"; shift ;;
    esac
    shift
done

echo "CyberStep İç Tarama Başlıyor..."

# JSON builder yardımcı fonksiyon
json_str() { echo "\"$1\""; }
json_bool() { [[ "$1" == "true" || "$1" == "1" || "$1" == "yes" ]] && echo "true" || echo "false"; }

# ── 1. İŞLETİM SİSTEMİ ──────────────────────────────────────────────────────
OS_NAME=$(grep "^PRETTY_NAME" /etc/os-release 2>/dev/null | cut -d'"' -f2)
OS_VERSION=$(uname -r)
UPTIME_DAYS=$(awk '{printf "%.1f", $1/86400}' /proc/uptime 2>/dev/null)
TOTAL_RAM=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}')
LAST_PATCH=$(stat -c %y /var/lib/dpkg/info 2>/dev/null | cut -d' ' -f1 || \
             stat -c %y /var/lib/rpm/Packages 2>/dev/null | cut -d' ' -f1)

# EOL kontrolü — basit versiyon
IS_EOL="false"
[[ "$OS_VERSION" =~ ^3\. ]] && IS_EOL="true"

# ── 2. AĞ ───────────────────────────────────────────────────────────────────
OPEN_PORTS=$(ss -tuln 2>/dev/null | awk 'NR>1 {print $5}' | \
  grep -oP ':\K\d+' | sort -un | tr '\n' ',' | sed 's/,$//')

SHARES=$(grep -v "^#" /etc/exports 2>/dev/null | awk '{print $1}' | tr '\n' ',')

# ── 3. KULLANICI ─────────────────────────────────────────────────────────────
LOCAL_USERS=$(awk -F: '$3 >= 1000 && $3 < 65534 {print $1}' /etc/passwd | tr '\n' ',')
SUDO_USERS=$(grep -Po '^[^#%]\K\w+' /etc/sudoers 2>/dev/null | \
  grep -v "root" | tr '\n' ',' 2>/dev/null)
ROOT_LOGINS=$(lastlog 2>/dev/null | awk 'NR>1 && $1=="root" {print $4" "$5}')

# ── 4. GÜVENLİK ─────────────────────────────────────────────────────────────
# AV/EDR
AV_DETECTED="false"
AV_NAME="none"
command -v clamav >/dev/null 2>&1 && AV_DETECTED="true" && AV_NAME="ClamAV"
pgrep -x "falcon-sensor" >/dev/null 2>&1 && AV_DETECTED="true" && AV_NAME="CrowdStrike Falcon"
pgrep -x "ds_agent" >/dev/null 2>&1 && AV_DETECTED="true" && AV_NAME="Trend Micro"
pgrep -x "MFEcma" >/dev/null 2>&1 && AV_DETECTED="true" && AV_NAME="McAfee"
pgrep -x "symcfgd" >/dev/null 2>&1 && AV_DETECTED="true" && AV_NAME="Symantec"

# Firewall
UFW_STATUS=$(ufw status 2>/dev/null | head -1 | awk '{print $2}')
IPTABLES_RULES=$(iptables -L 2>/dev/null | wc -l)
FIREWALL_ACTIVE="false"
[[ "$UFW_STATUS" == "active" || "$IPTABLES_RULES" -gt 8 ]] && FIREWALL_ACTIVE="true"

# Disk şifreleme
LUKS_DETECTED="false"
lsblk -f 2>/dev/null | grep -q "crypto_LUKS" && LUKS_DETECTED="true"

# SELinux / AppArmor
SELINUX_STATUS=$(getenforce 2>/dev/null || echo "not_installed")
APPARMOR_STATUS=$(aa-status 2>/dev/null | head -1 || echo "not_installed")

# SSH konfigürasyonu
SSH_ROOT_LOGIN=$(grep "^PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
SSH_PASSWORD_AUTH=$(grep "^PasswordAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
SSH_PORT=$(grep "^Port" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')

# ── 5. SERVİSLER ─────────────────────────────────────────────────────────────
RUNNING_SERVICES=$(systemctl list-units --type=service --state=running 2>/dev/null | \
  grep "running" | wc -l)
FAILED_SERVICES=$(systemctl --failed 2>/dev/null | grep "failed" | wc -l)

# Cron jobs
CRON_COUNT=$(crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | wc -l)
SYSTEM_CRON=$(ls /etc/cron.d/ 2>/dev/null | tr '\n' ',')

# ── JSON ÇIKTI ───────────────────────────────────────────────────────────────
JSON=$(cat << EOF
{
  "scan_type": "internal_script_linux",
  "scan_version": "$SCAN_VERSION",
  "scanned_at": "$SCANNED_AT",
  "customer_id": "$CUSTOMER_ID",
  "hostname": "$HOSTNAME",
  "os": {
    "name": "$OS_NAME",
    "kernel": "$OS_VERSION",
    "uptime_days": $UPTIME_DAYS,
    "total_ram_gb": $TOTAL_RAM,
    "last_patch_date": "$LAST_PATCH",
    "is_eol": $IS_EOL
  },
  "network": {
    "open_ports": "$OPEN_PORTS",
    "nfs_shares": "$SHARES"
  },
  "users": {
    "local_users": "$LOCAL_USERS",
    "sudo_users": "$SUDO_USERS",
    "root_last_login": "$ROOT_LOGINS"
  },
  "security": {
    "av_detected": $AV_DETECTED,
    "av_name": "$AV_NAME",
    "firewall_active": $FIREWALL_ACTIVE,
    "luks_encryption": $LUKS_DETECTED,
    "selinux_status": "$SELINUX_STATUS",
    "ssh_root_login": "$SSH_ROOT_LOGIN",
    "ssh_password_auth": "$SSH_PASSWORD_AUTH",
    "ssh_port": "${SSH_PORT:-22}"
  },
  "services": {
    "running_count": $RUNNING_SERVICES,
    "failed_count": $FAILED_SERVICES,
    "user_cron_count": $CRON_COUNT,
    "system_cron_files": "$SYSTEM_CRON"
  }
}
EOF
)

echo "Tarama Tamamlandı."

# Dosyaya yaz
if [[ -n "$OUTPUT_FILE" ]]; then
    echo "$JSON" > "$OUTPUT_FILE"
    echo "Dosya kaydedildi: $OUTPUT_FILE"
fi

# API'ye gönder
if [[ -n "$API_KEY" ]]; then
    RESPONSE=$(curl -s -X POST "$API_URL/api/internal-scan/upload" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$JSON")
    echo "Platform yanıtı: $RESPONSE"
fi

echo "$JSON"
```

---

## BÖLÜM 3 — BACKEND: UPLOAD ENDPOINT

```typescript
// POST /api/internal-scan/upload
// Müşteri API key ile çağırır veya dosya yükler

router.post('/internal-scan/upload', customerAuth, async (req, res) => {
  const scanData = req.body;
  const customerId = req.user.id; // customerAuth middleware'den

  // Validasyon
  if (!scanData.scan_type || !scanData.scanned_at) {
    return res.status(400).json({ error: 'Geçersiz tarama verisi' });
  }

  // DB'ye kaydet
  const saved = await db.insert(internalScans).values({
    customerId,
    scanType: scanData.scan_type,
    scanVersion: scanData.scan_version,
    hostname: scanData.hostname,
    rawData: scanData, // JSONB
    scannedAt: new Date(scanData.scanned_at),
    createdAt: new Date(),
  }).returning();

  // İç tarama skoru hesapla
  const internalScore = calculateInternalScore(scanData);

  // Skoru kaydet
  await db.update(internalScans)
    .set({ internalScore: internalScore.score, scoreBreakdown: internalScore.breakdown })
    .where(eq(internalScans.id, saved[0].id));

  // Müşterinin toplam skorunu güncelle
  await updateCustomerTotalScore(customerId);

  res.json({
    success: true,
    scanId: saved[0].id,
    internalScore: internalScore.score,
    findings: internalScore.findings,
  });
});

// GET /api/internal-scan/latest — son taramayı getir
router.get('/internal-scan/latest', customerAuth, async (req, res) => {
  const scan = await db.query.internalScans.findFirst({
    where: eq(internalScans.customerId, req.user.id),
    orderBy: desc(internalScans.scannedAt),
  });
  res.json(scan);
});
```

---

## BÖLÜM 4 — İÇ TARAMA SKORU HESAPLAMA

```typescript
interface InternalScoreFinding {
  category: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  points: number;
  recommendation: string;
}

interface InternalScoreResult {
  score: number; // 0-100
  breakdown: Record<string, number>;
  findings: InternalScoreFinding[];
}

function calculateInternalScore(data: any): InternalScoreResult {
  let score = 100;
  const findings: InternalScoreFinding[] = [];
  const breakdown: Record<string, number> = {};

  // ── İŞLETİM SİSTEMİ ────────────────────────────────────────────────────
  if (data.os?.is_eol) {
    score -= 20;
    findings.push({
      category: 'os', finding: 'EOL işletim sistemi tespit edildi',
      severity: 'critical', points: 20,
      recommendation: 'Desteklenen bir OS versiyonuna yükseltme yapın — güvenlik yaması alınamıyor.'
    });
  }

  const lastPatch = data.os?.last_patch_date ? new Date(data.os.last_patch_date) : null;
  if (lastPatch) {
    const daysSincePatch = (Date.now() - lastPatch.getTime()) / 86400000;
    if (daysSincePatch > 90) {
      score -= 15;
      findings.push({
        category: 'os', finding: `Son yama ${Math.floor(daysSincePatch)} gün önce`,
        severity: 'high', points: 15,
        recommendation: 'Otomatik güncellemeyi etkinleştirin veya aylık yama sürecini başlatın.'
      });
    } else if (daysSincePatch > 30) {
      score -= 8;
      findings.push({
        category: 'os', finding: `Son yama ${Math.floor(daysSincePatch)} gün önce`,
        severity: 'medium', points: 8,
        recommendation: 'Yamalar 30 günden eski — yakında güncelleme yapılmalı.'
      });
    }
  }

  breakdown.os = score;

  // ── GÜVENLİK ─────────────────────────────────────────────────────────────
  if (!data.security?.av_detected && !data.security?.av?.enabled) {
    score -= 15;
    findings.push({
      category: 'security', finding: 'AV/EDR tespit edilmedi',
      severity: 'critical', points: 15,
      recommendation: 'Microsoft Defender for Endpoint veya CrowdStrike Falcon Go önerilir.'
    });
  }

  const fwOk = data.security?.firewall?.private_enabled ||
               data.security?.firewall_active;
  if (!fwOk) {
    score -= 10;
    findings.push({
      category: 'security', finding: 'Güvenlik duvarı kapalı',
      severity: 'high', points: 10,
      recommendation: 'Windows Firewall veya UFW etkinleştirilmeli.'
    });
  }

  const encOk = data.security?.bitlocker?.enabled ||
                data.security?.luks_encryption;
  if (!encOk) {
    score -= 10;
    findings.push({
      category: 'security', finding: 'Disk şifreleme aktif değil',
      severity: 'medium', points: 10,
      recommendation: 'BitLocker (Windows) veya LUKS (Linux) etkinleştirilmeli.'
    });
  }

  // SSH root login (Linux)
  if (data.security?.ssh_root_login === 'yes') {
    score -= 8;
    findings.push({
      category: 'security', finding: 'SSH root girişi açık',
      severity: 'high', points: 8,
      recommendation: 'sshd_config: PermitRootLogin no yapılmalı.'
    });
  }

  breakdown.security = score;

  // ── KULLANICI ─────────────────────────────────────────────────────────────
  const domainAdmins = data.users?.domain_admin_count;
  if (domainAdmins !== null && domainAdmins !== undefined && domainAdmins > 3) {
    score -= 10;
    findings.push({
      category: 'users', finding: `Domain Admin sayısı: ${domainAdmins}`,
      severity: 'high', points: 10,
      recommendation: 'Best practice: 2 veya daha az Domain Admin. Fazla hesaplar kaldırılmalı.'
    });
  }

  const localAdmins = data.users?.local_admin_count;
  if (localAdmins > 2) {
    score -= 5;
    findings.push({
      category: 'users', finding: `${localAdmins} yerel admin hesabı`,
      severity: 'medium', points: 5,
      recommendation: 'Gereksiz yerel admin hesapları kaldırılmalı veya düşürülmeli.'
    });
  }

  const pwPolicy = data.users?.password_policy;
  if (pwPolicy && pwPolicy.min_length < 8) {
    score -= 8;
    findings.push({
      category: 'users', finding: `Şifre min uzunluğu: ${pwPolicy.min_length}`,
      severity: 'high', points: 8,
      recommendation: 'Minimum şifre uzunluğu 12 karakter olarak ayarlanmalı.'
    });
  }

  breakdown.users = score;

  // ── AĞ ───────────────────────────────────────────────────────────────────
  const shares = data.network?.shares || [];
  if (shares.length > 5) {
    score -= 5;
    findings.push({
      category: 'network', finding: `${shares.length} açık ağ paylaşımı`,
      severity: 'medium', points: 5,
      recommendation: 'Kullanılmayan paylaşımlar kapatılmalı, erişim yetkileri gözden geçirilmeli.'
    });
  }

  // Riskli servisler
  const riskyServices = data.services?.security_services;
  if (riskyServices?.remote_registry) {
    score -= 5;
    findings.push({
      category: 'services', finding: 'Remote Registry servisi çalışıyor',
      severity: 'medium', points: 5,
      recommendation: 'Uzak kayıt defteri erişimi kapatılmalı (Services → RemoteRegistry → Disabled).'
    });
  }
  if (riskyServices?.telnet) {
    score -= 10;
    findings.push({
      category: 'services', finding: 'Telnet servisi aktif',
      severity: 'critical', points: 10,
      recommendation: 'Telnet şifresiz iletişim kurar. Hemen kapatılmalı, SSH kullanılmalı.'
    });
  }

  breakdown.network = score;

  return {
    score: Math.max(0, score),
    breakdown,
    findings: findings.sort((a, b) => b.points - a.points),
  };
}
```

---

## BÖLÜM 5 — VERİTABANI

```sql
CREATE TABLE IF NOT EXISTS internal_scans (
  id               serial PRIMARY KEY,
  customer_id      integer REFERENCES users(id) ON DELETE CASCADE,
  scan_type        varchar(50),         -- internal_script_windows / linux
  scan_version     varchar(20),
  hostname         varchar(200),
  internal_score   integer,             -- 0-100
  score_breakdown  jsonb,               -- kategori bazlı puanlar
  raw_data         jsonb,               -- tüm script çıktısı
  findings_count   integer,
  scanned_at       timestamp,
  created_at       timestamp DEFAULT now()
);

-- Müşteri toplam skoru için view
CREATE OR REPLACE VIEW customer_total_scores AS
SELECT
  u.id AS customer_id,
  u.email,
  ps.overall_score    AS external_score,
  i.internal_score,
  -- Ağırlıklı toplam skor: dış %60, iç %30, boş ise sadece dış
  CASE
    WHEN i.internal_score IS NOT NULL
    THEN ROUND(ps.overall_score * 0.6 + i.internal_score * 0.4)
    ELSE ps.overall_score
  END AS total_score
FROM users u
LEFT JOIN prospect_scans ps ON ps.id = (
  SELECT id FROM prospect_scans
  WHERE prospect_id = u.prospect_id
  ORDER BY scanned_at DESC LIMIT 1
)
LEFT JOIN internal_scans i ON i.id = (
  SELECT id FROM internal_scans
  WHERE customer_id = u.id
  ORDER BY scanned_at DESC LIMIT 1
);
```

Drizzle schema'ya ekle, npm run db:push.

---

## BÖLÜM 6 — MÜŞTERİ PANELİ: İÇ TARAMA SEKMESİ

Mevcut müşteri dashboard'una "İç Tarama" sekmesi ekle.

Sayfa içeriği:
```tsx
// InternalScanPage.tsx

// Eğer iç tarama yoksa:
// → İki seçenek kartı: Yöntem A (Agent) ve Yöntem B (Script)
// → Yöntem B için "Script İndir" butonu

// Eğer iç tarama varsa:
// → İç Tarama Skoru: X/100 (büyük, renkli)
// → Bulgular listesi (severity'ye göre sıralı)
// → Her bulgu için: kategori, açıklama, öneri
// → "Yeniden Tara" butonu → script indirme
// → Son tarama tarihi

function DownloadScript({ os }: { os: 'windows' | 'linux' }) {
  // Script dosyasını indirme endpoint'i
  window.location.href = `/api/internal-scan/download-script?os=${os}`;
}
```

---

## BÖLÜM 7 — SCRIPT İNDİRME ENDPOINT'İ

```typescript
// GET /api/internal-scan/download-script?os=windows|linux
router.get('/internal-scan/download-script', customerAuth, async (req, res) => {
  const os = req.query.os === 'linux' ? 'linux' : 'windows';
  const customerId = req.user.id;

  // API key ile script'i kişiselleştir
  const apiKey = req.user.apiKey; // müşterinin API key'i

  if (os === 'windows') {
    const script = generateWindowsScript(customerId, apiKey, process.env.APP_URL);
    res.setHeader('Content-Disposition', 'attachment; filename="cyberstep-scan.ps1"');
    res.setHeader('Content-Type', 'text/plain');
    res.send(script);
  } else {
    const script = generateLinuxScript(customerId, apiKey, process.env.APP_URL);
    res.setHeader('Content-Disposition', 'attachment; filename="cyberstep-scan.sh"');
    res.setHeader('Content-Type', 'text/plain');
    res.send(script);
  }
});

function generateWindowsScript(customerId: string, apiKey: string, apiUrl: string): string {
  // cyberstep-scan.ps1 içeriğini döndür, parametreler pre-filled
  return `# CyberStep İç Tarama - ${customerId}\n# Bu script otomatik yapılandırılmıştır\n\n$CustomerId = "${customerId}"\n$ApiKey = "${apiKey}"\n$ApiUrl = "${apiUrl}"\n\n# ... script içeriği`;
}
```

---

## TEST

1. PowerShell script'i test ortamında çalıştır:
   `.\cyberstep-scan.ps1 -OutputFile "test.json"`
   JSON geçerli mi?

2. Bash script test:
   `./cyberstep-scan.sh --output test.json`
   JSON geçerli mi?

3. Upload endpoint: `POST /api/internal-scan/upload` test JSON ile → skor hesaplandı mı?

4. `calculateInternalScore()` test:
   - EOL OS → score -= 20
   - AV yok → score -= 15
   - Domain Admin > 3 → score -= 10

5. Müşteri panelinde "İç Tarama" sekmesi görünüyor mu?

6. Script indirme: `GET /api/internal-scan/download-script?os=windows` → .ps1 indirildi mi?

---

## KISITLAR

- Script'ler sadece okuma yapar — hiçbir şey değiştirmez, silmez, yazmaz
- Admin yetkisi olmadan da çalışır — bazı veriler eksik olabilir, hata loglanır
- raw_data JSONB'de saklanır — ileride AI öneri motoru için kullanılacak
- calculateInternalScore() fonksiyonu ayrı dosyaya çıkar — test edilebilir olsun
- Script içindeki API key müşteriye özel — her müşteri kendi key'ini kullanır
- internal_scans tablosunda customer_id zorunlu — anonim tarama kabul edilmez
- Tablo ve kolon isimlerini mevcut şemaya göre ayarla
