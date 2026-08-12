#!/usr/bin/env bash
# One-time (or after code changes): deploy the weekday Cloud Run Job + Scheduler.
# Requires: gcloud auth, project set, FMP_API_KEY secret, bucket write access.
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${FIREBASE_PROJECT_ID:-onepersonempire}}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
JOB_NAME="${SCANNER_REFRESH_JOB:-scanner-daily-refresh}"
SCHEDULER_NAME="${SCANNER_REFRESH_SCHEDULER:-scanner-daily-refresh-weekdays}"
# 7:35 America/Denver = match old PC bat
SCHEDULE="${SCANNER_REFRESH_CRON:-35 7 * * 1-5}"
TIME_ZONE="${SCANNER_REFRESH_TZ:-America/Denver}"
BUCKET="${SCANNER_RESULTS_GCS_BUCKET:-${PUBLISHED_ASSETS_BUCKET:-}}"
IMAGE="${SCANNER_REFRESH_IMAGE:-gcr.io/${PROJECT_ID}/${JOB_NAME}}"
SECRET_NAME="${FMP_SECRET_NAME:-FMP_API_KEY}"

if [[ -z "$BUCKET" ]]; then
  echo "Set PUBLISHED_ASSETS_BUCKET or SCANNER_RESULTS_GCS_BUCKET before deploy." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "Project=$PROJECT_ID Region=$REGION Job=$JOB_NAME Bucket=$BUCKET"

gcloud config set project "$PROJECT_ID"

# Ensure secret exists (create empty placeholder if missing — you must set the value)
if ! gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  echo "Creating secret $SECRET_NAME (add a version with your FMP key next)..."
  gcloud secrets create "$SECRET_NAME" --replication-policy=automatic
  echo "Run: printf '%s' 'YOUR_FMP_KEY' | gcloud secrets versions add $SECRET_NAME --data-file=-"
  exit 3
fi

echo "Building image $IMAGE ..."
gcloud builds submit --tag "$IMAGE" -f jobs/scanner-refresh/Dockerfile .

SA_EMAIL="${SCANNER_REFRESH_SA:-${JOB_NAME}@${PROJECT_ID}.iam.gserviceaccount.com}"
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${JOB_NAME}" --display-name="Scanner daily refresh"
fi

# Grant bucket write + secret access
gsutil iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "gs://${BUCKET}" || true
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

# Create or update Cloud Run Job
if gcloud run jobs describe "$JOB_NAME" --region "$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB_NAME" \
    --region "$REGION" \
    --image "$IMAGE" \
    --service-account "$SA_EMAIL" \
    --set-secrets "FMP_API_KEY=${SECRET_NAME}:latest" \
    --set-env-vars "SCANNER_RESULTS_GCS_BUCKET=${BUCKET},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --memory 8Gi \
    --cpu 4 \
    --task-timeout 4h \
    --max-retries 1
else
  gcloud run jobs create "$JOB_NAME" \
    --region "$REGION" \
    --image "$IMAGE" \
    --service-account "$SA_EMAIL" \
    --set-secrets "FMP_API_KEY=${SECRET_NAME}:latest" \
    --set-env-vars "SCANNER_RESULTS_GCS_BUCKET=${BUCKET},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --memory 8Gi \
    --cpu 4 \
    --task-timeout 4h \
    --max-retries 1
fi

# Scheduler -> run job on weekdays
INVOKER_SA="$SA_EMAIL"
if gcloud scheduler jobs describe "$SCHEDULER_NAME" --location "$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$SCHEDULER_NAME" \
    --location "$REGION" \
    --schedule "$SCHEDULE" \
    --time-zone "$TIME_ZONE" \
    --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method POST \
    --oauth-service-account-email "$INVOKER_SA"
else
  gcloud scheduler jobs create http "$SCHEDULER_NAME" \
    --location "$REGION" \
    --schedule "$SCHEDULE" \
    --time-zone "$TIME_ZONE" \
    --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method POST \
    --oauth-service-account-email "$INVOKER_SA"
fi

gcloud run jobs add-iam-policy-binding "$JOB_NAME" \
  --region "$REGION" \
  --member="serviceAccount:${INVOKER_SA}" \
  --role="roles/run.invoker" >/dev/null || true

echo
echo "Deployed. Manual run now:"
echo "  gcloud run jobs execute $JOB_NAME --region $REGION"
echo "First run: seed cache from your PC once:"
echo "  gsutil -m rsync -r /path/to/Projects/stocks/data/cache gs://${BUCKET}/scanner/cache/"
