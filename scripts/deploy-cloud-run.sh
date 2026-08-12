#!/usr/bin/env bash
# Non-interactive Cloud Run deploy for Cursor cloud agents (and local SA use).
# Same effect as the old desktop-agent flow: deploy without browser login.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcloud-activate-from-secrets.sh
source "${ROOT}/scripts/gcloud-activate-from-secrets.sh"

REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-onepersonempire}"

cd "${ROOT}"
echo "Deploying ${SERVICE} from $(pwd) → ${REGION}"
gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --allow-unauthenticated \
  --quiet

echo "Deploy finished. Verify:"
echo "  https://dreamtreestocks.com/scanner"
echo "  https://dreamtreestocks.com/scanner/fun"
echo "  https://dreamtreestocks.com/scanner/ledger"
