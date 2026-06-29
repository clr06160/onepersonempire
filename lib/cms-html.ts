/** Post-process AI-generated HTML so the parent iframe CMS always works. */

const CMS_SCRIPT = `<script id="ope-cms">
document.addEventListener('DOMContentLoaded', function () {
  var isBuilderPreview = window.parent !== window;
  var isEditMode = window.__OPE_EDIT_MODE__ === true;

  if (isBuilderPreview && isEditMode) {
    var editStyle = document.createElement('style');
    editStyle.id = 'ope-edit-affordances';
    editStyle.textContent = [
      '.ope-image-edit-wrap{position:relative;display:block;max-width:100%;line-height:0;}',
      '.ope-image-edit-wrap img[data-ai-editable]{display:block;width:100%;height:auto;position:relative;z-index:1;}',
      '.ope-image-edit-wrap.ope-image-edit-wrap--absolute{position:absolute;inset:0;width:100%;height:100%;max-width:none;}',
      '.ope-image-edit-wrap.ope-image-edit-wrap--absolute img[data-ai-editable]{width:100%;height:100%;object-fit:cover;}',
      '.ope-image-edit-overlay{position:absolute;inset:0;z-index:20;border:0;padding:0;margin:0;cursor:pointer;background:transparent;transition:background .15s ease,box-shadow .15s ease;}',
      '.ope-image-edit-overlay:hover,.ope-image-edit-overlay:focus-visible{background:rgba(34,197,94,.14);box-shadow:inset 0 0 0 3px rgba(34,197,94,.85);}',
      '.ope-image-edit-overlay span{position:absolute;left:12px;bottom:12px;border-radius:999px;background:#020617;color:#ecfdf5;border:1px solid rgba(34,197,94,.55);padding:.45rem .75rem;font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .15s ease;}',
      '.ope-image-edit-overlay:hover span,.ope-image-edit-overlay:focus-visible span{opacity:1;transform:translateY(0);}',
      '.ope-section-image-chip{position:absolute;right:12px;z-index:99999;border-radius:999px;background:#020617;color:#ecfdf5;border:1px solid rgba(34,197,94,.55);padding:.45rem .75rem;font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer;}',
      '.ope-section-image-chip:hover,.ope-section-image-chip:focus-visible{background:#052e16;box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 0 0 1px rgba(34,197,94,.65);}',
      '[data-ai-text-id]{outline:2px solid transparent;outline-offset:4px;transition:outline-color .15s ease,box-shadow .15s ease;cursor:pointer;}',
      '[data-ai-text-id]:hover{outline-color:#22c55e;box-shadow:0 0 0 6px rgba(34,197,94,.16);}',
      '[data-ai-text-id]{position:relative;}',
      '[data-ai-text-id][data-ope-edit-label]:hover::after{content:attr(data-ope-edit-label);position:absolute;left:0;top:-2rem;z-index:99999;white-space:nowrap;border-radius:999px;background:#020617;color:#ecfdf5;border:1px solid rgba(34,197,94,.55);padding:.35rem .6rem;font:700 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);}',
      'section[data-ope-added-page="true"]:hover{box-shadow:inset 0 0 0 2px rgba(244,63,94,.45);}',
    ].join('');
    document.head.appendChild(editStyle);
  }

  if (isBuilderPreview && !isEditMode) {
    document.querySelectorAll('a[href]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = (link.getAttribute('href') || '').trim();
        if (!href || href === '#') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (href.charAt(0) === '#') {
          e.preventDefault();
          var targetId = href.slice(1);
          try {
            targetId = decodeURIComponent(targetId);
          } catch (_) {}
          var target = document.getElementById(targetId);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        if (!/^(https?:|mailto:|tel:)/i.test(href)) {
          e.preventDefault();
          var fallback = href.charAt(0) === '/'
            ? document.querySelector('main, section, header')
            : document.getElementById(href.replace(/^\\//, ''));
          if (fallback) {
            fallback.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, true);
    });
  }

  function openImageEditor(img) {
    var section = img.closest('section, header, main, div');
    var sectionText = section ? (section.innerText || section.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500) : '';
    var imageIndex = img.getAttribute('data-image-index');
    if (imageIndex == null || imageIndex === '') imageIndex = '0';
    window.parent.postMessage({
      type: 'OPEN_IMAGE_MODAL',
      imageIndex: imageIndex,
      currentSrc: img.getAttribute('src') || '',
      altText: img.getAttribute('alt') || '',
      imageBrief: img.getAttribute('data-ai-image-brief') || '',
      sectionText: sectionText
    }, '*');
  }

  function isLikelyBackgroundHero(img) {
    var cls = (img.getAttribute('class') || '') + ' ' + (img.getAttribute('style') || '');
    if (/\\babsolute\\b/.test(cls) || /position:\\s*absolute/i.test(cls)) return true;
    var st = window.getComputedStyle(img);
    return st.position === 'absolute' || st.position === 'fixed';
  }

  function isImageClickObscured(img) {
    var rect = img.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return true;
    var sampleY = [0.25, 0.5, 0.75];
    for (var i = 0; i < sampleY.length; i += 1) {
      var x = rect.left + rect.width * 0.5;
      var y = rect.top + rect.height * sampleY[i];
      var el = document.elementFromPoint(x, y);
      if (!el) continue;
      if (el === img) return false;
      if (el.closest && el.closest('.ope-image-edit-wrap') && img.closest('.ope-image-edit-wrap') === el.closest('.ope-image-edit-wrap')) return false;
    }
    return true;
  }

  function ensureSectionAnchor(section) {
    if (!section) return null;
    var st = window.getComputedStyle(section);
    if (st.position === 'static') section.style.position = 'relative';
    return section;
  }

  function addSectionImageChip(section, img, chipIndex) {
    var anchor = ensureSectionAnchor(section);
    if (!anchor) return;
    var imageIndex = img.getAttribute('data-image-index') || '0';
    if (anchor.querySelector('.ope-section-image-chip[data-ope-image-index="' + imageIndex + '"]')) return;

    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ope-section-image-chip';
    chip.setAttribute('data-ope-image-index', imageIndex);
    chip.setAttribute('aria-label', 'Replace photo');
    chip.textContent = chipIndex > 0 ? 'Replace photo ' + (chipIndex + 1) : 'Replace photo';
    chip.style.top = (12 + chipIndex * 42) + 'px';
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openImageEditor(img);
    }, true);
    anchor.appendChild(chip);
  }

  function wrapImageWithOverlay(img) {
    if (img.closest('.ope-image-edit-wrap')) return;

    img.style.cursor = 'pointer';
    img.setAttribute('title', 'Replace photo');

    var wrap = document.createElement('div');
    wrap.className = 'ope-image-edit-wrap';
    if (isLikelyBackgroundHero(img)) wrap.className += ' ope-image-edit-wrap--absolute';
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    var overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'ope-image-edit-overlay';
    overlay.setAttribute('aria-label', 'Replace photo');
    overlay.innerHTML = '<span>Replace photo</span>';
    overlay.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openImageEditor(img);
    }, true);
    wrap.appendChild(overlay);

    img.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openImageEditor(img);
    }, true);
  }

  function setupEditableImages() {
    if (!isBuilderPreview || !isEditMode) return;

    var sectionChipCounts = {};
    document.querySelectorAll('img[data-ai-editable]').forEach(function (img) {
      var section = img.closest('section, header, article, main') || img.parentElement;
      var sectionKey = section ? (section.getAttribute('id') || section.tagName + '-' + Array.prototype.indexOf.call(section.parentNode ? section.parentNode.children : [], section)) : 'root';
      var obscured = isLikelyBackgroundHero(img) || isImageClickObscured(img);

      wrapImageWithOverlay(img);

      if (obscured) {
        var chipIndex = sectionChipCounts[sectionKey] || 0;
        sectionChipCounts[sectionKey] = chipIndex + 1;
        addSectionImageChip(section, img, chipIndex);
      }
    });
  }

  setupEditableImages();
  window.setTimeout(setupEditableImages, 250);

  document.querySelectorAll('[data-ai-text-id]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var textId = el.getAttribute('data-ai-text-id') || '';
      var currentText = (el.innerText || el.textContent || '').trim();
      var currentLink = el.getAttribute('data-stripe-link') || '';
      var currentInstructions = el.getAttribute('data-payment-instructions') || '';
      var currentVenmoPhone = el.getAttribute('data-venmo-phone') || '';
      var currentProductName = el.getAttribute('data-product-name') || '';
      var currentProductPrice = el.getAttribute('data-product-price') || '';
      var currentPaymentMode = el.getAttribute('data-payment-mode') || '';
      var currentCheckoutProvider = el.getAttribute('data-checkout-provider') || '';
      if (textId.indexOf('stripe-payment-button') === 0) {
        if (isBuilderPreview && isEditMode) el.setAttribute('data-ope-edit-label', 'Set payment');
        if (!isBuilderPreview || !isEditMode) {
          e.preventDefault();
          if (currentLink) {
            window.open(currentLink, '_blank', 'noopener,noreferrer');
          } else if (currentInstructions) {
            alert(currentInstructions);
          } else {
            alert('Payment is not configured yet.');
          }
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        window.parent.postMessage({
          type: 'OPEN_PAYMENT_MODAL',
          textId: textId,
          currentText: currentText,
          currentLink: currentLink,
          currentInstructions: currentInstructions,
          currentVenmoPhone: currentVenmoPhone,
          currentProductName: currentProductName,
          currentProductPrice: currentProductPrice,
          currentPaymentMode: currentPaymentMode,
          currentCheckoutProvider: currentCheckoutProvider
        }, '*');
      } else {
        if (!isBuilderPreview || !isEditMode) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        var addedPage = el.closest('section[data-ope-added-page="true"]');
        el.setAttribute('data-ope-edit-label', addedPage ? 'Edit text / Delete page' : 'Edit text');
        window.parent.postMessage({
          type: 'OPEN_TEXT_MODAL',
          textId: textId,
          currentText: currentText,
          sectionId: addedPage ? (addedPage.getAttribute('id') || '') : '',
          sectionLabel: addedPage ? (addedPage.getAttribute('data-ope-added-page-label') || '') : '',
          canDeleteSection: !!addedPage
        }, '*');
      }
    }, true);
    if (isBuilderPreview && isEditMode) {
      el.style.cursor = 'pointer';
      if (!el.getAttribute('data-ope-edit-label')) {
        var previewTextId = el.getAttribute('data-ai-text-id') || '';
        var isPayment = previewTextId.indexOf('stripe-payment-button') === 0;
        var isAddedPage = !!el.closest('section[data-ope-added-page="true"]');
        el.setAttribute('data-ope-edit-label', isPayment ? 'Set payment' : isAddedPage ? 'Edit text / Delete page' : 'Edit text');
      }
    }
  });
});
</script>`;

const BUY_BUTTON = `<div id="ope-payment-wrap" style="text-align:center;margin:80px 0;">
<button type="button" data-ai-text-id="stripe-payment-button" data-stripe-link="" data-payment-instructions="" style="background:#059669;padding:22px 48px;color:white;border-radius:9999px;border:none;font-size:22px;font-weight:bold;cursor:pointer;">Pay Owner</button>
</div>`;

function stripMarkdownFences(html: string) {
  return html.replace(/```html/gi, '').replace(/```/g, '').trim();
}

/** Remove AI scripts so only our CMS script runs. */
function stripScripts(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) =>
      /src=["']https:\/\/cdn\.tailwindcss\.com/i.test(tag) ? tag : '',
    )
    .replace(/<script\b[^>]*\/>/gi, (tag) =>
      /src=["']https:\/\/cdn\.tailwindcss\.com/i.test(tag) ? tag : '',
    );
}

function ensureTailwindScript(html: string) {
  if (/src=["']https:\/\/cdn\.tailwindcss\.com/i.test(html)) {
    return html;
  }

  const tailwindScript = '<script src="https://cdn.tailwindcss.com"></script>';
  if (html.includes('</head>')) {
    return html.replace('</head>', `${tailwindScript}</head>`);
  }
  return `${tailwindScript}${html}`;
}

/** Remove inline handlers that fight the CMS listeners. */
function stripInlineHandlers(html: string) {
  return html
    .replace(/\s+onclick="[^"]*"/gi, '')
    .replace(/\s+onclick='[^']*'/gi, '');
}

function repairInternalLinks(html: string) {
  const ids = [...html.matchAll(/\sid=(["'])([^"']+)\1/gi)].map(match => match[2]);
  const fallbackId = ids.includes('cta') ? 'cta' : ids[0];
  if (!fallbackId) return html;

  return html.replace(/\shref=(["'])(.*?)\1/gi, (match, quote: string, href: string) => {
    const trimmed = href.trim();
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return match;

    if (trimmed.startsWith('#')) {
      const targetId = trimmed.slice(1);
      return ids.includes(targetId) ? match : ` href=${quote}#${fallbackId}${quote}`;
    }

    return ` href=${quote}#${fallbackId}${quote}`;
  });
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tagImages(html: string) {
  let index = 0;
  return html.replace(/<img\b([^>]*?)>/gi, (match, attrs: string) => {
    let next = attrs
      .replace(/\ssrc='([^']*)'/i, ' src="$1"')
      .replace(/\sdata-ai-editable(=(["']).*?\2)?/gi, '')
      .replace(/\sdata-image-index=(["']).*?\1/gi, '');
    next += ` data-ai-editable="true" data-image-index="${index}"`;
    index += 1;

    if (!/data-ai-image-brief/i.test(next)) {
      const alt = next.match(/\salt=["']([^"']+)["']/i)?.[1] || '';
      next += ` data-ai-image-brief="${escapeAttr(alt || 'business-specific website image')}"`;
    }
    return `<img${next}>`;
  });
}

function ensureStripeButton(html: string) {
  if (/data-ai-text-id=["']stripe-payment-button["']/i.test(html)) {
    return html;
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', `${BUY_BUTTON}</body>`);
  }
  return html + BUY_BUTTON;
}

function injectCmsScript(html: string) {
  const withoutOld = html.replace(/<script\b[^>]*id=["']ope-cms["'][^>]*>[\s\S]*?<\/script>/gi, '');
  if (withoutOld.includes('</body>')) {
    return withoutOld.replace('</body>', `${CMS_SCRIPT}</body>`);
  }
  return withoutOld + CMS_SCRIPT;
}

export function preparePublishedHtmlForEditor(html: string): string {
  let prepared = stripMarkdownFences(html);
  prepared = tagImages(prepared);
  prepared = ensureStripeButton(prepared);
  prepared = injectCmsScript(prepared);
  return prepared;
}

export function prepareGeneratedHtml(raw: string): string {
  let html = stripMarkdownFences(raw);
  html = stripScripts(html);
  html = ensureTailwindScript(html);
  html = stripInlineHandlers(html);
  html = repairInternalLinks(html);
  html = tagImages(html);
  html = ensureStripeButton(html);
  html = injectCmsScript(html);
  return html;
}
