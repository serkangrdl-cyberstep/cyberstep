#!/bin/bash
# CyberStep İç Tarama Scripti - Linux
# Kullanım: ./cyberstep-scan.sh [--customer-id ID] [--api-key KEY] [--output FILE]

SCAN_VERSION="1.0.0"
SCANNED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HOSTNAME_VAL=$(hostname)
CUSTOMER_ID="{{CUSTOMER_ID}}"
API_KEY="{{API_KEY}}"
API_URL="{{API_URL}}"
OUTPUT_FILE=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --customer-id) CUSTOMER_ID="$2"; shift ;;
        --api-key)     API_KEY="$2";     shift ;;
        --api-url)     API_URL="$2";     shift ;;
        --output)      OUTPUT_FILE="$2"; shift ;;
    esac
    shift
done

echo "CyberStep İç Tarama Başlıyor..."

# -- 1. İŞLETİM SİSTEMİ -------------------------------------------------------
OS_NAME=$(grep "^PRETTY_NAME" /etc/os-release 2>/dev/null | cut -d'"' -f2)
OS_KERNEL=$(uname -r)
UPTIME_DAYS=$(awk '{printf "%.1f", $1/86400}' /proc/uptime 2>/dev/null || echo "0")
TOTAL_RAM=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo "0")
LAST_PATCH=$(stat -c %y /var/lib/dpkg/info 2>/dev/null | cut -d' ' -f1 || \
             stat -c %y /var/lib/rpm/Packages 2>/dev/null | cut -d' ' -f1 || echo "")
IS_EOL="false"
[[ "$OS_KERNEL" =~ ^3\. ]] && IS_EOL="true"

# -- 2. AĞ -------------------------------------------------------------------
OPEN_PORTS=$(ss -tuln 2>/dev/null | awk 'NR>1 {print $5}' | grep -oP ':\K\d+' | sort -un | tr '\n' ',' | sed 's/,$//')
SHARES=$(grep -v "^#" /etc/exports 2>/dev/null | awk '{print $1}' | tr '\n' ',' | sed 's/,$//')

# -- 3. KULLANICI -------------------------------------------------------------
LOCAL_USERS=$(awk -F: '$3 >= 1000 && $3 < 65534 {print $1}' /etc/passwd 2>/dev/null | tr '\n' ',' | sed 's/,$//')
SUDO_USERS=$(grep -Po '^[^#%]\K\w+' /etc/sudoers 2>/dev/null | grep -v "root" | tr '\n' ',' | sed 's/,$//')

# -- 4. GÜVENLİK -------------------------------------------------------------
AV_DETECTED="false"
AV_NAME="none"
command -v clamav >/dev/null 2>&1          && AV_DETECTED="true" && AV_NAME="ClamAV"
pgrep -x "falcon-sensor" >/dev/null 2>&1   && AV_DETECTED="true" && AV_NAME="CrowdStrike Falcon"
pgrep -x "ds_agent"      >/dev/null 2>&1   && AV_DETECTED="true" && AV_NAME="Trend Micro"
pgrep -x "MFEcma"        >/dev/null 2>&1   && AV_DETECTED="true" && AV_NAME="McAfee"
pgrep -x "symcfgd"       >/dev/null 2>&1   && AV_DETECTED="true" && AV_NAME="Symantec"

UFW_STATUS=$(ufw status 2>/dev/null | head -1 | awk '{print $2}')
IPTABLES_RULES=$(iptables -L 2>/dev/null | wc -l || echo "0")
FIREWALL_ACTIVE="false"
[[ "$UFW_STATUS" == "active" || "$IPTABLES_RULES" -gt 8 ]] && FIREWALL_ACTIVE="true"

LUKS_DETECTED="false"
lsblk -f 2>/dev/null | grep -q "crypto_LUKS" && LUKS_DETECTED="true"

SELINUX_STATUS=$(getenforce 2>/dev/null || echo "not_installed")
SSH_ROOT_LOGIN=$(grep "^PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "")
SSH_PASSWORD_AUTH=$(grep "^PasswordAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "")
SSH_PORT=$(grep "^Port" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "22")

# -- 5. SERVİSLER -------------------------------------------------------------
RUNNING_SERVICES=$(systemctl list-units --type=service --state=running 2>/dev/null | grep "running" | wc -l || echo "0")
FAILED_SERVICES=$(systemctl --failed 2>/dev/null | grep "failed" | wc -l || echo "0")
CRON_COUNT=$(crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | wc -l || echo "0")
SYSTEM_CRON=$(ls /etc/cron.d/ 2>/dev/null | tr '\n' ',' | sed 's/,$//')

# -- 7. KİMLİK & ERİŞİM -------------------------------------------------------
IDENTITY_MODE="local"
AD_AVAILABLE="false"
DOMAIN_NAME=""
DOMAIN_ADMIN_COUNT="null"
TOTAL_USERS_AD="null"
STALE_USERS="null"
PW_MIN_LENGTH="null"
PW_COMPLEXITY="null"
PW_MAX_AGE="null"
PW_MIN_AGE="null"
SUDO_NOPASSWD=0
SUDO_ALL=0
GUEST_ENABLED="false"
SSH_PUBKEY_AUTH=""
SSH_PERMIT_EMPTY=""
FAILED_LOGINS=0
SUDO_MEMBERS=""

# Realm / SSSD ile domain bağlantısı kontrol et
if command -v realm >/dev/null 2>&1; then
    REALM_STATUS=$(realm list 2>/dev/null | head -1)
    if [[ -n "$REALM_STATUS" ]]; then
        AD_AVAILABLE="true"
        IDENTITY_MODE="realm"
        DOMAIN_NAME=$(realm list 2>/dev/null | grep "domain-name" | awk '{print $2}')
        if command -v getent >/dev/null 2>&1; then
            TOTAL_USERS_AD=$(getent passwd 2>/dev/null | awk -F: '$3 >= 1000 && $3 < 65534' | wc -l)
        fi
        DOMAIN_ADMIN_COUNT=$(grep -c "^%" /etc/sudoers 2>/dev/null || echo 0)
    fi
elif wbinfo -t 2>/dev/null; then
    AD_AVAILABLE="true"
    IDENTITY_MODE="winbind"
    DOMAIN_NAME=$(wbinfo --own-domain 2>/dev/null || echo "")
fi

# Yerel kullanıcı analizi
LOCAL_USERS_WITH_LOGIN=$(awk -F: '$3 >= 1000 && $3 < 65534 && $7 !~ /nologin|false/ {print $1}' \
    /etc/passwd 2>/dev/null | tr '\n' ',' | sed 's/,$//')
TOTAL_LOCAL=$(awk -F: '$3 >= 1000 && $3 < 65534' /etc/passwd 2>/dev/null | wc -l)
SYSTEM_ACCOUNTS=$(awk -F: '$3 < 1000 && $3 > 0' /etc/passwd 2>/dev/null | wc -l)

# Sudo NOPASSWD
SUDO_NOPASSWD=$(grep -r "NOPASSWD" /etc/sudoers /etc/sudoers.d/ 2>/dev/null | grep -v "^#" | wc -l || echo 0)
SUDO_ALL=$(grep -r "ALL=(ALL" /etc/sudoers /etc/sudoers.d/ 2>/dev/null | grep -v "^#" | wc -l || echo 0)

# Guest hesabı
id "guest" >/dev/null 2>&1 && GUEST_ENABLED="true"

# PAM şifre politikası
PW_MIN_LENGTH=$(grep "^minlen" /etc/security/pwquality.conf 2>/dev/null | awk '{print $3}')
PW_COMPLEXITY=$(grep "^minclass" /etc/security/pwquality.conf 2>/dev/null | awk '{print $3}')
PW_MAX_AGE=$(grep "^PASS_MAX_DAYS" /etc/login.defs 2>/dev/null | awk '{print $2}')
PW_MIN_AGE=$(grep "^PASS_MIN_DAYS" /etc/login.defs 2>/dev/null | awk '{print $2}')

# SSH
SSH_PUBKEY_AUTH=$(grep "^PubkeyAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
SSH_PERMIT_EMPTY=$(grep "^PermitEmptyPasswords" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')

# Başarısız login denemeleri (bu ay)
FAILED_LOGINS=$(grep "Failed password" /var/log/auth.log 2>/dev/null | \
    grep "$(date +%b)" | wc -l 2>/dev/null || \
    journalctl _SYSTEMD_UNIT=sshd.service 2>/dev/null | \
    grep "Failed password" | grep "$(date +%b)" | wc -l 2>/dev/null || echo 0)

# Sudo grup üyeleri
SUDO_MEMBERS=$(getent group sudo 2>/dev/null | cut -d: -f4 || \
               getent group wheel 2>/dev/null | cut -d: -f4 || echo "")

# JSON için null-safe değerler
PW_MIN_LENGTH_JSON=${PW_MIN_LENGTH:-null}
PW_COMPLEXITY_JSON=${PW_COMPLEXITY:-null}
PW_MAX_AGE_JSON=${PW_MAX_AGE:-null}
PW_MIN_AGE_JSON=${PW_MIN_AGE:-null}
DOMAIN_ADMIN_COUNT_JSON=${DOMAIN_ADMIN_COUNT:-null}
TOTAL_USERS_AD_JSON=${TOTAL_USERS_AD:-null}

# -- JSON ÇIKTI ---------------------------------------------------------------
JSON=$(cat << ENDJSON
{
  "scan_type": "internal_script_linux",
  "scan_version": "$SCAN_VERSION",
  "scanned_at": "$SCANNED_AT",
  "customer_id": "$CUSTOMER_ID",
  "hostname": "$HOSTNAME_VAL",
  "os": {
    "name": "$OS_NAME",
    "kernel": "$OS_KERNEL",
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
    "sudo_users": "$SUDO_USERS"
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
  },
  "identity": {
    "mode": "$IDENTITY_MODE",
    "ad_available": $AD_AVAILABLE,
    "domain_name": "$DOMAIN_NAME",
    "domain_admin_count": $DOMAIN_ADMIN_COUNT_JSON,
    "total_ad_users": $TOTAL_USERS_AD_JSON,
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
      "min_length": $PW_MIN_LENGTH_JSON,
      "complexity_classes": $PW_COMPLEXITY_JSON,
      "max_age_days": $PW_MAX_AGE_JSON,
      "min_age_days": $PW_MIN_AGE_JSON
    }
  }
}
ENDJSON
)

echo "Tarama Tamamlandı."

if [[ -n "$OUTPUT_FILE" ]]; then
    echo "$JSON" > "$OUTPUT_FILE"
    echo "Dosya kaydedildi: $OUTPUT_FILE"
fi

if [[ -n "$API_KEY" && "$API_KEY" != "{{API_KEY}}" ]]; then
    RESPONSE=$(curl -s -X POST "$API_URL/api/internal-scan/upload" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$JSON")
    echo "Platform yanıtı: $RESPONSE"
fi

echo "$JSON"
