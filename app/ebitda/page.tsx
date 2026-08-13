import EbitdaPageClient from './EbitdaPageClient';

export const dynamic = 'force-dynamic';

export default function EbitdaPage() {
  const googleClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return <EbitdaPageClient googleClientId={googleClientId} />;
}
