import { NextResponse } from 'next/server';

export async function GET() {
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';

  return NextResponse.json({
    googleClientId,
    configured: Boolean(googleClientId),
  });
}
