import ScannerPageClient from './ScannerPageClient';

export const dynamic = 'force-dynamic';

export default function ScannerPage() {
  const googleClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return <ScannerPageClient googleClientId={googleClientId} previewPolish />;
}
