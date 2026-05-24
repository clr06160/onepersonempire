import { imageModel } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const result = await imageModel.generateContent(prompt);
    const part = result.response.candidates?.[0]?.content?.parts?.[0];

    if (part && 'inlineData' in part) {
      return NextResponse.json({ 
        success: true, 
        dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` 
      });
    }
    throw new Error("No image data");
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}