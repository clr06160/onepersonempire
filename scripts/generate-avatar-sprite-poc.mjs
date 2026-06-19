import { GoogleGenAI } from '@google/genai';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputPath = resolve(process.cwd(), 'public/avatar-sprites/poc-one-person.png');
const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

async function loadLocalEnvValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const envText = await readFile(resolve(process.cwd(), '.env.local'), 'utf8');
    const match = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match?.[1]?.trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

const apiKey = await loadLocalEnvValue('GEMINI_API_KEY');

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY in .env.local or environment.');
}

const prompt = `
Create one production-quality avatar sprite sheet for a web app called OnePerson Empire.

Goal:
- A tiny proof of concept, not a full collection.
- One consistent young creator character only.
- Same face shape, same head size, same body proportions, same camera angle, same lighting across all frames.
- Cute polished cartoon/game avatar style, like a modern creator app sticker pack.
- Clean isolated parts that can later be layered in a browser avatar builder.

Canvas:
- 1024x1024 PNG.
- 4 columns x 4 rows.
- Each cell is 256x256.
- Use the first 12 cells and leave the last 4 cells empty/transparent.
- Plain transparent background if possible; otherwise pure white.
- No text, no labels, no logos, no watermark.
- No grid lines or dividers.
- Keep each part centered in its cell with enough padding.

Cells, left to right, top to bottom:
1. Full base person: friendly creator, neutral shirt, head and upper body.
2. Short hair overlay that fits the base head.
3. Long hair overlay that fits the base head.
4. Friendly eyes overlay.
5. Smile mouth overlay.
6. Excited mouth overlay.
7. Shop apron outfit overlay for cafe/slime/shop owner.
8. Creator hoodie outfit overlay.
9. Handheld cup tool/prop.
10. Paint brush tool/prop.
11. Small cute blob pet.
12. First sale badge icon with a star or coin only, no readable words.

Strict consistency rules:
- Hair, eyes, mouths, and outfits must visually fit the base person.
- Do not create 12 different characters.
- Do not include backgrounds, scenes, mockups, product packaging, text, or UI.
- Make edges clean enough for sprite extraction.
- Use bold readable shapes, not tiny detail.

Return only the image.
`.trim();

const ai = new GoogleGenAI({ apiKey });
const result = await ai.models.generateContent({
  model,
  contents: prompt,
  config: { responseModalities: ['IMAGE'] },
});

const part = result.candidates?.[0]?.content?.parts?.find((candidatePart) => candidatePart.inlineData);
if (!part?.inlineData?.data) {
  throw new Error('Nano Banana returned no image data.');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(part.inlineData.data, 'base64'));

console.log(`Generated ${outputPath}`);
