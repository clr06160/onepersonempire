import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const DISABLED_TEXT_MODEL_PATTERNS = [
  /gemini-3\.5-flash/i,
  /gemini-2\.0-flash/i,
  /gemini-1\.5-flash/i,
];

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in .env.local');
  return apiKey;
}

export function getGeminiTextModelNames() {
  const configured = [
    process.env.GEMINI_TEXT_MODEL,
    ...(process.env.GEMINI_TEXT_FALLBACK_MODELS || '').split(','),
  ]
    .map((model) => model?.trim().replace(/^["']|["']$/g, ''))
    .filter((model): model is string => Boolean(model))
    .filter((model) => !DISABLED_TEXT_MODEL_PATTERNS.some((pattern) => pattern.test(model)));

  return [...new Set([...configured, ...DEFAULT_TEXT_MODELS])];
}

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /\b(503|429|overloaded|high demand|unavailable|temporarily)\b/i.test(message);
}

function isUnavailableModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /\b(404|not found|no longer available)\b/i.test(message);
}

function isMimeTypeUnsupportedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /\b(responseMimeType|mime type|application\/json|invalid.*config|400)\b/i.test(message);
}

export async function generateTextWithFallback(prompt: string, options?: {
  maxOutputTokens?: number;
  responseMimeType?: string;
  temperature?: number;
}) {
  const apiKey = getApiKey();
  const client = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of getGeminiTextModelNames()) {
    if (DISABLED_TEXT_MODEL_PATTERNS.some((pattern) => pattern.test(modelName))) {
      console.warn(`[gemini] skipping disabled text model: ${modelName}`);
      continue;
    }

    const mimeAttempts = options?.responseMimeType
      ? [options.responseMimeType, undefined]
      : [undefined];

    for (const mimeType of mimeAttempts) {
      try {
        console.info(
          `[gemini] trying text model: ${modelName}${mimeType ? ` (${mimeType})` : ''}`,
        );
        const generationConfig: {
          maxOutputTokens?: number;
          responseMimeType?: string;
          temperature?: number;
        } = {};
        if (options?.maxOutputTokens) generationConfig.maxOutputTokens = options.maxOutputTokens;
        if (mimeType) generationConfig.responseMimeType = mimeType;
        if (typeof options?.temperature === 'number') generationConfig.temperature = options.temperature;

        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: Object.keys(generationConfig).length ? generationConfig : undefined,
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text()?.trim();
        if (!text) {
          const block = result.response.promptFeedback?.blockReason;
          throw new Error(block ? `Gemini blocked: ${block}` : `${modelName} returned no content`);
        }
        return { text, model: modelName };
      } catch (error) {
        lastError = error;
        if (mimeType && isMimeTypeUnsupportedError(error)) {
          console.warn(`[gemini] ${modelName} rejected JSON mime type; retrying plain text`, error);
          continue;
        }
        if (isUnavailableModelError(error)) {
          console.warn(`[gemini] ${modelName} is unavailable, trying fallback`, error);
          break;
        }
        if (!isRetryableGeminiError(error)) {
          // Try next model only if this wasn't a plain content/parse issue for this model.
          break;
        }
        console.warn(`[gemini] ${modelName} failed, trying fallback`, error);
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini text generation failed');
}