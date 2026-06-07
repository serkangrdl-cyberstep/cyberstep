#!/usr/bin/env bash
set -euo pipefail

if [ -z "${HUNTER_API_KEY:-}" ]; then echo "HATA: HUNTER_API_KEY yok"; exit 1; fi
if [ -z "${DATABASE_URL:-}" ]; then echo "HATA: DATABASE_URL yok"; exit 1; fi

echo "Qualified leads çekiliyor..."
DOMAINS=$(psql "$DATABASE_URL" -t -A -c "SELECT id||'|'||domain FROM lead_candidates WHERE is_qualified = true AND (contact_email IS NULL OR contact_email = '') ORDER BY risk_score DESC;")

if [ -z "$DOMAINS" ]; then echo "İşlenecek aday yok."; exit 0; fi

FOUND=0; EMPTY=0; ERROR=0

while IFS='|' read -r ID DOMAIN; do
  [ -z "$ID" ] && continue

  echo -n "[$DOMAIN] sorgulanıyor... "

  RESPONSE=$(curl -sf --max-time 10 \
    "https://api.hunter.io/v2/domain-search?domain=${DOMAIN}&api_key=${HUNTER_API_KEY}&type=professional&limit=5" \
    2>/dev/null || echo "ERROR")

  if [ "$RESPONSE" = "ERROR" ]; then
    echo "HATA"
    ERROR=$((ERROR+1))
    sleep 1
    continue
  fi

  EMAIL=$(echo "$RESPONSE" | jq -r '.data.emails[0].value // empty' 2>/dev/null)
  FIRST=$(echo "$RESPONSE" | jq -r '.data.emails[0].first_name // empty' 2>/dev/null)
  LAST=$(echo "$RESPONSE" | jq -r '.data.emails[0].last_name // empty' 2>/dev/null)
  TITLE=$(echo "$RESPONSE" | jq -r '.data.emails[0].position // empty' 2>/dev/null)
  NAME=$(echo "$FIRST $LAST" | xargs)

  if [ -z "$EMAIL" ]; then
    echo "boş"
    EMPTY=$((EMPTY+1))
    sleep 0.3
    continue
  fi

  psql "$DATABASE_URL" -q -c \
    "UPDATE lead_candidates SET contact_email='$EMAIL', contact_name='$NAME', contact_title='$TITLE', contact_source='hunter', updated_at=NOW() WHERE id='$ID';"

  echo "OK → $EMAIL ($NAME)"
  FOUND=$((FOUND+1))
  sleep 0.4

done <<< "$DOMAINS"

echo ""
echo "─────────────────────────────"
echo "Tamamlandı: bulundu=$FOUND, boş=$EMPTY, hata=$ERROR"
