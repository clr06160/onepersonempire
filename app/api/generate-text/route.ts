import { generateTextWithFallback } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const systemPrompt = `You are editing one piece of website copy.
Follow the user's instruction exactly.
Preserve the original subject, offer, and important details.
If the text is a paragraph, keep it as a useful paragraph and do not collapse it into a slogan.
If the text is a button label, keep it short.
Return ONLY the rewritten text. No quotes. No explanations.`;
    
    const result = await generateTextWithFallback(`${systemPrompt}\n\nText: ${prompt}`);
    return NextResponse.json({ success: true, text: result.text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Text generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}