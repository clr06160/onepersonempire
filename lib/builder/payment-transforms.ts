import { escapeHtmlAttribute, escapeRegExp } from './html-utils';

export type PaymentButtonDetails = {
  venmoPhone?: string;
  productName?: string;
  productPrice?: string;
  paymentMode?: 'venmo' | 'checkout';
  checkoutProvider?: string;
};

export const setHtmlAttribute = (tag: string, name: string, value: string) => {
  const safeValue = escapeHtmlAttribute(value);
  const pattern = new RegExp(`\\s${name}=(["'])[\\s\\S]*?\\1`, 'i');
  return pattern.test(tag)
    ? tag.replace(pattern, ` ${name}="${safeValue}"`)
    : tag.replace(/>$/, ` ${name}="${safeValue}">`);
};

export const updatePaymentButtonHtml = (
  html: string,
  textId: string,
  label: string,
  link: string,
  instructions: string,
  details: PaymentButtonDetails = {},
) => {
  const safeTextId = escapeRegExp(textId);
  const safeLabel = label.trim() || 'Pay Owner';
  const safeLink = escapeHtmlAttribute(link.trim());
  const safeInstructions = escapeHtmlAttribute(instructions.trim());
  let replaced = false;

  const updated = html.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, (button) => {
    const openingTag = button.match(/<button\b[^>]*>/i)?.[0] || '';
    if (!new RegExp(`\\bdata-ai-text-id=(["'])${safeTextId}\\1`, 'i').test(openingTag)) return button;

    replaced = true;
    let nextOpeningTag = /\sdata-stripe-link=(["'])[\s\S]*?\1/i.test(openingTag)
      ? openingTag.replace(/\sdata-stripe-link=(["'])[\s\S]*?\1/i, ` data-stripe-link="${safeLink}"`)
      : openingTag.replace(/>$/, ` data-stripe-link="${safeLink}">`);
    nextOpeningTag = /\sdata-payment-instructions=(["'])[\s\S]*?\1/i.test(nextOpeningTag)
      ? nextOpeningTag.replace(/\sdata-payment-instructions=(["'])[\s\S]*?\1/i, ` data-payment-instructions="${safeInstructions}"`)
      : nextOpeningTag.replace(/>$/, ` data-payment-instructions="${safeInstructions}">`);
    nextOpeningTag = setHtmlAttribute(nextOpeningTag, 'data-venmo-phone', details.venmoPhone || '');
    nextOpeningTag = setHtmlAttribute(nextOpeningTag, 'data-product-name', details.productName || '');
    nextOpeningTag = setHtmlAttribute(nextOpeningTag, 'data-product-price', details.productPrice || '');
    nextOpeningTag = setHtmlAttribute(nextOpeningTag, 'data-payment-mode', details.paymentMode || (safeLink ? 'checkout' : 'venmo'));
    nextOpeningTag = setHtmlAttribute(nextOpeningTag, 'data-checkout-provider', details.checkoutProvider || '');

    return button
      .replace(openingTag, nextOpeningTag)
      .replace(/>[\s\S]*?<\/button>$/i, `>${safeLabel}</button>`);
  });

  return replaced ? updated : html;
};

export const updateStripeButtonHtml = updatePaymentButtonHtml;

export const formatVenmoPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const extractVenmoPhoneNumber = (value: string) => formatVenmoPhoneNumber(value);

export const normalizePaymentAmount = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
};

export const buildVenmoPayment = (
  value: string,
  amount = '',
  item = '',
) => {
  const phoneNumber = extractVenmoPhoneNumber(value);
  if (!phoneNumber) return null;
  const paymentAmount = normalizePaymentAmount(amount);
  const paymentItem = item.trim();

  if (!paymentAmount) return null;

  return {
    phoneNumber,
    amount: paymentAmount,
    item: paymentItem,
    fallbackText: `Pay ${paymentAmount} with Venmo\n\nSend to: ${phoneNumber}${paymentItem ? `\nNote: ${paymentItem}` : ''}`,
  };
};

export const parseVenmoPaymentInstructions = (value: string, link = '') => {
  if (link) {
    try {
      const url = new URL(link);
      return {
        phoneNumber: extractVenmoPhoneNumber(url.searchParams.get('recipients') || url.pathname),
        amount: normalizePaymentAmount(url.searchParams.get('amount') || ''),
        item: url.searchParams.get('note') || '',
      };
    } catch {}
  }

  const fixedMatch = value.match(/Pay\s+([^\n]+?)\s+with Venmo:\s*([^\n]+)/i);
  if (fixedMatch) {
    return {
      phoneNumber: extractVenmoPhoneNumber(fixedMatch[2] || ''),
      amount: fixedMatch[1].trim(),
      item: value.match(/For:\s*([^\n]+)/i)?.[1]?.trim() || '',
    };
  }

  return {
    phoneNumber: extractVenmoPhoneNumber(value),
    amount: '',
    item: '',
  };
};

export const normalizeCheckoutUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return /^https?:$/i.test(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

export const inferCheckoutProvider = (value: string) => {
  const normalized = normalizeCheckoutUrl(value);
  if (!normalized) return '';
  const host = new URL(normalized).hostname.toLowerCase();
  if (host.includes('stripe.com') || host.includes('stripe.network')) return 'Stripe';
  if (host.includes('paypal.com') || host.includes('paypal.me')) return 'PayPal';
  return 'Checkout';
};
