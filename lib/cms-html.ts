/** Post-process AI-generated HTML so the parent iframe CMS always works. */

const CMS_SCRIPT = `<script id="ope-cms">
document.addEventListener('DOMContentLoaded', function () {
  var isBuilderPreview = window.parent !== window;
  var isEditMode = window.__OPE_EDIT_MODE__ === true;

  if (isBuilderPreview && isEditMode) {
    var editStyle = document.createElement('style');
    editStyle.id = 'ope-edit-affordances';
    editStyle.textContent = [
      '[data-ai-text-id], img[data-ai-editable]{outline:2px solid transparent;outline-offset:4px;transition:outline-color .15s ease,box-shadow .15s ease;cursor:pointer;}',
      '[data-ai-text-id]:hover, img[data-ai-editable]:hover{outline-color:#22c55e;box-shadow:0 0 0 6px rgba(34,197,94,.16);}',
      '[data-ai-text-id]{position:relative;}',
      '[data-ai-text-id][data-ope-edit-label]:hover::after,img[data-ai-editable][data-ope-edit-label]:hover::after{content:attr(data-ope-edit-label);position:absolute;left:0;top:-2rem;z-index:99999;white-space:nowrap;border-radius:999px;background:#020617;color:#ecfdf5;border:1px solid rgba(34,197,94,.55);padding:.35rem .6rem;font:700 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);}',
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

  document.querySelectorAll('img[data-ai-editable]').forEach(function (img) {
    if (!isBuilderPreview || !isEditMode) return;
    img.style.cursor = 'pointer';
    img.setAttribute('title', 'Replace photo');
    img.setAttribute('data-ope-edit-label', 'Replace photo');
    img.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var section = img.closest('section, header, main, div');
      var sectionText = section ? (section.innerText || section.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500) : '';
      window.parent.postMessage({
        type: 'OPEN_IMAGE_MODAL',
        imageIndex: parseInt(img.getAttribute('data-image-index') || '0', 10),
        currentSrc: img.getAttribute('src') || '',
        altText: img.getAttribute('alt') || '',
        imageBrief: img.getAttribute('data-ai-image-brief') || '',
        sectionText: sectionText
      }, '*');
    }, true);
  });

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
