import { GoogleGenAI } from '@google/genai';

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in .env.local');
  return new GoogleGenAI({ apiKey });
}

export async function generateWebsiteImageDataUrl(input: {
  idea?: string;
  prompt: string;
  imageIndex?: number;
  altText?: string;
  imageBrief?: string;
  sectionText?: string;
}) {
  const ai = getClient();
  const finalPrompt = `
You are Nano Banana generating a polished commercial website image.

Business idea:
${input.idea || '(unknown idea)'}

Image slot index:
${typeof input.imageIndex === 'number' ? input.imageIndex : '(unknown)'}

Current image alt text:
${input.altText || '(none)'}

Intended image brief from the generated website:
${input.imageBrief || '(none)'}

Nearby website section text:
${input.sectionText || '(none)'}

User request for this image:
${input.prompt}

Rules:
- The business idea is the highest priority.
- Include obvious concrete visual cues from the business/industry.
- Do not create generic stock imagery.
- No text, no logos, no watermarks.
- Polished commercial photography style for a high-converting landing page.
- Landscape 16:9 composition unless this is clearly a small avatar/testimonial image.
- If dogs, clinics, hotels, restaurants, products, or specific locations are implied, they must visibly appear.

Return only the image.
`.trim();

  const result = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: finalPrompt,
    config: { responseModalities: ['IMAGE'] },
  });
  const part = result.candidates?.[0]?.content?.parts?.find((candidatePart) => candidatePart.inlineData);

  if (!part?.inlineData) {
    throw new Error('Nano Banana returned no image data');
  }

  return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}
