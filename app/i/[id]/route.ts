import { formatInvoiceAmount, getInvoice } from '@/lib/invoices';
import { getPublishedSite } from '@/lib/published-sites';

export const runtime = 'nodejs';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

function siteNameFromHtml(html: string, fallback: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || fallback;

  return title.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    return new Response('Invoice not found.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const site = await getPublishedSite(invoice.siteSlug);
  const businessName = siteNameFromHtml(site?.html || '', invoice.siteSlug);
  const amount = formatInvoiceAmount(invoice.amountCents, invoice.currency);
  const paymentUrl = safeUrl(invoice.paymentUrl || '');
  const qrImageUrl = safeUrl(process.env.DEFAULT_PAYMENT_QR_IMAGE_URL || '');
  const qrLabel = process.env.DEFAULT_PAYMENT_QR_LABEL || 'Scan to pay';
  const paymentInstructions = invoice.paymentInstructions || process.env.DEFAULT_PAYMENT_INSTRUCTIONS || '';
  const hasPaymentOptions = Boolean(paymentUrl || qrImageUrl || paymentInstructions);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>Invoice ${escapeHtml(amount)} - ${escapeHtml(businessName)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-950 text-white">
  <main class="max-w-2xl mx-auto px-6 py-12">
    <div class="rounded-3xl bg-white text-slate-950 shadow-2xl overflow-hidden">
      <div class="bg-emerald-600 text-white px-8 py-6">
        <p class="text-sm uppercase tracking-wide font-semibold opacity-90">Invoice from</p>
        <h1 class="text-3xl font-extrabold mt-1">${escapeHtml(businessName)}</h1>
      </div>
      <div class="p-8">
        <div class="flex items-start justify-between gap-6">
          <div>
            <p class="text-sm text-slate-500">Amount due</p>
            <p class="text-5xl font-extrabold mt-1">${escapeHtml(amount)}</p>
          </div>
          <div class="rounded-2xl bg-amber-100 text-amber-900 px-4 py-2 text-sm font-bold uppercase">
            ${escapeHtml(invoice.status)}
          </div>
        </div>

        ${invoice.customerName ? `<p class="mt-6 text-slate-600"><span class="font-semibold text-slate-900">Customer:</span> ${escapeHtml(invoice.customerName)}</p>` : ''}
        <div class="mt-6 rounded-2xl bg-slate-100 p-5">
          <p class="text-sm font-semibold text-slate-500 uppercase">For</p>
          <p class="mt-1 text-lg font-semibold">${escapeHtml(invoice.description)}</p>
        </div>

        ${hasPaymentOptions
          ? `<div class="mt-8 rounded-2xl border border-slate-200 p-5">
              <label for="payment-method" class="block text-sm font-semibold text-slate-500 uppercase">Pay this invoice</label>
              <select id="payment-method" class="mt-2 w-full rounded-xl border border-slate-300 bg-white p-4 text-lg font-semibold text-slate-900">
                ${paymentInstructions ? '<option value="instructions">Venmo payment info</option>' : ''}
                ${paymentUrl ? '<option value="card">Credit card / Stripe link</option>' : ''}
                ${qrImageUrl ? '<option value="qr">Payment QR code</option>' : ''}
              </select>

              ${paymentInstructions
                ? `<div data-payment-panel="instructions" class="payment-panel mt-5">
                    <div class="rounded-xl bg-slate-100 p-4 text-slate-700 whitespace-pre-wrap">${escapeHtml(paymentInstructions)}</div>
                  </div>`
                : ''}

              ${paymentUrl
                ? `<div data-payment-panel="card" class="payment-panel mt-5 ${paymentInstructions ? 'hidden' : ''}">
                    <a href="${escapeHtml(paymentUrl)}" class="flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-5 text-lg font-extrabold text-white hover:bg-emerald-500">Pay by Card / Link</a>
                  </div>`
                : ''}

              ${qrImageUrl
                ? `<div data-payment-panel="qr" class="payment-panel mt-5 ${paymentInstructions || paymentUrl ? 'hidden' : ''}">
                    <p class="font-semibold text-slate-900">${escapeHtml(qrLabel)}</p>
                    <img src="${escapeHtml(qrImageUrl)}" alt="${escapeHtml(qrLabel)}" class="mt-4 mx-auto max-h-72 rounded-2xl border border-slate-200 bg-white p-3">
                    <p class="mt-3 text-sm text-slate-500 text-center">Scan this QR code with the payment app, then confirm payment with the business owner.</p>
                  </div>`
                : ''}
            </div>`
          : `<div class="mt-8 rounded-2xl border border-slate-200 p-5 text-slate-600">
              <p class="font-semibold text-slate-900">Payment link not configured yet.</p>
              <p class="mt-1 text-sm">Ask the business owner how they want to be paid, or configure a card link, payment QR code, or payment instructions.</p>
            </div>`}

        <p class="mt-6 text-xs text-slate-400">Invoice ID: ${escapeHtml(invoice.id)}</p>
      </div>
    </div>
  </main>
  <script>
    var select = document.getElementById('payment-method');
    if (select) {
      select.addEventListener('change', function () {
        document.querySelectorAll('.payment-panel').forEach(function (panel) {
          panel.classList.toggle('hidden', panel.getAttribute('data-payment-panel') !== select.value);
        });
      });
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
