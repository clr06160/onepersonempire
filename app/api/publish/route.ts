import { generateTextWithFallback } from '@/lib/gemini';
import { publishSite } from '@/lib/published-sites';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SafetyReview = {
  status: 'approved' | 'blocked' | 'needs_review';
  reason: string;
  checkedAt: string;
};

function getPublicOrigin(req: NextRequest) {
  if (process.env.PUBLISH_PUBLIC_BASE_URL) {
    return process.env.PUBLISH_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');

  return host ? `${protocol}://${host}` : req.nextUrl.origin;
}

function stripHtml(value: string) {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function reviewPublishSafety(input: {
  idea: string;
  html: string;
}): Promise<SafetyReview> {
  const text = stripHtml(input.html).slice(0, 8000);
  const prompt = `You are a website publishing safety reviewer.

Review whether this website appears to promote illegal, harmful, fraudulent, or clearly prohibited commercial activity.

Block only clear/high-confidence issues, such as:
- illegal drugs or controlled substances
- weapons sales or instructions to harm
- scams, phishing, fraud, stolen goods, fake documents
- sexual exploitation or adult services involving coercion/minors
- explicit criminal services

Do not block ordinary local businesses, medical clinics, legal services, alcohol-adjacent restaurants/bars, or ambiguous harmless content.

Return ONLY compact JSON:
{"status":"approved"|"blocked"|"needs_review","reason":"short reason"}

Original business prompt:
${input.idea || '(none)'}

Website text:
${text}`;

  try {
    const { text: result } = await generateTextWithFallback(prompt, { maxOutputTokens: 200 });
    const parsed = JSON.parse(result.replace(/```json/gi, '').replace(/```/g, '').trim()) as {
      status?: string;
      reason?: string;
    };
    const status: SafetyReview['status'] =
      parsed.status === 'blocked' || parsed.status === 'needs_review' ? parsed.status : 'approved';
    return {
      status,
      reason: String(parsed.reason || 'No issue found.').slice(0, 500),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'needs_review' as const,
      reason: error instanceof Error ? `Safety review failed: ${error.message}` : 'Safety review failed.',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { slug, html, idea } = await req.json();
    const safetyReview = await reviewPublishSafety({
      idea: typeof idea === 'string' ? idea : '',
      html: typeof html === 'string' ? html : '',
    });
    const publishSafetyReview: SafetyReview = {
      status: safetyReview.status,
      reason: safetyReview.reason,
      checkedAt: safetyReview.checkedAt,
    };

    if (safetyReview.status === 'blocked') {
      return NextResponse.json({
        error: `This site cannot be published: ${safetyReview.reason}`,
        safetyReview: publishSafetyReview,
      }, { status: 400 });
    }

    const site = await publishSite({
      slug: typeof slug === 'string' ? slug : '',
      html: typeof html === 'string' ? html : '',
      idea: typeof idea === 'string' ? idea : undefined,
      safetyReview: publishSafetyReview,
    });

    const url = new URL(`/s/${site.slug}`, getPublicOrigin(req));
    return NextResponse.json({
      slug: site.slug,
      url: url.toString(),
      updatedAt: site.updatedAt,
      assetCount: site.assetCount || 0,
      chunkCount: site.chunkCount || 0,
      safetyReview: publishSafetyReview,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
