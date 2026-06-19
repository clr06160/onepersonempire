import { getGeminiTextModelNames } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    textModels: getGeminiTextModelNames(),
    gemini35FlashDisabled: true,
  });
}
