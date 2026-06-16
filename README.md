# OnePerson Empire

AI business-launch builder for generating, editing, and publishing sellable landing pages.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment

Copy `.env.example` to `.env.local` and fill in the values you need.

For local Firestore publishing with a service-account JSON key:

```env
PUBLISH_STORAGE=firestore
FIREBASE_PROJECT_ID=your-google-cloud-project-id
FIRESTORE_DATABASE_ID=your-firestore-database-id
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/CoryRoberts/keysie/your-service-account.json
PUBLISHED_ASSETS_BUCKET=your-cloud-storage-bucket-name
```

Do not commit `.env.local` or service-account JSON keys.

## Deploy to Google Cloud Run

Prerequisites:

- Google Cloud project with billing enabled
- Firestore database created
- Cloud Storage bucket created for published assets
- Service account with Firestore access and `Storage Object Admin` on the bucket
- Google Cloud CLI installed and authenticated

Set variables in your terminal:

```bash
PROJECT_ID="your-google-cloud-project-id"
REGION="us-central1"
SERVICE_NAME="onepersonempire"
SERVICE_ACCOUNT="your-service-account@${PROJECT_ID}.iam.gserviceaccount.com"
FIRESTORE_DATABASE_ID="your-firestore-database-id"
PUBLISHED_ASSETS_BUCKET="your-cloud-storage-bucket-name"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_TEXT_MODEL="gemini-2.5-flash"
GEMINI_TEXT_FALLBACK_MODELS="gemini-2.0-flash,gemini-1.5-flash"
STRIPE_SECRET_KEY="your-stripe-secret-key"
```

Deploy from source:

```bash
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --set-env-vars "PUBLISH_STORAGE=firestore,FIRESTORE_DATABASE_ID=$FIRESTORE_DATABASE_ID,PUBLISHED_ASSETS_BUCKET=$PUBLISHED_ASSETS_BUCKET,GEMINI_API_KEY=$GEMINI_API_KEY,GEMINI_TEXT_MODEL=$GEMINI_TEXT_MODEL,GEMINI_TEXT_FALLBACK_MODELS=$GEMINI_TEXT_FALLBACK_MODELS,STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"
```

PowerShell version:

```powershell
$PROJECT_ID="your-google-cloud-project-id"
$REGION="us-central1"
$SERVICE_NAME="onepersonempire"
$SERVICE_ACCOUNT="your-service-account@$PROJECT_ID.iam.gserviceaccount.com"
$FIRESTORE_DATABASE_ID="your-firestore-database-id"
$PUBLISHED_ASSETS_BUCKET="your-cloud-storage-bucket-name"
$GEMINI_API_KEY="your-gemini-api-key"
$GEMINI_TEXT_MODEL="gemini-2.5-flash"
$GEMINI_TEXT_FALLBACK_MODELS="gemini-2.0-flash,gemini-1.5-flash"
$STRIPE_SECRET_KEY="your-stripe-secret-key"

gcloud run deploy $SERVICE_NAME `
  --source . `
  --project $PROJECT_ID `
  --region $REGION `
  --service-account $SERVICE_ACCOUNT `
  --allow-unauthenticated `
  --set-env-vars "PUBLISH_STORAGE=firestore,FIRESTORE_DATABASE_ID=$FIRESTORE_DATABASE_ID,PUBLISHED_ASSETS_BUCKET=$PUBLISHED_ASSETS_BUCKET,GEMINI_API_KEY=$GEMINI_API_KEY,GEMINI_TEXT_MODEL=$GEMINI_TEXT_MODEL,GEMINI_TEXT_FALLBACK_MODELS=$GEMINI_TEXT_FALLBACK_MODELS,STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"
```

On Cloud Run, do not set `GOOGLE_APPLICATION_CREDENTIALS`; Cloud Run uses the attached service account automatically.

When testing from `localhost` but generating customer-facing links for a deployed app, set:

```env
PUBLISH_PUBLIC_BASE_URL=https://onepersonempire.web.app
```

## SMS / WhatsApp CMS

Published sites can be updated through a webhook at `/api/sms-cms`. Connect a Twilio SMS or WhatsApp number to:

```text
https://your-domain.com/api/sms-cms?secret=your-secret
```

Example owner messages:

```text
site coffee-shop change the headline to Fresh roasted coffee delivered weekly
site coffee-shop change the monthly price to $39
site coffee-shop replace the hero photo with https://example.com/coffee.jpg
site coffee-shop add this photo as latest work
site coffee-shop invoice 250 gutter cleaning
site coffee-shop invoice Sarah 1200 interior painting deposit
site coffee-shop invoice 801-555-1212 250 gutter cleaning
site coffee-shop invoice 250 gutter cleaning to 801-555-1212
```

For local or single-site demos, set `SMS_CMS_DEFAULT_SLUG` so messages can omit the `site coffee-shop` prefix.

Set `SMS_CMS_SECRET` in production so random visitors cannot edit a site by guessing its slug.

By default, invoice commands create a pay-ready invoice link and reply to the owner with that link. Automatic customer SMS delivery is optional and should stay off until Twilio A2P/SMS delivery is configured:

```env
TWILIO_AUTO_SEND_INVOICES=false
```

## Private Stock Scanner

The protected scanner shell lives at `/scanner`.

It uses Google sign-in plus an allowlist, not a shared password. Add viewer accounts to `SCANNER_ALLOWED_EMAILS` and developer accounts to `SCANNER_DEVELOPER_EMAILS`.

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
SCANNER_AUTH_SECRET=use-a-long-random-string
SCANNER_ALLOWED_EMAILS=friend@example.com
SCANNER_DEVELOPER_EMAILS=coder@example.com
SCANNER_RESULTS_JSON_PATH=
```

Developer accounts can reach the developer-tools API. Code downloads are intentionally disabled until a safe package excludes secrets, `.env` files, cache files, and API keys.

Invoice pages support simple payment choices without integrating every processor:

```env
DEFAULT_PAYMENT_QR_IMAGE_URL=https://example.com/venmo-or-local-payment-qr.png
DEFAULT_PAYMENT_QR_LABEL=Scan to pay with Venmo
DEFAULT_PAYMENT_INSTRUCTIONS=Venmo: @your-business-name
```

The card/payment-link option comes from the payment link configured on the site's payment button.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
