import { generateTextWithFallback } from '@/lib/gemini';
import { NextResponse } from 'next/server';

type IdeaValidation = {
  verdict: string;
  score: number;
  buyer: string;
  whyItMightWork: string[];
  whyItMightFail: string[];
  sharperOffer: string;
  firstCustomer: string;
  nextMove: string;
};

function fallbackValidation(idea: string): IdeaValidation {
  return {
    verdict: 'Worth testing, but needs a sharper buyer and offer.',
    score: 6,
    buyer: 'The most urgent customer implied by the idea.',
    whyItMightWork: ['There may be a clear pain point if the buyer already spends money solving this.'],
    whyItMightFail: ['The offer may be too broad or not urgent enough yet.'],
    sharperOffer: idea,
    firstCustomer: 'Find one person already trying to solve this problem and ask what they would pay for.',
    nextMove: 'Talk to 5 likely buyers before polishing the website.',
  };
}

function parseValidation(text: string, idea: string): IdeaValidation {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<IdeaValidation>;
    return {
      verdict: String(parsed.verdict || 'Worth testing, but needs a sharper offer.'),
      score: Math.max(1, Math.min(10, Number(parsed.score || 6))),
      buyer: String(parsed.buyer || 'A specific buyer with urgent need.'),
      whyItMightWork: Array.isArray(parsed.whyItMightWork) ? parsed.whyItMightWork.map(String).slice(0, 3) : [],
      whyItMightFail: Array.isArray(parsed.whyItMightFail) ? parsed.whyItMightFail.map(String).slice(0, 3) : [],
      sharperOffer: String(parsed.sharperOffer || idea),
      firstCustomer: String(parsed.firstCustomer || 'A buyer already searching for this solution.'),
      nextMove: String(parsed.nextMove || 'Validate with 5 likely buyers.'),
    };
  } catch {
    return fallbackValidation(idea);
  }
}

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();
    const trimmed = typeof idea === 'string' ? idea.trim() : '';

    if (trimmed.length < 5) {
      return NextResponse.json({ error: 'Enter a business idea first.' }, { status: 400 });
    }

    const prompt = `You are Agent 1, the honest cofounder filter for AI Cofounder.

Evaluate this business idea like a practical cofounder. Be supportive but do not flatter bad ideas.

Business idea:
"${trimmed}"

Return ONLY valid JSON with this exact shape:
{
  "verdict": "one short honest sentence",
  "score": 1-10,
  "buyer": "specific likely buyer",
  "whyItMightWork": ["reason 1", "reason 2", "reason 3"],
  "whyItMightFail": ["risk 1", "risk 2", "risk 3"],
  "sharperOffer": "rewrite the idea as a specific offer someone could buy",
  "firstCustomer": "who to approach first",
  "nextMove": "one concrete next action"
}`;

    const result = await generateTextWithFallback(prompt);
    const validation = parseValidation(result.text, trimmed);

    return NextResponse.json({ validation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Idea validation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
