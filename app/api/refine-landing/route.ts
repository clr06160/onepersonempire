import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: NextRequest) {
  try {
    const { idea, currentHTML, instructions } = await req.json();

    const prompt = `You are an expert landing page editor.
Current business idea: "${idea}"

CURRENT LANDING PAGE HTML:
${currentHTML}

USER WANTS THESE CHANGES: "${instructions}"

Regenerate the full HTML with the changes applied intelligently.
Keep the exact same dark modern style, Tailwind, hover edit system, and checkout script.
Output ONLY clean, complete HTML.`;

    const result = await model.generateContent(prompt);
    const html = result.response.text();

    return Response.json({ html });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}