import { generateWebsiteImageDataUrl } from '@/lib/nano-banana';
import { NextResponse } from 'next/server';

export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const { prompt, idea, imageIndex, altText, imageBrief, sectionText } = await req.json();
    const dataUrl = await generateWebsiteImageDataUrl({
      prompt,
      idea,
      imageIndex,
      altText,
      imageBrief,
      sectionText,
    });
    return NextResponse.json({ success: true, dataUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Image generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}