import { generateTextWithFallback } from '@/lib/gemini';
import {
  createInvoice,
  extractPaymentInstructionsFromHtml,
  extractPaymentLinkFromHtml,
  extractSiteTitleFromHtml,
  extractVenmoPhoneFromHtml,
  formatInvoiceAmount,
  formatVenmoInvoiceInstructions,
} from '@/lib/invoices';
import { normalizePhoneNumber, sendOutboundSms } from '@/lib/outbound-sms';
import { getPublishedSite, normalizeSlug, updatePublishedSiteHtml } from '@/lib/published-sites';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

type CmsPlan = {
  textUpdates?: Array<{
    textId: string;
    value: string;
  }>;
  imageUpdates?: Array<{
    imageIndex: string;
    imageUrl: string;
  }>;
  latestWork?: {
    add: boolean;
    title: string;
    description: string;
    imageUrl: string;
  };
  reply?: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twiml(message: string, status = 200) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function getPublicOrigin(req: NextRequest) {
  if (process.env.PUBLISH_PUBLIC_BASE_URL) {
    return process.env.PUBLISH_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : req.nextUrl.origin;
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtmlContent(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlContent(value).replace(/"/g, '&quot;');
}

async function sendInvoiceSms(input: {
  to: string;
  body: string;
}) {
  if (process.env.TWILIO_AUTO_SEND_INVOICES !== 'true') {
    return { sent: false, reason: 'Auto-send is off.' };
  }

  return sendOutboundSms(input);
}

function stripCustomerPhone(value: string) {
  const phoneMatch = value.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (!phoneMatch) {
    return { customerPhone: '', text: value };
  }

  return {
    customerPhone: normalizePhoneNumber(phoneMatch[0]),
    text: `${value.slice(0, phoneMatch.index)} ${value.slice((phoneMatch.index || 0) + phoneMatch[0].length)}`.replace(/\s+/g, ' ').trim(),
  };
}

function editableTextFields(html: string) {
  return [...html.matchAll(/<([a-z0-9-]+)\b([^>]*\bdata-ai-text-id=(["'])(.*?)\3[^>]*)>([\s\S]*?)<\/\1>/gi)]
    .map((match) => ({
      textId: match[4],
      currentText: stripTags(match[5]).slice(0, 180),
    }))
    .filter((field) => field.textId)
    .slice(0, 80);
}

function editableImages(html: string) {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => {
      const tag = match[0];
      const imageIndex = tag.match(/\bdata-image-index=(["'])(.*?)\1/i)?.[2] || '';
      const alt = tag.match(/\balt=(["'])(.*?)\1/i)?.[2] || '';
      const brief = tag.match(/\bdata-ai-image-brief=(["'])(.*?)\1/i)?.[2] || '';
      return { imageIndex, alt, brief: brief.slice(0, 180) };
    })
    .filter((image) => image.imageIndex)
    .slice(0, 20);
}

function parseCmsPlan(text: string): CmsPlan {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned) as CmsPlan;
  } catch {
    return { reply: 'I could not understand that edit. Try: site my-site change the headline to Fresh Lawn Care.' };
  }
}

function applyTextUpdate(html: string, textId: string, value: string) {
  const safeValue = escapeHtmlContent(value.trim());
  if (!safeValue) return html;

  return html.replace(
    /<([a-z0-9-]+)\b([^>]*\bdata-ai-text-id=(["'])(.*?)\3[^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tagName: string, attrs: string, _quote: string, foundTextId: string) => {
      if (foundTextId !== textId) return full;
      return `<${tagName}${attrs}>${safeValue}</${tagName}>`;
    },
  );
}

function applyImageUpdate(html: string, imageIndex: string, imageUrl: string) {
  const safeUrl = escapeHtmlAttribute(imageUrl.trim());
  if (!safeUrl) return html;

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const foundIndex = tag.match(/\bdata-image-index=(["'])(.*?)\1/i)?.[2] || '';
    if (foundIndex !== imageIndex) return tag;

    if (/\ssrc=(["'])[\s\S]*?\1/i.test(tag)) {
      return tag.replace(/\ssrc=(["'])[\s\S]*?\1/i, ` src="${safeUrl}"`);
    }
    return tag.replace(/<img\b/i, `<img src="${safeUrl}"`);
  });
}

function shouldAddLatestWork(instruction: string, mediaUrl: string) {
  if (!mediaUrl) return false;
  return (
    !instruction.trim() ||
    /\b(add|upload|post|show|latest|recent|portfolio|gallery|job|work|project|before|after)\b/i.test(instruction)
  ) && !/\b(replace|change|swap)\b/i.test(instruction);
}

function latestWorkSectionExists(html: string) {
  return /\bid=(["'])latest-work\1/i.test(html);
}

function latestWorkCard(title: string, description: string, imageUrl: string) {
  const safeTitle = escapeHtmlContent(title.trim() || 'Recent Project');
  const safeDescription = escapeHtmlContent(description.trim() || 'A recent job completed by the team.');
  const safeUrl = escapeHtmlAttribute(imageUrl.trim());

  return `
        <article class="rounded-2xl overflow-hidden bg-white/90 text-slate-900 shadow-lg border border-slate-200">
          <img src="${safeUrl}" alt="${safeTitle}" class="w-full h-64 object-cover">
          <div class="p-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Latest Work</p>
            <h3 class="mt-1 text-xl font-bold">${safeTitle}</h3>
            <p class="mt-2 text-sm text-slate-600">${safeDescription}</p>
          </div>
        </article>`;
}

function addPortfolioNavLink(html: string) {
  if (/\bhref=(["'])#latest-work\1/i.test(html)) return html;
  const link = '<a href="#latest-work" class="hover:text-emerald-500 transition-colors">Portfolio</a>';

  if (/<nav\b[^>]*>/i.test(html)) {
    return html.replace(/(<nav\b[^>]*>)/i, `$1${link}`);
  }

  if (/<body\b[^>]*>/i.test(html)) {
    const nav = `
  <nav class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
    <div class="max-w-6xl mx-auto px-6 py-3 flex justify-end text-sm font-semibold text-slate-700">
      ${link}
    </div>
  </nav>
`;
    return html.replace(/(<body\b[^>]*>)/i, `$1${nav}`);
  }

  return html;
}

function insertSectionBeforeFinalCta(html: string, section: string) {
  const sectionMatches = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)];
  if (sectionMatches.length >= 2) {
    const target = sectionMatches[sectionMatches.length - 1];
    if (typeof target.index === 'number') {
      return `${html.slice(0, target.index)}${section}${html.slice(target.index)}`;
    }
  }

  if (/<\/main>/i.test(html)) {
    return html.replace(/<\/main>/i, `${section}</main>`);
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${section}</body>`);
  }

  return `${html}${section}`;
}

function insertSectionAfterHero(html: string, section: string) {
  const firstSection = html.match(/<section\b[^>]*>[\s\S]*?<\/section>/i);
  if (firstSection && typeof firstSection.index === 'number') {
    const insertAt = firstSection.index + firstSection[0].length;
    return `${html.slice(0, insertAt)}${section}${html.slice(insertAt)}`;
  }

  if (/<main\b[^>]*>/i.test(html)) {
    return html.replace(/(<main\b[^>]*>)/i, `$1${section}`);
  }

  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/(<body\b[^>]*>)/i, `$1${section}`);
  }

  return insertSectionBeforeFinalCta(html, section);
}

function moveLatestWorkAfterHero(html: string) {
  const match = html.match(/<section\b[^>]*\bid=(["'])latest-work\1[^>]*>[\s\S]*?<\/section>/i);
  if (!match || typeof match.index !== 'number') return html;

  const section = match[0];
  const withoutSection = `${html.slice(0, match.index)}${html.slice(match.index + section.length)}`;
  return insertSectionAfterHero(withoutSection, section);
}

function imageUrlExistsInLatestWork(html: string, imageUrl: string) {
  const safeUrl = escapeHtmlAttribute(imageUrl.trim());
  if (!safeUrl) return false;

  const match = html.match(/<section\b[^>]*\bid=(["'])latest-work\1[^>]*>[\s\S]*?<\/section>/i);
  return Boolean(match?.[0].includes(safeUrl));
}

function removeDuplicateLatestWorkCards(html: string) {
  const match = html.match(/<section\b[^>]*\bid=(["'])latest-work\1[^>]*>[\s\S]*?<\/section>/i);
  if (!match || typeof match.index !== 'number') return html;

  const section = match[0];
  const seen = new Set<string>();
  const cleanedSection = section.replace(/<article\b[\s\S]*?<\/article>/gi, (card) => {
    const src = card.match(/\ssrc=(["'])(.*?)\1/i)?.[2] || '';
    if (!src) return card;
    if (seen.has(src)) return '';
    seen.add(src);
    return card;
  });

  return `${html.slice(0, match.index)}${cleanedSection}${html.slice(match.index + section.length)}`;
}

function appendLatestWork(html: string, title: string, description: string, imageUrl: string) {
  const card = latestWorkCard(title, description, imageUrl);
  let output = addPortfolioNavLink(html);

  if (latestWorkSectionExists(output)) {
    if (imageUrlExistsInLatestWork(output, imageUrl)) {
      return moveLatestWorkAfterHero(removeDuplicateLatestWorkCards(output));
    }

    if (/<!--\s*latest-work-items\s*-->/i.test(output)) {
      output = output.replace(/<!--\s*latest-work-items\s*-->/i, `${card}\n<!-- latest-work-items -->`);
      return moveLatestWorkAfterHero(removeDuplicateLatestWorkCards(output));
    }

    output = output.replace(
      /(<section\b[^>]*\bid=(["'])latest-work\2[^>]*>[\s\S]*?)(<\/section>)/i,
      (_full, sectionStart: string, _quote: string, sectionEnd: string) => `${sectionStart}${card}${sectionEnd}`,
    );
    return moveLatestWorkAfterHero(removeDuplicateLatestWorkCards(output));
  }

  const section = `
  <section id="latest-work" class="py-20 bg-slate-950 text-white">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-emerald-300">Fresh From The Field</p>
          <h2 class="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">Latest Work</h2>
        </div>
        <p class="text-slate-300 max-w-xl">Real recent jobs, added by text message from the field.</p>
      </div>
      <div data-latest-work-grid="true" class="grid md:grid-cols-3 gap-6">
${card}
<!-- latest-work-items -->
      </div>
    </div>
  </section>
`;

  return insertSectionAfterHero(output, section);
}

function titleFromInstruction(instruction: string) {
  const cleaned = instruction
    .replace(/\b(add|upload|post|show)\b/gi, '')
    .replace(/\b(this|photo|picture|image|as|to|latest|recent|work|portfolio|gallery|job|project)\b/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Recent Project';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function parseInvoiceInstruction(instruction: string) {
  const normalized = instruction
    .replace(/^(send|create|make|write)\s+(an?\s+)?/i, '')
    .replace(/^(invoice|bill)\s+/i, '')
    .trim();

  if (!/\b(invoice|bill)\b/i.test(instruction) && normalized === instruction.trim()) {
    return null;
  }

  const { customerPhone, text } = stripCustomerPhone(normalized);
  const amountMatch = text.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (!amountMatch || typeof amountMatch.index !== 'number') return null;

  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const beforeAmount = text.slice(0, amountMatch.index).replace(/\b(to|for)\b/gi, '').trim();
  const afterAmount = text.slice(amountMatch.index + amountMatch[0].length)
    .replace(/^\s*(for|to|:|-)\s*/i, '')
    .trim();

  return {
    customerName: beforeAmount || undefined,
    customerPhone: customerPhone || undefined,
    amountCents: Math.round(amount * 100),
    description: afterAmount || 'Service invoice',
  };
}

function extractSlugAndInstruction(body: string, fallbackSlug = '') {
  const trimmed = body.trim();
  const siteMatch = trimmed.match(/^site\s+([a-z0-9-]+)\s+([\s\S]+)$/i);
  if (siteMatch) {
    return {
      slug: normalizeSlug(siteMatch[1]),
      instruction: siteMatch[2].trim(),
    };
  }

  const hashMatch = trimmed.match(/^#([a-z0-9-]+)\s+([\s\S]+)$/i);
  if (hashMatch) {
    return {
      slug: normalizeSlug(hashMatch[1]),
      instruction: hashMatch[2].trim(),
    };
  }

  return {
    slug: normalizeSlug(fallbackSlug),
    instruction: trimmed,
  };
}

async function readIncoming(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await req.json();
    return {
      body: typeof json.body === 'string' ? json.body : '',
      slug: typeof json.slug === 'string' ? json.slug : '',
      mediaUrl: typeof json.mediaUrl === 'string' ? json.mediaUrl : '',
      wantsJson: true,
    };
  }

  const form = await req.formData();
  return {
    body: String(form.get('Body') || form.get('body') || ''),
    slug: String(form.get('slug') || ''),
    mediaUrl: String(form.get('MediaUrl0') || form.get('mediaUrl') || ''),
    wantsJson: false,
  };
}

export async function POST(req: NextRequest) {
  let wantsJsonResponse = false;
  try {
    const incoming = await readIncoming(req);
    wantsJsonResponse = incoming.wantsJson;
    const requiredSecret = process.env.SMS_CMS_SECRET;
    const providedSecret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-sms-cms-secret') || '';

    if (requiredSecret && providedSecret !== requiredSecret) {
      const message = 'SMS CMS secret is missing or incorrect.';
      return incoming.wantsJson
        ? NextResponse.json({ error: message }, { status: 403 })
        : twiml(message, 403);
    }

    const { slug, instruction } = extractSlugAndInstruction(
      incoming.body,
      incoming.slug || process.env.SMS_CMS_DEFAULT_SLUG || '',
    );

    const effectiveInstruction = instruction || (incoming.mediaUrl ? 'add this photo to latest work' : '');

    if (!slug || !effectiveInstruction) {
      const message = 'Text format: site your-site-name change the headline to Fresh Lawn Care.';
      return incoming.wantsJson
        ? NextResponse.json({ error: message }, { status: 400 })
        : twiml(message, 400);
    }

    const site = await getPublishedSite(slug);
    if (!site) {
      const message = `I could not find a published site named "${slug}".`;
      return incoming.wantsJson
        ? NextResponse.json({ error: message }, { status: 404 })
        : twiml(message, 404);
    }

    const invoiceRequest = parseInvoiceInstruction(effectiveInstruction);
    if (invoiceRequest) {
      const venmoPhone = extractVenmoPhoneFromHtml(site.html);
      const paymentInstructions = venmoPhone
        ? formatVenmoInvoiceInstructions({
          amountCents: invoiceRequest.amountCents,
          description: invoiceRequest.description,
          venmoPhone,
        })
        : extractPaymentInstructionsFromHtml(site.html);
      const invoice = await createInvoice({
        siteSlug: slug,
        customerName: invoiceRequest.customerName,
        customerPhone: invoiceRequest.customerPhone,
        description: invoiceRequest.description,
        amountCents: invoiceRequest.amountCents,
        paymentUrl: extractPaymentLinkFromHtml(site.html),
        paymentInstructions,
      });
      const invoiceUrl = new URL(`/i/${invoice.id}`, getPublicOrigin(req)).toString();
      const businessName = extractSiteTitleFromHtml(site.html, slug);
      const customerMessage = `${formatInvoiceAmount(invoice.amountCents)} invoice from ${businessName}: ${invoice.description}. Pay here: ${invoiceUrl}`;
      const smsResult = invoiceRequest.customerPhone
        ? await sendInvoiceSms({ to: invoiceRequest.customerPhone, body: customerMessage })
        : { sent: false, reason: 'No customer phone number included.' };
      const reply = smsResult.sent
        ? `Invoice sent: ${formatInvoiceAmount(invoice.amountCents)} for ${invoice.description} to ${invoiceRequest.customerPhone}. ${invoiceUrl}`
        : `Invoice ready: ${formatInvoiceAmount(invoice.amountCents)} for ${invoice.description}. ${smsResult.reason} Send this link to the customer: ${invoiceUrl}`;

      return incoming.wantsJson
        ? NextResponse.json({ ok: true, slug, invoice, invoiceUrl, smsSent: smsResult.sent, smsReason: smsResult.reason, reply })
        : twiml(reply);
    }

    const fields = editableTextFields(site.html);
    const images = editableImages(site.html);
    const requestedLatestWork = shouldAddLatestWork(effectiveInstruction, incoming.mediaUrl);

    if (requestedLatestWork) {
      const title = titleFromInstruction(effectiveInstruction);
      const nextHtml = appendLatestWork(
        site.html,
        title,
        `${title} added from the field by text message.`,
        incoming.mediaUrl,
      );
      const updated = await updatePublishedSiteHtml({ slug, html: nextHtml });
      const reply = `Added latest work to ${updated.slug}: ${title}.`;

      return incoming.wantsJson
        ? NextResponse.json({ ok: true, slug: updated.slug, updatedAt: updated.updatedAt, reply })
        : twiml(reply);
    }

    const mediaHint = incoming.mediaUrl ? `Attached media URL to use if the user asked for a photo/image change: ${incoming.mediaUrl}` : 'No media URL was attached.';
    const prompt = `You are the SMS/WhatsApp CMS agent for a published AI website.

The owner sent this edit instruction:
"${effectiveInstruction}"

${mediaHint}

Editable text fields:
${JSON.stringify(fields, null, 2)}

Editable images:
${JSON.stringify(images, null, 2)}

Choose the smallest safe edits.
- If the owner asks to change pricing, update the most relevant price, offer, and button text fields.
- If they ask to replace/change an existing photo and a media URL is attached, use imageUpdates.
- If they send a recent job/work/project photo, use latestWork instead of replacing an existing image.
- If they provide an image URL in the instruction, use it.

Return ONLY valid JSON:
{
  "textUpdates": [{"textId": "exact id from editable text fields", "value": "new visible text"}],
  "imageUpdates": [{"imageIndex": "exact image index from editable images", "imageUrl": "public image url"}],
  "latestWork": {"add": false, "title": "short project title", "description": "one sentence project caption", "imageUrl": "public image url"},
  "reply": "short confirmation text for the owner"
}`;

    const result = await generateTextWithFallback(prompt);
    const plan = parseCmsPlan(result.text);
    let nextHtml = site.html;

    for (const update of plan.textUpdates || []) {
      nextHtml = applyTextUpdate(nextHtml, String(update.textId || ''), String(update.value || ''));
    }
    for (const update of plan.imageUpdates || []) {
      nextHtml = applyImageUpdate(nextHtml, String(update.imageIndex || ''), String(update.imageUrl || incoming.mediaUrl || ''));
    }
    const latestWork = plan.latestWork;
    if ((requestedLatestWork || latestWork?.add) && (latestWork?.imageUrl || incoming.mediaUrl)) {
      nextHtml = appendLatestWork(
        nextHtml,
        String(latestWork?.title || 'Recent Project'),
        String(latestWork?.description || effectiveInstruction || 'A recent job completed by the team.'),
        String(latestWork?.imageUrl || incoming.mediaUrl),
      );
    }

    if (nextHtml === site.html) {
      const message = plan.reply || 'I understood the request, but no editable field matched. Try naming the section, price, headline, or photo.';
      return incoming.wantsJson
        ? NextResponse.json({ error: message }, { status: 400 })
        : twiml(message, 400);
    }

    const updated = await updatePublishedSiteHtml({ slug, html: nextHtml });
    const reply = plan.reply || `Updated ${updated.slug}.`;

    return incoming.wantsJson
      ? NextResponse.json({ ok: true, slug: updated.slug, updatedAt: updated.updatedAt, reply })
      : twiml(reply);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SMS CMS update failed';
    return wantsJsonResponse
      ? NextResponse.json({ error: message }, { status: 500 })
      : twiml(message, 500);
  }
}
