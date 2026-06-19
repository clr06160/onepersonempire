import { generateTextWithFallback } from '@/lib/gemini';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { idea, currentHTML, instructions } = await req.json();

    const prompt = `You are an expert landing page editor.
Current business idea: "${idea}"

CURRENT LANDING PAGE HTML:
${currentHTML}

USER WANTS THESE CHANGES: "${instructions}"

Regenerate the full HTML with the changes applied intelligently.
Keep the exact same dark modern style, Tailwind, hover edit system, and editor script.
Output ONLY clean, complete HTML.`;

    const result = await generateTextWithFallback(prompt, { maxOutputTokens: 16000 });
    const html = result.text;

    return Response.json({ html });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Landing page refinement failed';
    return Response.json({ error: message }, { status: 500 });
  }
}