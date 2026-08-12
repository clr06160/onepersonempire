@echo off
REM One-time on YOUR Windows PC (where gcloud already works).
REM Creates a deploy-only service account + key for Cursor Cloud Agents.
REM Then paste the JSON into Cursor Secrets — never commit the key file.

set PROJECT_ID=onepersonempire
set SA_NAME=cursor-cloud-deploy
set SA_EMAIL=%SA_NAME%@%PROJECT_ID%.iam.gserviceaccount.com
set KEY_OUT=%USERPROFILE%\cursor-cloud-deploy.json

echo Project=%PROJECT_ID%
echo Creating service account %SA_EMAIL% (safe if it already exists)...

gcloud config set project %PROJECT_ID%
gcloud iam service-accounts create %SA_NAME% --display-name="Cursor Cloud Deploy" 2>nul

echo Granting Cloud Run / Cloud Build deploy roles...
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/run.admin" --condition=None
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/iam.serviceAccountUser" --condition=None
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/cloudbuild.builds.editor" --condition=None
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/artifactregistry.writer" --condition=None
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/storage.admin" --condition=None

echo Writing key to %KEY_OUT%
gcloud iam service-accounts keys create "%KEY_OUT%" --iam-account=%SA_EMAIL%

echo.
echo DONE. Next (in browser, not chat):
echo   1. Open https://cursor.com/dashboard/cloud-agents
echo   2. Secrets → add Runtime Secret  GCP_SA_KEY  = paste entire JSON from %KEY_OUT%
echo   3. Secrets → add                GCP_PROJECT_ID = %PROJECT_ID%
echo   4. Start a NEW cloud agent (or restart) so secrets load
echo   5. Tell the agent:  bash scripts/deploy-cloud-run.sh
echo.
echo Keep %KEY_OUT% private. Do not commit it.
pause
