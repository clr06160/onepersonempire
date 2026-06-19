import { generateTextWithFallback } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export const maxDuration = 180;

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

type HuntedIdea = {
  idea: string;
  validation: IdeaValidation;
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

function parseIdeas(text: string) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => typeof item === 'string' ? item : '')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

async function validateIdea(idea: string) {
  const prompt = `You are Agent 1, the honest cofounder filter for AI Cofounder.

Evaluate this business idea like a practical cofounder. Be supportive but do not flatter bad ideas.

Business idea:
"${idea}"

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
  return parseValidation(result.text, idea);
}

export async function POST(req: Request) {
  try {
    const { theme, baselineScore } = await req.json();
    const trimmedTheme = typeof theme === 'string' ? theme.trim() : '';
    const targetScore = Math.max(1, Math.min(10, Number(baselineScore || 8)));

    const ideaPrompt = `Generate 8 concrete business ideas likely to beat a skeptical cofounder validator score of ${targetScore}/10.

Optimize for:
- painful urgent problem
- buyer has budget
- easy first customer list
- clear ROI
- recurring revenue or repeat use
- low regulatory risk
- low integration risk
- scalable after narrow wedge
- can start manually before full automation

Avoid vague consumer apps, broad marketplaces, healthcare/EHR integration, crypto, social networks for everyone, or ideas dependent on perfect AI.

${trimmedTheme ? `User's current idea or preferred direction: "${trimmedTheme}"

Improve from that direction if possible, but you may pivot if the current direction is unlikely to beat ${targetScore}/10.` : 'No preferred theme. Prefer boring, profitable B2B or local-service enablement ideas.'}

Return ONLY a JSON array of 8 strings. Each string should be 1-3 sentences and include buyer, pain, offer, pricing, and why it pays.`;

    const ideaResult = await generateTextWithFallback(ideaPrompt);
    const ideas = parseIdeas(ideaResult.text);

    if (!ideas.length) {
      return NextResponse.json({ error: 'Idea hunter could not generate candidates.' }, { status: 500 });
    }

    const hunted: HuntedIdea[] = [];
    for (const idea of ideas) {
      const validation = await validateIdea(idea);
      hunted.push({ idea, validation });
      if (validation.score >= 9) break;
    }

    hunted.sort((a, b) => b.validation.score - a.validation.score);

    return NextResponse.json({
      ideas: hunted,
      bestScore: hunted[0]?.validation.score || 0,
      foundNinePlus: hunted.some((item) => item.validation.score >= 9),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Idea hunt failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
