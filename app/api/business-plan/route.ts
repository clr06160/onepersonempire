import { generateTextWithFallback } from '@/lib/gemini';
import { NextResponse } from 'next/server';

type BusinessPlan = {
  summary: string;
  offer: string;
  targetCustomer: string;
  pricing: string;
  earningEstimate: {
    label: string;
    monthlyRevenueRange: string;
    likelyTakeHomeRange: string;
    assumptions: string[];
    confidence: string;
  };
  salesChannels: string[];
  sevenDayPlan: string[];
  websiteBrief: string;
  firstOutreachMessage: string;
};

function fallbackPlan(idea: string): BusinessPlan {
  return {
    summary: 'Start with a focused offer and test it with real buyers before expanding.',
    offer: idea,
    targetCustomer: 'The buyer with the most urgent version of this problem.',
    pricing: 'Start with one simple entry price and adjust after buyer conversations.',
    earningEstimate: {
      label: 'Rough first-pass estimate',
      monthlyRevenueRange: 'Unknown until tested',
      likelyTakeHomeRange: 'Unknown until costs are known',
      assumptions: ['This needs buyer conversations before giving a reliable number.'],
      confidence: 'Low',
    },
    salesChannels: ['Direct outreach', 'Local/community posting', 'Referral asks'],
    sevenDayPlan: [
      'Define one buyer and one offer.',
      'Publish a simple landing page.',
      'Ask 10 likely buyers for feedback.',
      'Send 10 direct outreach messages.',
      'Improve the offer from objections.',
      'Ask for the first sale.',
      'Review what worked and repeat.',
    ],
    websiteBrief: idea,
    firstOutreachMessage: 'I’m testing a new offer and thought it might help you. Can I send you the quick page?',
  };
}

function parsePlan(text: string, idea: string): BusinessPlan {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<BusinessPlan>;
    return {
      summary: String(parsed.summary || 'Focused launch plan.'),
      offer: String(parsed.offer || idea),
      targetCustomer: String(parsed.targetCustomer || 'Specific buyer with urgent need.'),
      pricing: String(parsed.pricing || 'Start with one clear price.'),
      earningEstimate: {
        label: String(parsed.earningEstimate?.label || 'Rough first-pass estimate'),
        monthlyRevenueRange: String(parsed.earningEstimate?.monthlyRevenueRange || 'Unknown until tested'),
        likelyTakeHomeRange: String(parsed.earningEstimate?.likelyTakeHomeRange || 'Unknown until costs are known'),
        assumptions: Array.isArray(parsed.earningEstimate?.assumptions) ? parsed.earningEstimate.assumptions.map(String).slice(0, 4) : [],
        confidence: String(parsed.earningEstimate?.confidence || 'Low'),
      },
      salesChannels: Array.isArray(parsed.salesChannels) ? parsed.salesChannels.map(String).slice(0, 3) : [],
      sevenDayPlan: Array.isArray(parsed.sevenDayPlan) ? parsed.sevenDayPlan.map(String).slice(0, 7) : [],
      websiteBrief: String(parsed.websiteBrief || parsed.offer || idea),
      firstOutreachMessage: String(parsed.firstOutreachMessage || 'Can I send you the quick page?'),
    };
  } catch {
    return fallbackPlan(idea);
  }
}

export async function POST(req: Request) {
  try {
    const { idea, validation, zipCode } = await req.json();
    const trimmed = typeof idea === 'string' ? idea.trim() : '';
    const zip = typeof zipCode === 'string' ? zipCode.trim().replace(/[^0-9]/g, '').slice(0, 5) : '';

    if (trimmed.length < 5) {
      return NextResponse.json({ error: 'Enter a business idea first.' }, { status: 400 });
    }

    const prompt = `You are Agent 2, the practical launch planner for AI Cofounder.

Create a short business launch plan that helps this founder get to first sales. Do not write a long MBA report.

Original idea:
"${trimmed}"

ZIP code / local market if provided:
"${zip || 'Not provided'}"

Agent 1 validation context:
${JSON.stringify(validation || {}, null, 2)}

Return ONLY valid JSON with this exact shape:
{
  "summary": "2 sentence practical summary",
  "offer": "specific offer to sell first",
  "targetCustomer": "specific first customer profile",
  "pricing": "simple starting price or pricing test",
  "earningEstimate": {
    "label": "rough estimate for this business and ZIP/local market",
    "monthlyRevenueRange": "realistic early monthly revenue range, not hype",
    "likelyTakeHomeRange": "rough owner take-home after obvious costs",
    "assumptions": ["assumption 1", "assumption 2", "assumption 3"],
    "confidence": "Low, Medium, or High"
  },
  "salesChannels": ["channel 1", "channel 2", "channel 3"],
  "sevenDayPlan": ["day 1 action", "day 2 action", "day 3 action", "day 4 action", "day 5 action", "day 6 action", "day 7 action"],
  "websiteBrief": "what Agent 3 should build and emphasize on the website",
  "firstOutreachMessage": "short message to send to a likely first buyer"
}`;

    const result = await generateTextWithFallback(prompt);
    const plan = parsePlan(result.text, trimmed);

    return NextResponse.json({ plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Business plan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
