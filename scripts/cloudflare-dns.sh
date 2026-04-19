#!/bin/bash
# Cloudflare DNS Manager
# Usage:
#   ./cloudflare-dns.sh add A new-subdomain 185.217.126.72
#   ./cloudflare-dns.sh delete A new-subdomain
#   ./cloudflare-dns.sh list

source /root/.openclaw/workspace/.secrets/cloudflare.env
BASE="https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID"
AUTH="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
CTYPE="Content-Type: application/json"

ACTION="${1:-list}"
TYPE="${2:-A}"
NAME="${3:-}"
CONTENT="${4:-}"

case "$ACTION" in
  list)
    curl -s -X GET "$BASE/dns_records" -H "$AUTH" -H "$CTYPE" | python3 -m json.tool
    ;;
  add)
    if [ -z "$NAME" ] || [ -z "$CONTENT" ]; then
      echo "Usage: $0 add TYPE NAME CONTENT"
      echo "  TYPE: A, CNAME, MX, TXT"
      echo "  NAME: subdomain (e.g., myapp for myapp.steppa.online)"
      echo "  CONTENT: IP or target"
      exit 1
    fi
    # Full domain name
    FULL_NAME="$NAME"
    if [ "$NAME" != "@." ] && [[ ! "$NAME" == *. ]]; then
      FULL_NAME="$NAME.steppa.online."
    fi
    curl -s -X POST "$BASE/dns_records" \
      -H "$AUTH" -H "$CTYPE" \
      -d "{\"type\":\"$TYPE\",\"name\":\"$FULL_NAME\",\"content\":\"$CONTENT\",\"ttl\":1,\"proxied\":false}" | python3 -m json.tool
    ;;
  delete)
    if [ -z "$NAME" ]; then
      echo "Usage: $0 delete TYPE NAME"
      exit 1
    fi
    FULL_NAME="$NAME"
    if [ "$NAME" != "@." ] && [[ ! "$NAME" == *. ]]; then
      FULL_NAME="$NAME.steppa.online."
    fi
    # Find the record first
    RECORD_ID=$(curl -s -X GET "$BASE/dns_records?type=$TYPE&name=$FULL_NAME" \
      -H "$AUTH" -H "$CTYPE" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['result'][0]['id'] if r['success'] and r['result'] else '')")
    if [ -z "$RECORD_ID" ]; then
      echo "❌ Record not found: $TYPE $FULL_NAME"
      exit 1
    fi
    curl -s -X DELETE "$BASE/dns_records/$RECORD_ID" \
      -H "$AUTH" -H "$CTYPE" | python3 -m json.tool
    ;;
  *)
    echo "Usage: $0 {list|add|delete} [TYPE] [NAME] [CONTENT]"
    ;;
esac
