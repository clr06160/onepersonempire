import { escapeHtmlContent, escapeRegExp, makeSlug } from './html-utils';

export const buildPageLikeSectionHtml = (section: string) => {
  const safeSection = escapeHtmlContent(section);
  const sectionId = makeSlug(section);
  const pageType = section.toLowerCase();
  const photoSrc = `https://placehold.co/1200x520/e2e8f0/334155?text=${encodeURIComponent(section)}`;

  if (pageType.includes('menu') || pageType.includes('price')) {
    return `
<section id="${sectionId}" data-ope-added-page="true" data-ope-added-page-label="${safeSection}" class="min-h-screen bg-stone-50 text-slate-950">
  <div class="bg-slate-950 px-6 py-20 text-white lg:px-8">
    <div class="mx-auto max-w-6xl">
      <p class="text-sm font-black uppercase tracking-[0.3em] text-emerald-300" data-ai-text-id="${sectionId}-eyebrow">Menu and prices</p>
      <h2 class="mt-4 text-5xl font-black tracking-tight md:text-7xl" data-ai-text-id="${sectionId}-heading">${safeSection}</h2>
      <p class="mt-6 max-w-3xl text-xl leading-8 text-slate-300" data-ai-text-id="${sectionId}-intro">List the most popular offerings, clear prices, and simple next steps so customers do not have to ask basic questions before buying.</p>
    </div>
  </div>
  <div class="mx-auto grid max-w-6xl gap-5 px-6 py-14 lg:px-8">
    ${['Popular item', 'Customer favorite', 'Best value', 'Add-on'].map((label, index) => `
    <div class="flex flex-col gap-3 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <h3 class="text-2xl font-black" data-ai-text-id="${sectionId}-item-${index}-title">${label}</h3>
        <p class="mt-2 text-slate-600" data-ai-text-id="${sectionId}-item-${index}-copy">Describe what is included and who this is best for.</p>
      </div>
      <p class="text-3xl font-black text-emerald-700" data-ai-text-id="${sectionId}-item-${index}-price">$99</p>
    </div>`).join('')}
  </div>
</section>`;
  }

  if (pageType.includes('gallery') || pageType.includes('before')) {
    return `
<section id="${sectionId}" data-ope-added-page="true" data-ope-added-page-label="${safeSection}" class="min-h-screen bg-slate-950 px-6 py-20 text-white lg:px-8">
  <div class="mx-auto max-w-7xl">
    <p class="text-sm font-black uppercase tracking-[0.3em] text-emerald-300" data-ai-text-id="${sectionId}-eyebrow">Proof of work</p>
    <h2 class="mt-4 text-5xl font-black tracking-tight md:text-7xl" data-ai-text-id="${sectionId}-heading">${safeSection}</h2>
    <p class="mt-6 max-w-3xl text-xl leading-8 text-slate-300" data-ai-text-id="${sectionId}-intro">Show real jobs, before-and-after photos, recent projects, or examples that make customers trust the business.</p>
    <div class="mt-12 grid gap-5 md:grid-cols-3">
      ${[1, 2, 3, 4, 5, 6].map((item) => `
      <div class="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <img class="h-64 w-full object-cover" src="https://placehold.co/800x600/1e293b/e2e8f0?text=Project+Photo+${item}" alt="${safeSection} example ${item}" data-ai-editable="true" data-image-index="${sectionId}-gallery-${item}" data-ai-image-brief="A real project photo for ${safeSection}" />
        <p class="p-4 text-sm text-slate-300" data-ai-text-id="${sectionId}-caption-${item}">Add a short note about this job.</p>
      </div>`).join('')}
    </div>
  </div>
</section>`;
  }

  if (pageType.includes('review')) {
    return `
<section id="${sectionId}" data-ope-added-page="true" data-ope-added-page-label="${safeSection}" class="min-h-screen bg-white px-6 py-20 text-slate-950 lg:px-8">
  <div class="mx-auto max-w-6xl">
    <p class="text-sm font-black uppercase tracking-[0.3em] text-emerald-600" data-ai-text-id="${sectionId}-eyebrow">Customer proof</p>
    <h2 class="mt-4 text-5xl font-black tracking-tight md:text-7xl" data-ai-text-id="${sectionId}-heading">${safeSection}</h2>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      ${['Fast and professional.', 'Easy to work with.', 'Worth every penny.'].map((quote, index) => `
      <blockquote class="rounded-3xl border border-slate-200 bg-slate-50 p-7">
        <p class="text-4xl text-amber-400">★★★★★</p>
        <p class="mt-5 text-lg leading-8 text-slate-700" data-ai-text-id="${sectionId}-quote-${index}">"${quote} Add the real customer review here."</p>
        <footer class="mt-5 font-black" data-ai-text-id="${sectionId}-reviewer-${index}">Local customer</footer>
      </blockquote>`).join('')}
    </div>
  </div>
</section>`;
  }

  if (pageType.includes('contact') || pageType.includes('booking')) {
    return `
<section id="${sectionId}" data-ope-added-page="true" data-ope-added-page-label="${safeSection}" class="min-h-screen bg-emerald-950 px-6 py-20 text-white lg:px-8">
  <div class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_.8fr] lg:items-start">
    <div>
      <p class="text-sm font-black uppercase tracking-[0.3em] text-emerald-300" data-ai-text-id="${sectionId}-eyebrow">Book or ask a question</p>
      <h2 class="mt-4 text-5xl font-black tracking-tight md:text-7xl" data-ai-text-id="${sectionId}-heading">${safeSection}</h2>
      <p class="mt-6 text-xl leading-8 text-emerald-50" data-ai-text-id="${sectionId}-intro">Tell customers exactly how to reach the owner, what to include, and when they can expect a reply.</p>
    </div>
    <div class="rounded-3xl bg-white p-7 text-slate-950 shadow-2xl">
      <p class="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Contact info</p>
      <p class="mt-5 text-2xl font-black" data-ai-text-id="${sectionId}-phone">Call or text: 555-555-5555</p>
      <p class="mt-3 text-lg" data-ai-text-id="${sectionId}-hours">Hours: Monday-Friday, 8am-6pm</p>
      <p class="mt-3 text-lg" data-ai-text-id="${sectionId}-area">Service area: Add towns or ZIP codes here</p>
      <a class="mt-7 inline-flex rounded-full bg-emerald-600 px-6 py-4 font-black text-white" href="tel:5555555555" data-ai-text-id="${sectionId}-cta">Call now</a>
    </div>
  </div>
</section>`;
  }

  if (pageType.includes('faq')) {
    return `
<section id="${sectionId}" data-ope-added-page="true" data-ope-added-page-label="${safeSection}" class="min-h-screen bg-slate-50 px-6 py-20 text-slate-950 lg:px-8">
  <div class="mx-auto max-w-4xl">
    <p class="text-sm font-black uppercase tracking-[0.3em] text-emerald-600" data-ai-text-id="${sectionId}-eyebrow">Questions customers ask</p>
    <h2 class="mt-4 text-5xl font-black tracking-tight md:text-7xl" data-ai-text-id="${sectionId}-heading">${safeSection}</h2>
    <div class="mt-10 space-y-4">
      ${['How much does it cost?', 'How soon can you come out?', 'What should I do before booking?', 'Do you serve my area?'].map((question, index) => `
      <div class="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 class="text-xl font-black" data-ai-text-id="${sectionId}-question-${index}">${question}</h3>
        <p class="mt-3 leading-7 text-slate-600" data-ai-text-id="${sectionId}-answer-${index}">Add a clear, honest answer in plain language.</p>
      </div>`).join('')}
    </div>
  </div>
</section>`;
  }

  return `
<section id="${sectionId}" data-ope-added-page="true" data-ope-added-page-label="${safeSection}" class="min-h-screen bg-white text-slate-950">
  <div class="bg-gradient-to-br from-slate-950 to-slate-800 px-6 py-20 text-white lg:px-8">
    <div class="mx-auto max-w-6xl">
      <p class="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300" data-ai-text-id="${sectionId}-eyebrow">Added page</p>
      <h2 class="mt-3 text-5xl font-black tracking-tight md:text-7xl" data-ai-text-id="${sectionId}-heading">${safeSection}</h2>
      <p class="mt-6 max-w-3xl text-xl leading-8 text-slate-300" data-ai-text-id="${sectionId}-intro">Use this page-style section to add the details customers need before they call, book, or pay. Click Edit mode to rewrite this copy for the business.</p>
    </div>
  </div>
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="mt-10 grid gap-6 md:grid-cols-3">
      <div class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h3 class="text-xl font-bold" data-ai-text-id="${sectionId}-card-one-title">What to know</h3>
        <p class="mt-3 text-slate-600" data-ai-text-id="${sectionId}-card-one-copy">Add the most important detail about this part of the business, service, process, or offer.</p>
      </div>
      <div class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h3 class="text-xl font-bold" data-ai-text-id="${sectionId}-card-two-title">How it works</h3>
        <p class="mt-3 text-slate-600" data-ai-text-id="${sectionId}-card-two-copy">Explain the next step in plain language so customers feel comfortable moving forward.</p>
      </div>
      <div class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h3 class="text-xl font-bold" data-ai-text-id="${sectionId}-card-three-title">Why customers like it</h3>
        <p class="mt-3 text-slate-600" data-ai-text-id="${sectionId}-card-three-copy">Highlight the practical benefit, time saved, money saved, or peace of mind this gives them.</p>
      </div>
    </div>
    <img class="mt-10 w-full rounded-3xl object-cover shadow-xl" src="${photoSrc}" alt="${safeSection}" data-ai-editable="true" data-image-index="${sectionId}-image" data-ai-image-brief="A real business photo for the ${safeSection} page" />
  </div>
</section>`;
};

export const addPageNavLinkToHtml = (html: string, sectionId: string, safeLabel: string) => {
  const navLink = `<a href="#${sectionId}" data-ai-text-id="nav-${sectionId}" class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-500 hover:text-emerald-700">${safeLabel}</a>`;

  if (html.includes('id="ope-added-pages-nav"')) {
    return html.replace(/(<div id=["']ope-added-pages-nav["'][^>]*>)([\s\S]*?)(<\/div>)/i, `$1$2${navLink}$3`);
  }

  const addedNav = `<div id="ope-added-pages-nav" class="sticky top-0 z-40 flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50/95 px-6 py-3 backdrop-blur"><span class="mr-1 self-center text-xs font-black uppercase tracking-[0.2em] text-slate-400">More pages</span>${navLink}</div>`;

  if (/<\/nav>/i.test(html)) {
    return html.replace(/<\/nav>/i, `</nav>${addedNav}`);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>${addedNav}`);
};

export const addPageLikeSectionToHtml = (html: string, section: string) => {
  const sectionId = makeSlug(section);
  const safeLabel = escapeHtmlContent(section);
  if (new RegExp(`id=["']${sectionId}["']`, 'i').test(html)) {
    return { html, alreadyExists: true };
  }

  const withNav = addPageNavLinkToHtml(html, sectionId, safeLabel);
  const sectionHtml = buildPageLikeSectionHtml(section);
  if (/<\/main>/i.test(withNav)) {
    return { html: withNav.replace(/<\/main>/i, `${sectionHtml}</main>`), alreadyExists: false };
  }
  return { html: withNav.replace(/<\/body>/i, `${sectionHtml}</body>`), alreadyExists: false };
};

export const removeAddedPageFromHtml = (html: string, sectionId: string) => {
  const safeSectionId = escapeRegExp(sectionId);
  let next = html.replace(
    new RegExp(`<section\\b(?=[^>]*\\bid=["']${safeSectionId}["'])(?=[^>]*\\bdata-ope-added-page=["']true["'])[^>]*>[\\s\\S]*?<\\/section>`, 'i'),
    '',
  );
  next = next.replace(
    new RegExp(`<a\\b(?=[^>]*\\bhref=["']#${safeSectionId}["'])[^>]*>[\\s\\S]*?<\\/a>`, 'i'),
    '',
  );
  next = next.replace(
    /<div id=["']ope-added-pages-nav["'][^>]*>\s*<span\b[^>]*>[\s\S]*?<\/span>\s*<\/div>/i,
    '',
  );
  return next;
};
