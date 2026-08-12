#!/usr/bin/env bash
# Activate gcloud from Cursor Cloud Secrets (no browser login).
# Required secrets (Cursor Dashboard → Cloud Agents → Secrets):
#   GCP_SA_KEY      — full service-account JSON (Runtime Secret)
#   GCP_PROJECT_ID  — e.g. onepersonempire (optional if JSON has project_id)
set -euo pipefail

if ! command -v gcloud >/dev/null 2>&1; then
  if [[ -x "$HOME/google-cloud-sdk-root/google-cloud-sdk/bin/gcloud" ]]; then
    export PATH="$HOME/google-cloud-sdk-root/google-cloud-sdk/bin:$PATH"
  else
    echo "gcloud not installed. Environment install should provide it." >&2
    exit 1
  fi
fi

KEY_FILE="${GOOGLE_APPLICATION_CREDENTIALS:-}"
if [[ -n "${KEY_FILE}" && -f "${KEY_FILE}" ]]; then
  :
elif [[ -n "${GCP_SA_KEY:-}" ]]; then
  KEY_FILE="${HOME}/.config/gcloud/cursor-cloud-sa.json"
  mkdir -p "$(dirname "$KEY_FILE")"
  # Secret may be raw JSON or a path to a JSON file.
  if [[ -f "${GCP_SA_KEY}" ]]; then
    cp "${GCP_SA_KEY}" "${KEY_FILE}"
  else
    printf '%s\n' "${GCP_SA_KEY}" > "${KEY_FILE}"
  fi
  chmod 600 "${KEY_FILE}"
  export GOOGLE_APPLICATION_CREDENTIALS="${KEY_FILE}"
else
  echo "Missing GCP_SA_KEY (or GOOGLE_APPLICATION_CREDENTIALS)." >&2
  echo "Add the service-account JSON as a Cursor Cloud Runtime Secret named GCP_SA_KEY." >&2
  echo "One-time PC setup: scripts/setup-cursor-deploy-sa.bat" >&2
  exit 1
fi

gcloud auth activate-service-account --key-file="${KEY_FILE}" --quiet

PROJECT_ID="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID="$(python3 -c 'import json,os; print(json.load(open(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])).get("project_id",""))' 2>/dev/null || true)"
fi
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Set GCP_PROJECT_ID secret (e.g. onepersonempire)." >&2
  exit 1
fi

gcloud config set project "${PROJECT_ID}" --quiet
export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"
echo "gcloud ready as service account on project ${PROJECT_ID}"
