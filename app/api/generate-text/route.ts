import { textModel } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const systemPrompt = "Rewrite this text to be concise and professional. Return ONLY the rewritten text. No filler.";
    
    const result = await textModel.generateContent(`${systemPrompt}\n\nText: ${prompt}`);
    return NextResponse.json({ success: true, text: result.response.text().trim() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}