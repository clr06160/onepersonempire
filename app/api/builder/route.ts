import { prepareGeneratedHtml } from '@/lib/cms-html';
import { generateTextWithFallback } from '@/lib/gemini';
import { generateWebsiteImageDataUrl } from '@/lib/nano-banana';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const GEMINI_TIMEOUT_MS = 180_000;

type BuilderMode = 'normal' | 'expand' | 'onepage' | 'rewrite';

type CleanBusinessBrief = {
  summary: string;
  businessType: string;
  location: string;
  primaryOffer: string;
  targetCustomer: string;
  toneStyle: string;
  paymentContact: string;
  mustInclude: string[];
  ignoreForFirstVersion: string[];
};

async function callGemini(prompt: string) {
  const result = await generateTextWithFallback(prompt, { maxOutputTokens: 16000 });
  return result.text;
}

function isCompleteHtml(html: string) {
  const cleaned = html.replace(/```html/gi, '').replace(/```/g, '').trim();
  return /<!doctype html>/i.test(cleaned)
    && /<html\b/i.test(cleaned)
    && /<head\b/i.test(cleaned)
    && /<body\b/i.test(cleaned)
    && /<\/body>/i.test(cleaned)
    && /<\/html>/i.test(cleaned);
}

function callGeminiWithTimeout(prompt: string) {
  return Promise.race([
    callGemini(prompt),
    new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s — try a shorter idea or retry`)),
        GEMINI_TIMEOUT_MS
      )
    ),
  ]);
}

function parseJsonObject(value: string) {
  const cleaned = value.replace(/```json/gi, '').replace(/```/g, '').trim();
  const json = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
  return JSON.parse(json) as Record<string, unknown>;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
    : [];
}

function fallbackCleanBrief(rawNotes: string): CleanBusinessBrief {
  return {
    summary: rawNotes,
    businessType: rawNotes,
    location: 'Local area',
    primaryOffer: rawNotes,
    targetCustomer: 'Local customers',
    toneStyle: 'Clean, trustworthy, professional',
    paymentContact: 'Simple contact or payment instructions',
    mustInclude: [],
    ignoreForFirstVersion: [],
  };
}

function shouldUseAiCleanBrief(rawNotes: string) {
  const trimmed = rawNotes.trim();
  const lineCount = trimmed.split(/\n/).map((line) => line.trim()).filter(Boolean).length;
  return trimmed.length > 220 || lineCount > 2;
}

function reconcileBriefWithRawNotes(rawNotes: string, brief: CleanBusinessBrief): CleanBusinessBrief {
  const briefText = `${brief.summary} ${brief.businessType} ${brief.primaryOffer}`.toLowerCase();
  const isPetCare = /\b(dog walk(?:ing|er)?|pet sit(?:ting|ter)?|pet care|puppy walk(?:ing|er)?|cat sit(?:ting|ter)?)\b/i.test(rawNotes);
  const looksLikeTourism = /\b(walking tour|sightseeing|city tour|guided tour|tour guide|tourist)\b/i.test(briefText);

  if (isPetCare && looksLikeTourism) {
    const locationMatch = rawNotes.match(/\b(?:in|near|around)\s+([A-Za-z][A-Za-z\s,.-]{1,40})/i);
    const location = locationMatch?.[1]?.trim() || brief.location;
    return {
      ...brief,
      summary: `Dog walking and pet care service${location && location !== 'Local area' ? ` in ${location}` : ''}.`,
      businessType: 'Dog walking / pet care',
      location,
      primaryOffer: 'Dog walking and pet care for local pet owners',
      targetCustomer: 'Pet owners who need reliable dog walking or pet care',
      mustInclude: [...new Set([...brief.mustInclude, 'dogs', 'pet care', 'dog walking'])],
      ignoreForFirstVersion: [...new Set([...brief.ignoreForFirstVersion, 'walking tours', 'sightseeing', 'city tours', 'tourism'])],
    };
  }

  return brief;
}

function formatCleanBrief(brief: CleanBusinessBrief) {
  return [
    `Simple brief: ${brief.summary}`,
    `Business type: ${brief.businessType}`,
    `Location: ${brief.location}`,
    `Primary offer: ${brief.primaryOffer}`,
    `Target customer: ${brief.targetCustomer}`,
    `Tone/style: ${brief.toneStyle}`,
    `Payment/contact: ${brief.paymentContact}`,
    brief.mustInclude.length ? `Must include: ${brief.mustInclude.join(', ')}` : '',
    brief.ignoreForFirstVersion.length ? `Ignore for first version: ${brief.ignoreForFirstVersion.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

async function cleanBusinessBrief(rawNotes: string): Promise<CleanBusinessBrief> {
  if (!shouldUseAiCleanBrief(rawNotes)) {
    return fallbackCleanBrief(rawNotes);
  }

  const prompt = `You clean messy user notes into a simple local-business website brief.

Goal:
- Extract useful facts.
- Ignore rambling, future maybe ideas, conflicting extras, social/networking/game ideas, blogs, marketplaces, memberships, and unrelated product ideas unless they are clearly the main business.
- Preserve simple direct instructions: colors, background, tone, language, location, payment/contact method, one-page/full-site, gallery/reviews/menu/services.
- Make the first version a normal, credible local-business site.
- Keep the exact business category from the user. Do not swap it for a related industry.
- Examples: "dog walking in Barcelona" = dog walking / pet care in Barcelona, NOT walking tours, sightseeing, tourism, or city tours. "house cleaning" is not a hotel. "mobile detailing" is not a car dealership.
- A city or tourist destination in the notes is just the service area unless the user clearly sells tours, tickets, or sightseeing.

Return ONLY compact JSON with this exact shape:
{
  "summary": "one clear sentence for the website to build",
  "businessType": "short business type",
  "location": "city/area or Local area",
  "primaryOffer": "main offer",
  "targetCustomer": "main customer",
  "toneStyle": "style/tone/colors/language",
  "paymentContact": "how customers contact or pay",
  "mustInclude": ["short item"],
  "ignoreForFirstVersion": ["short item"]
}

User raw notes:
${rawNotes}`;

  try {
    const result = await generateTextWithFallback(prompt, { maxOutputTokens: 1000 });
    const parsed = parseJsonObject(result.text);
    const fallback = fallbackCleanBrief(rawNotes);
    const brief = {
      summary: String(parsed.summary || fallback.summary).slice(0, 500),
      businessType: String(parsed.businessType || fallback.businessType).slice(0, 160),
      location: String(parsed.location || fallback.location).slice(0, 160),
      primaryOffer: String(parsed.primaryOffer || fallback.primaryOffer).slice(0, 240),
      targetCustomer: String(parsed.targetCustomer || fallback.targetCustomer).slice(0, 200),
      toneStyle: String(parsed.toneStyle || fallback.toneStyle).slice(0, 240),
      paymentContact: String(parsed.paymentContact || fallback.paymentContact).slice(0, 240),
      mustInclude: normalizeStringArray(parsed.mustInclude),
      ignoreForFirstVersion: normalizeStringArray(parsed.ignoreForFirstVersion),
    };
    return reconcileBriefWithRawNotes(rawNotes, brief);
  } catch (error) {
    console.error('[builder:clean-brief]', error);
    return fallbackCleanBrief(rawNotes);
  }
}

function getAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
}

function normalizeBuilderMode(mode: unknown): BuilderMode {
  return mode === 'expand' || mode === 'onepage' || mode === 'rewrite' ? mode : 'normal';
}

function describeMode(mode: BuilderMode) {
  if (mode === 'expand') return 'expanded multi-section website with top navigation, page-like sections, and low-cost editable image placeholders';
  if (mode === 'onepage') return 'ultra-focused one-page payment landing page for one core offer with no navigation menu';
  if (mode === 'rewrite') return 'targeted rewrite of the current website based on user feedback';
  return 'compact single-page landing site';
}

function onePageRules(mode: BuilderMode) {
  if (mode !== 'onepage') return '';

  return `
One-page conversion mode:
- Treat "one-page" as a short payment landing page, not a full website.
- Do NOT include a top nav, header menu, hamburger menu, dropdown, footer nav, or any menu links.
- Do NOT include same-page anchor navigation like #offer, #process, #proof, or #cta.
- Do NOT imply extra pages like Blog, Team, Careers, Resources, Portfolio, Pricing, Contact, or About.
- Keep total visible sections to 3: hero/offer, proof/process, payment CTA.
- Use one core offer card. Only use two cards if the user explicitly asks for two products or pricing options.
- Use one image maximum.
- Make the owner payment button the obvious next step near the top and again only if needed in the final CTA.`;
}

function pageStructureRules(mode: BuilderMode) {
  if (mode === 'expand') {
    return `Expanded website structure:
- Build a fuller website in one HTML document for preview/publish, with top navigation links that jump to page-like sections.
- Pick sections based on business type. Examples: contractors/painters use Home, Services, Portfolio, Reviews, Contact; restaurants use Home, Menu, Catering, Events, Contact; hotels use Rooms, Amenities, Gallery, Local Area, Booking; clinics use Services, About, Patient Info, Insurance, Contact.
- Navigation links must be same-page anchors for now, matching real section IDs. Do not use fake paths like /about or /services.
- Use 5-7 sections total and make each feel like a real page section, not a tiny landing-page block.
- Use editable image placeholders only. Do not ask for or imply AI-generated images by default.
- Portfolio/gallery sections should be ready for customer-uploaded real photos and SMS latest-work updates.
- Keep image count reasonable: 3-5 placeholders maximum across the whole expanded site.`;
  }

  if (mode === 'onepage') {
    return `Page structure:
- No navigation bar and no menu links. Start with the hero/offer immediately.
- Section 1: hero with specific headline, short subheadline, one primary CTA/payment button area, and one strong image.
- Section 2: combined offer + proof/process with one compact card or 3 concise bullets.
- Section 3: final payment CTA with the owner payment button.
- Keep the page short enough that it feels like one focused sales page, not a full business website.`;
  }

  return `Page structure:
- Sticky/top navigation with 3-4 anchor links that actually match section IDs in the page.
- Do not create fake multi-page links such as /about, /services, /pricing, /contact, Blog, Team, Careers, Resources, or Portfolio. This builder returns one HTML document, so all navigation must be same-page anchors.
- Hero: sharp headline, specific subheadline, primary CTA, secondary proof/benefit line, one strong image.
- Trust strip: 3 quick credibility/value bullets.
- Offer section: 3 specific services/features/products in cards.
- Process or proof section: 3 concise steps or one testimonial.
- Final CTA with the owner payment button.
- Keep total HTML compact enough to finish. Do not create more than 6 sections total.`;
}

async function hydrateInitialImages(html: string, idea: string) {
  const imageTags = [...html.matchAll(/<img\b[^>]*data-ai-editable=["']true["'][^>]*>/gi)];
  let output = html;

  for (const match of imageTags.slice(0, 2)) {
    const tag = match[0];
    const imageIndex = Number(getAttribute(tag, 'data-image-index'));
    const altText = getAttribute(tag, 'alt');
    const imageBrief = getAttribute(tag, 'data-ai-image-brief') || altText;

    if (!imageBrief) continue;

    try {
      const dataUrl = await generateWebsiteImageDataUrl({
        idea,
        imageIndex: Number.isFinite(imageIndex) ? imageIndex : undefined,
        altText,
        imageBrief,
        prompt: imageBrief,
      });

      const updatedTag = tag.replace(/\ssrc=["'][^"']*["']/i, ` src="${dataUrl}"`);
      output = output.replace(tag, updatedTag);
    } catch (error) {
      console.error('[builder:image]', error);
    }
  }

  return output;
}

function buildSafePrompt(idea: string, mode: BuilderMode) {
  return `Return ONLY complete raw HTML for a polished Tailwind CDN landing page.

Business idea:
"${idea}"

Location/language:
Use the language, country, city, currency, and local payment/contact clues mentioned in the business idea. If the user mentions WhatsApp, make WhatsApp the primary contact/payment instruction. If the user mentions Venmo, make Venmo the primary payment instruction. If no location or payment method is mentioned, default to US English and simple payment info.

Mode: ${mode === 'expand' ? 'expanded structure-first website with editable image placeholders' : mode === 'onepage' ? 'focused one-page payment landing page' : 'compact one-page landing page'}

Hard rules:
- Must include <!DOCTYPE html>, <html>, <head>, <body>, closing </body>, closing </html>.
- Include <script src="https://cdn.tailwindcss.com"></script> in <head>.
- Use ONLY built-in Tailwind utility classes. No custom brand/accent classes.
- Use one built-in palette: stone + emerald.
- No extra scripts besides Tailwind.
- No comments. No markdown.
- Keep it compact: ${mode === 'expand' ? 'hero, services, portfolio/gallery placeholders, proof/reviews, contact/final CTA.' : mode === 'onepage' ? 'hero/offer, compact proof, final payment CTA. No nav menu.' : 'hero, 3-card offer section, 3-step process/proof section, final CTA.'}
- ${mode === 'onepage' ? 'Do not include top navigation or section anchor links.' : mode === 'expand' ? 'Top nav has 4-5 links matching real section ids such as #services, #portfolio, #reviews, #contact.' : 'Top nav has 3 links matching real section ids: #offer, #process, #cta.'}
- ${mode === 'onepage' ? 'No fake page links.' : 'Do not create fake page links like /about, /services, Blog, Team, Careers, or Resources. Use same-page anchors only.'}
- ${mode === 'expand' ? 'Use editable placeholder images only, such as https://placehold.co/1200x700/e2e8f0/334155?text=Add+real+business+photo. Do not use generated images.' : mode === 'onepage' ? 'One image maximum' : 'One image'}: ${mode === 'expand' ? 'placeholder image URLs with good alt and data-ai-image-brief' : 'https://picsum.photos/1200/600?random=1 with good alt and data-ai-image-brief'}.
- Every visible heading, paragraph, link, button, and list item has data-ai-text-id.
- Include one <button type="button" data-ai-text-id="stripe-payment-button">Pay Owner</button>. This is for the business owner's customer payments, not OnePerson Empire fees.
- Professional layout: max-w-7xl mx-auto px-6 lg:px-8, no giant icons, no emojis larger than text-xl.
- Make it credible for a real local business owner to send today: clear service area, practical contact/payment CTA, concrete services/products, and one trust-building proof section.
- Avoid overpromising. Use plain language, specific details, and believable claims instead of hype.
- Keep the exact business category from the idea. "Dog walking" means pet care for dogs, NOT city walking tours or tourism.
${mode === 'onepage' ? '- One-page version: no menu, no anchor-link nav, no fake extra page links, one core offer, compact proof, payment CTA.' : ''}

Make the copy specific to the business idea.`;
}

function compactHtmlForPrompt(html: string) {
  return html
    .replace(/\ssrc=(["'])data:image\/[^"']+\1/gi, ' src="https://picsum.photos/1200/600?random=1"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120_000);
}

function buildRewritePrompt(idea: string, currentHtml: string, feedback: string) {
  return `You are Agent 3 — elite conversion-focused web designer for OnePerson Empire.

Revise the existing website according to the user's feedback.

Business idea/context:
"${idea || 'Use the current website as the source of truth.'}"

User requested change:
"${feedback}"

Current website HTML:
${currentHtml}

Rewrite rules:
- Return one complete raw HTML document only. No markdown fences. No explanation.
- Keep the existing business identity and offer unless the user clearly asks to change them.
- Apply the user's instruction directly, including layout, color, section count, image quantity, copy tone, or page structure.
- If the user asks for "two pages" or "multiple pages", create a polished multi-section website in this single HTML file with clear top navigation links to the sections, because this builder previews one HTML document.
- Preserve or recreate the CMS hooks: every visible heading, paragraph, button, link, and list item needs a unique data-ai-text-id.
- Preserve or recreate editable images with data-ai-editable="true", data-image-index, descriptive alt text, and data-ai-image-brief.
- All editable/visible images must be real <img> elements. Do not use CSS background-image for important images because the CMS cannot edit those.
- Preserve the owner payment button concept. Include at least one <button type="button" data-ai-text-id="stripe-payment-button"> with clear customer payment CTA copy.
- Use Tailwind CSS via <script src="https://cdn.tailwindcss.com"></script> in <head>.
- Do not include scripts except Tailwind. Do not include the ope-cms script; the server adds it.
- Use only built-in Tailwind utility classes, responsive layout, clean spacing, and professional typography.
- Finish with closing </body> and </html>.`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      idea,
      mode: requestedMode,
      currentHtml,
      feedback,
    } = await req.json();
    const mode = normalizeBuilderMode(requestedMode);
    const trimmed = typeof idea === 'string' ? idea.trim() : '';
    const rewriteFeedback = typeof feedback === 'string' ? feedback.trim() : '';
    const existingHtml = typeof currentHtml === 'string' ? compactHtmlForPrompt(currentHtml) : '';

    if (mode === 'rewrite') {
      if (rewriteFeedback.length < 3) {
        return NextResponse.json({ error: 'Tell the AI what you want changed first.' }, { status: 400 });
      }
      if (!existingHtml || existingHtml.length < 100) {
        return NextResponse.json({ error: 'Generate a site before asking for a rewrite.' }, { status: 400 });
      }
    } else if (!trimmed || trimmed.length < 5) {
      return NextResponse.json({ error: 'Please provide a valid business idea' }, { status: 400 });
    }

    const cleanBrief = mode === 'rewrite' ? null : await cleanBusinessBrief(trimmed);
    const builderIdea = cleanBrief ? formatCleanBrief(cleanBrief) : trimmed;

    const websitePrompt = mode === 'rewrite'
      ? buildRewritePrompt(trimmed, existingHtml, rewriteFeedback)
      : `You are Agent 3 — elite conversion-focused web designer for OnePerson Empire.

Build from this cleaned business brief:
${builderIdea}

Original raw notes — these define the actual business category. If the cleaned brief conflicts with the raw notes on business type, follow the raw notes:
"${trimmed}"

Business type rule (critical):
- Never swap the user's business for a related but different industry.
- "Dog walking" / "dog walker" = pet care for dogs, NOT walking tours, sightseeing, tourism, or city tours.
- A city name is only the service area unless the user clearly sells tours or tickets.

Location/language:
Use the language, country, city, currency, and local payment/contact clues mentioned in the business idea. If the user mentions WhatsApp, make WhatsApp the primary contact/payment instruction. If the user mentions Venmo, make Venmo the primary payment instruction. If no location or payment method is mentioned, default to US English and simple payment info.

Mode: ${describeMode(mode)}

Quality bar:
- This should look like a polished $5k-$15k agency landing page, not a generic AI template.
- Every section must be specific to the business, audience, industry, and offer implied by the idea.
- Avoid vague phrases like "innovative solutions", "unlock your potential", "transform your business", "our services", or "future of".
- Write concrete, credible copy a real customer would understand in 3 seconds.
- Use local-business proof instead of corporate filler: service area, hours or response expectations, before/after/photo placeholders, review-style proof, guarantees/warranty only if plausible, and simple next steps.
- The primary CTA should be practical: call, book, request quote, text, pay owner, reserve, or order. Do not make every business sound like a software startup.
- Include one clear owner/customer payment area, but do not imply OnePerson Empire collects the business owner's customer payments.
- Use a cohesive visual direction: one accent color, strong typography, cards, spacing, contrast, and premium photography placeholders.
- Layout must look professional and restrained. Do not use giant emoji/icons, chaotic grids, or random oversized decorative elements.
- Use ONLY built-in Tailwind CDN utility classes. Do NOT use custom classes like bg-brand-700, text-brand-900, bg-accent-500, or shadow-brand-*.
- Use a real built-in palette such as emerald, amber, sky, rose, slate, zinc, stone, neutral, or white/black.

${pageStructureRules(mode)}
${onePageRules(mode)}

Technical requirements:
- Complete valid HTML document with <html>, <head>, <body>
- Tailwind CSS via CDN in <head>
- You MUST finish with closing </body> and </html>.
- Responsive design that looks good on desktop and mobile
- Use a consistent shell: max-w-7xl mx-auto px-6 lg:px-8, py-20 or py-24 sections, balanced whitespace.
- ${mode === 'onepage' ? 'Do not include navigation links. If you use any link, it must be the single business CTA or payment action.' : 'Use clean navigation: header links use href="#section-id"; every linked section has matching id.'}
- ${mode === 'onepage' ? 'Do not imply separate pages.' : mode === 'expand' ? 'Never use hrefs to fake pages like /about, /services, /pricing, /contact, Blog, Team, Careers, or Resources. Use same-page anchors such as #portfolio.' : 'Never use hrefs to fake pages like /about, /services, /pricing, /contact, Blog, Team, Careers, Resources, or Portfolio.'}
- Use readable typography: h1 max text-5xl md:text-6xl, h2 max text-4xl, paragraphs text-base/text-lg, leading-relaxed.
- Icon rule: icons must be small and contained. Use simple circular badges like w-12 h-12 or w-14 h-14, text-2xl max. Never use text-6xl, text-7xl, huge emoji, or full-width icon blocks.
- Cards must be aligned in responsive grids: grid md:grid-cols-3 gap-6 or grid lg:grid-cols-4 gap-6. No uneven floating blocks.
- ${mode === 'onepage' ? 'Do not create any menus, nav bars, hamburger buttons, dropdowns, or footer link lists.' : 'Menus must be usable: desktop horizontal nav, mobile can wrap/stack naturally. Do not create dropdowns, hamburger menus, or non-working menu buttons.'}
- Avoid absolute-positioned clutter unless it is subtle background decoration behind content.
- ${mode === 'expand' ? 'Use 3-5 editable placeholder images using https://placehold.co/1200x700/e2e8f0/334155?text=Add+real+business+photo. These are placeholders only; the owner can replace them later by clicking or texting real photos.' : mode === 'onepage' ? 'Exactly 1 image placeholder using https://picsum.photos/1200/600?random=1' : '2-3 image placeholders using https://picsum.photos/1200/600?random=N'}
- Add descriptive alt text to every image based on the business
- Add data-ai-image-brief="..." to every image. The brief must describe the exact image Nano Banana should create later, including subject, setting, mood, and industry details.
- Put data-ai-text-id="unique-id" on headings, paragraphs, buttons, and list items (not on <html> or <body>)
- Include one <button type="button" data-ai-text-id="stripe-payment-button">Pay Owner</button>. This is for the business owner's customer payments, not OnePerson Empire fees.
- Do NOT include any <script> tags except the Tailwind CDN script in <head> (the server adds the editor)
- Do NOT include markdown, explanations, comments, or placeholder bracket text like [Business Name]

Return ONLY raw HTML. No markdown fences. No explanation.`;

    let rawHtml = await callGeminiWithTimeout(websitePrompt);
    if (!isCompleteHtml(rawHtml)) {
      rawHtml = await callGeminiWithTimeout(
        mode === 'rewrite'
          ? buildRewritePrompt(trimmed, existingHtml, `${rewriteFeedback}. Keep it compact and make sure the HTML is complete.`)
          : buildSafePrompt(trimmed, mode),
      );
    }

    if (!isCompleteHtml(rawHtml)) {
      throw new Error('Gemini returned incomplete HTML twice. Try a shorter idea or click Build again.');
    }

    const preparedHtml = prepareGeneratedHtml(rawHtml);
    const shouldHydrateImages = process.env.HYDRATE_INITIAL_IMAGES !== 'false' && mode !== 'expand';
    const html = shouldHydrateImages ? await hydrateInitialImages(preparedHtml, builderIdea) : preparedHtml;

    return NextResponse.json({ agent3: html, cleanBrief });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Builder failed';
    console.error('[builder]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
