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
