import { escapeHtmlContent } from './html-utils';

export const buildCouponSectionHtml = (discount: string, details: string) => {
  const safeDiscount = escapeHtmlContent(discount);
  const safeDetails = escapeHtmlContent(details || 'Mention this coupon before paying or booking so the owner can confirm the discount.');
  const codeBase = discount.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'DEAL';
  const couponCode = `SAVE${codeBase}`;

  return `
<section id="coupon" class="py-16 bg-gradient-to-br from-emerald-950 via-slate-950 to-black text-white">
  <div class="max-w-5xl mx-auto px-6 lg:px-8">
    <div class="rounded-[2rem] border border-dashed border-emerald-300/70 bg-white/10 p-6 md:p-10 shadow-2xl backdrop-blur">
      <div class="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-sm font-black uppercase tracking-[0.3em] text-emerald-300" data-ai-text-id="coupon-eyebrow">Limited coupon</p>
          <h2 class="mt-3 text-4xl md:text-6xl font-black tracking-tight" data-ai-text-id="coupon-heading">${safeDiscount} off</h2>
          <p class="mt-4 max-w-2xl text-lg leading-8 text-emerald-50" data-ai-text-id="coupon-details">${safeDetails}</p>
        </div>
        <div class="rounded-3xl bg-white p-6 text-center text-slate-950 shadow-xl">
          <p class="text-xs font-black uppercase tracking-[0.25em] text-slate-500" data-ai-text-id="coupon-code-label">Coupon code</p>
          <p class="mt-2 text-3xl font-black tracking-widest" data-ai-text-id="coupon-code">${couponCode}</p>
          <p class="mt-3 text-sm text-slate-600" data-ai-text-id="coupon-payment-note">For Venmo or invoice payment, mention this code before paying.</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
};

export const addCouponToHtml = (html: string, discount: string, details: string) => {
  const couponHtml = buildCouponSectionHtml(discount, details);
  const navLink = '<a href="#coupon" data-ai-text-id="nav-coupon" class="hover:text-emerald-600">Coupon</a>';
  const withoutOldCoupon = html.replace(/<section\b[^>]*id=["']coupon["'][\s\S]*?<\/section>/i, '');
  const withNav = /href=["']#coupon["']/i.test(withoutOldCoupon)
    ? withoutOldCoupon
    : /<\/nav>/i.test(withoutOldCoupon)
      ? withoutOldCoupon.replace(/<\/nav>/i, `${navLink}</nav>`)
      : withoutOldCoupon.replace(/<body([^>]*)>/i, `<body$1><nav class="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4 flex gap-5 text-sm font-bold"><a href="#top" data-ai-text-id="nav-home">Home</a>${navLink}</nav>`);

  if (/<\/main>/i.test(withNav)) {
    return withNav.replace(/<\/main>/i, `${couponHtml}</main>`);
  }
  return withNav.replace(/<\/body>/i, `${couponHtml}</body>`);
};
