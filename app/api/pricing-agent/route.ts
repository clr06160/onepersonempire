import { generateTextWithFallback } from '@/lib/gemini';
import { NextResponse } from 'next/server';

type PricingEstimate = {
  summary: string;
  recommendedPrice: string;
  priceTiers: {
    name: string;
    price: string;
    includes: string;
  }[];
  localFactors: string[];
  assumptions: string[];
  confidence: string;
};

function fallbackPricing(service: string, zipCode: string): PricingEstimate {
  return {
    summary: `Use this as a rough starting point for ${service} in ZIP ${zipCode}. Confirm with local competitors and your actual costs.`,
    recommendedPrice: 'Start with one clear middle price, then adjust after 3-5 real quotes.',
    priceTiers: [
      { name: 'Starter', price: 'Lowest simple version', includes: 'Small scope, fast job, minimal extras.' },
      { name: 'Standard', price: 'Recommended default', includes: 'Normal scope most customers should choose.' },
      { name: 'Premium', price: 'Higher-touch option', includes: 'Priority scheduling, add-ons, or larger scope.' },
    ],
    localFactors: ['Local labor cost', 'Drive time', 'Materials', 'Urgency', 'Customer expectations'],
    assumptions: ['No live competitor scrape was performed.', 'Final price should cover time, travel, materials, fees, and profit.'],
    confidence: 'Low',
  };
}

function parsePricing(text: string, service: string, zipCode: string): PricingEstimate {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<PricingEstimate>;
    return {
      summary: String(parsed.summary || `Pricing estimate for ${service} in ${zipCode}.`),
      recommendedPrice: String(parsed.recommendedPrice || 'Use the standard tier as the default quote.'),
      priceTiers: Array.isArray(parsed.priceTiers)
        ? parsed.priceTiers.slice(0, 3).map((tier) => ({
          name: String(tier?.name || 'Tier'),
          price: String(tier?.price || 'Price TBD'),
          includes: String(tier?.includes || 'Scope TBD'),
        }))
        : fallbackPricing(service, zipCode).priceTiers,
      localFactors: Array.isArray(parsed.localFactors) ? parsed.localFactors.map(String).slice(0, 5) : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String).slice(0, 5) : [],
      confidence: String(parsed.confidence || 'Medium'),
    };
  } catch {
    return fallbackPricing(service, zipCode);
  }
}

export async function POST(req: Request) {
  try {
    const { idea, service, zipCode } = await req.json();
    const trimmedService = typeof service === 'string' ? service.trim() : '';
    const zip = typeof zipCode === 'string' ? zipCode.trim().replace(/[^0-9]/g, '').slice(0, 5) : '';
    const businessContext = typeof idea === 'string' ? idea.trim().slice(0, 1000) : '';

    if (trimmedService.length < 3) {
      return NextResponse.json({ error: 'Enter the product or service to price.' }, { status: 400 });
    }
    if (zip.length !== 5) {
      return NextResponse.json({ error: 'Enter a 5-digit ZIP code.' }, { status: 400 });
    }

    const prompt = `You are a practical pricing agent for one-person local businesses and contractors.

Estimate local pricing for this product/service. You do not have live browsing. Use reasonable market knowledge, ZIP/local cost-of-living reasoning, and contractor math. Be clear that this is a starting quote, not a guaranteed market scrape.

Business context:
"${businessContext || trimmedService}"

Product or service to price:
"${trimmedService}"

ZIP code:
"${zip}"

Return ONLY valid JSON with this exact shape:
{
  "summary": "2 sentence plain-English pricing summary",
  "recommendedPrice": "the price or range you would start with",
  "priceTiers": [
    { "name": "Starter", "price": "$X-$Y", "includes": "what this includes" },
    { "name": "Standard", "price": "$X-$Y", "includes": "what this includes" },
    { "name": "Premium", "price": "$X-$Y", "includes": "what this includes" }
  ],
  "localFactors": ["factor 1", "factor 2", "factor 3"],
  "assumptions": ["assumption 1", "assumption 2", "assumption 3"],
  "confidence": "Low, Medium, or High"
}`;

    const result = await generateTextWithFallback(prompt);
    const pricing = parsePricing(result.text, trimmedService, zip);
    return NextResponse.json({ pricing });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Pricing agent failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
