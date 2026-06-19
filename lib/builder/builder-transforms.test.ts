import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addAvatarSectionToHtml } from './avatar-html.ts';
import { addCouponToHtml } from './coupon-transforms.ts';
import { findImageTagByIndex, replaceImageSrcByIndex } from './image-transforms.ts';
import { addPageLikeSectionToHtml, removeAddedPageFromHtml } from './page-templates.ts';
import { buildVenmoPayment, updateStripeButtonHtml } from './payment-transforms.ts';

const baseHtml = '<html><body><nav><a href="#top">Home</a></nav><main><section id="top">Home</section></main></body></html>';

describe('builder HTML transforms', () => {
  it('adds and removes page-style sections with their More pages nav link', () => {
    const added = addPageLikeSectionToHtml(baseHtml, 'Menu / Prices');

    assert.equal(added.alreadyExists, false);
    assert.match(added.html, /id="menu-prices"/);
    assert.match(added.html, /id="ope-added-pages-nav"/);
    assert.match(added.html, /href="#menu-prices"/);

    const duplicate = addPageLikeSectionToHtml(added.html, 'Menu / Prices');
    assert.equal(duplicate.alreadyExists, true);

    const removed = removeAddedPageFromHtml(added.html, 'menu-prices');
    assert.doesNotMatch(removed, /id="menu-prices"/);
    assert.doesNotMatch(removed, /href="#menu-prices"/);
  });

  it('adds a coupon section and replaces an older coupon', () => {
    const first = addCouponToHtml(baseHtml, '10%', 'Friends and family launch deal.');
    const second = addCouponToHtml(first, '$25', 'Weekend special.');

    assert.match(second, /id="coupon"/);
    assert.match(second, /\$25 off/);
    assert.match(second, /SAVE25/);
    assert.doesNotMatch(second, /10% off/);
  });

  it('updates editable image src by data-image-index', () => {
    const html = '<main><img src="old.jpg" data-image-index="hero" alt="Hero"><img src="keep.jpg" data-image-index="other"></main>';
    const updated = replaceImageSrcByIndex(html, 'hero', 'data:image/png;base64,new');

    assert.match(findImageTagByIndex(updated, 'hero'), /data:image\/png;base64,new/);
    assert.match(findImageTagByIndex(updated, 'other'), /keep\.jpg/);
  });

  it('updates Venmo payment button metadata and label', () => {
    const html = '<button data-ai-text-id="stripe-payment-button-1">Buy Now</button>';
    const payment = buildVenmoPayment('8015551212', '49', 'Starter kit');
    assert.ok(payment);

    const updated = updateStripeButtonHtml(html, 'stripe-payment-button-1', 'Buy Starter Kit $49', '', payment.fallbackText, {
      venmoPhone: payment.phoneNumber,
      productName: payment.item,
      productPrice: payment.amount,
    });

    assert.match(updated, /Buy Starter Kit \$49/);
    assert.match(updated, /data-venmo-phone="801-555-1212"/);
    assert.match(updated, /data-product-name="Starter kit"/);
    assert.match(updated, /data-product-price="\$49"/);
  });

  it('adds an avatar section with a nav link and editable image metadata', () => {
    const updated = addAvatarSectionToHtml(baseHtml, {
      trade: 'Barista',
      gender: 'Female',
      style: 'Polished cartoon',
      outfit: 'coffee apron',
      mood: 'Friendly',
      pose: 'Waving',
      hairColor: 'Brown',
      eyeColor: 'Green',
      faceFeatures: 'Big smile',
    }, 'Mia Coffee', 'data:image/png;base64,avatar');

    assert.match(updated, /id="business-avatar"/);
    assert.match(updated, /href="#business-avatar"/);
    assert.match(updated, /data-ai-editable="true"/);
    assert.match(updated, /data-image-index="business-avatar-image"/);
  });
});
