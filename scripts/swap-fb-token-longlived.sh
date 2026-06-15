#!/usr/bin/env bash
# Exchange the current short-lived FB_PAGE_ACCESS_TOKEN for a never-expiring
# long-lived Page Access Token, then deploy it to Supabase secrets.
#
# Usage:
#   APP_SECRET="paste-your-app-secret-here" ./scripts/swap-fb-token-longlived.sh
#
# Get App Secret from:
#   https://developers.facebook.com/apps/1261783632746028/settings/basic/
#   (click "Show" next to App Secret, then copy)
#
# This script:
#   1. Reads current short-lived USER token from Supabase secrets... actually
#      we need a User token here, not a Page token. Easier path: re-run
#      /me/accounts to get a fresh Page token from your short-lived User
#      token. But the User token is also short-lived. So:
#
#   Real flow:
#   1. Exchange your current short-lived USER token (from Graph API Explorer
#      session) for a long-lived USER token (60 days) via fb_exchange_token.
#   2. Use that long-lived USER token to fetch a new Page token via
#      /me/accounts — that Page token is now never-expiring.
#   3. Deploy the never-expiring Page token to FB_PAGE_ACCESS_TOKEN.
#
# Why never-expiring: when you exchange a long-lived User token for a Page
# token, FB returns a Page token that doesn't expire (until you revoke).
#
# You must paste your CURRENT short-lived USER token below before running.
# Get it from https://developers.facebook.com/tools/explorer/ (the User
# Token, not the Page Token — click the User/Page dropdown to switch).

set -euo pipefail

APP_ID="1261783632746028"
SUPABASE_PROJECT_REF="exigoosajrdbqjqtricl"
PAGE_ID="1004538636077014"

if [[ -z "${APP_SECRET:-}" ]]; then
  echo "ERROR: APP_SECRET env var not set."
  echo "Run as: APP_SECRET='your-app-secret' $0"
  echo "Get App Secret from https://developers.facebook.com/apps/$APP_ID/settings/basic/"
  exit 1
fi

read -r -p "Paste your CURRENT short-lived User Token (from Graph API Explorer): " SHORT_USER_TOKEN
echo

if [[ -z "$SHORT_USER_TOKEN" ]]; then
  echo "ERROR: No token pasted."
  exit 1
fi

echo "→ Exchanging User Token for long-lived User Token..."
LONG_USER_TOKEN=$(curl -s "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_USER_TOKEN}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('access_token') or 'ERROR: '+json.dumps(d))")

if [[ "$LONG_USER_TOKEN" == ERROR* ]]; then
  echo "$LONG_USER_TOKEN"
  exit 1
fi

echo "  ✓ Got long-lived User Token (60-day)"

echo "→ Fetching never-expiring Page Token for Reliable Turf..."
LONG_PAGE_TOKEN=$(curl -s "https://graph.facebook.com/v21.0/me/accounts?access_token=${LONG_USER_TOKEN}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
for p in d.get('data', []):
    if p['id'] == '$PAGE_ID':
        print(p['access_token'])
        sys.exit(0)
print('ERROR: Reliable Turf page not in /me/accounts')
sys.exit(1)
")

if [[ "$LONG_PAGE_TOKEN" == ERROR* ]]; then
  echo "$LONG_PAGE_TOKEN"
  exit 1
fi

echo "  ✓ Got never-expiring Page Token"

echo "→ Verifying token has all required scopes..."
SCOPES=$(curl -s "https://graph.facebook.com/v21.0/me/permissions?access_token=${LONG_PAGE_TOKEN}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(p['permission'] for p in d.get('data',[]) if p['status']=='granted'))")
echo "  scopes: $SCOPES"

REQUIRED=("leads_retrieval" "pages_read_engagement" "pages_manage_metadata" "pages_messaging")
MISSING=()
for s in "${REQUIRED[@]}"; do
  if [[ ! "$SCOPES" == *"$s"* ]]; then
    MISSING+=("$s")
  fi
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "⚠️  Missing required scopes: ${MISSING[*]}"
  echo "    Token will partially work but some features may fail."
fi

echo "→ Deploying to Supabase as FB_PAGE_ACCESS_TOKEN..."
cd "$(dirname "$0")/.."
supabase secrets set FB_PAGE_ACCESS_TOKEN="$LONG_PAGE_TOKEN" --project-ref "$SUPABASE_PROJECT_REF"

echo
echo "✅ Done. Reliable Turf now has a never-expiring Page Access Token."
echo "   Ad pipeline can run indefinitely without token rotation."
