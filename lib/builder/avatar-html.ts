import { addPageNavLinkToHtml } from './page-templates';
import { escapeHtmlContent } from './html-utils';

export type AvatarConfig = {
  trade: string;
  gender: string;
  style: string;
  outfit: string;
  mood: string;
  pose: string;
  hairColor: string;
  eyeColor: string;
  faceFeatures: string;
};

export const buildAvatarSectionHtml = (config: AvatarConfig, businessName: string, imageUrl: string) => {
  const sectionId = 'business-avatar';
  const safeTrade = escapeHtmlContent(config.trade || 'Business creator');
  const safeMood = escapeHtmlContent(config.mood || 'Friendly');
  const safeStyle = escapeHtmlContent(config.style || 'Polished cartoon');
  const safeOutfit = escapeHtmlContent(config.outfit || 'business-matching outfit');
  const safeBusiness = escapeHtmlContent(businessName || 'this business');
  const safeImageUrl = escapeHtmlContent(imageUrl);

  return `
<section id="${sectionId}" style="min-height: 100vh; background: radial-gradient(circle at top left, #f5d0fe, #f8fafc 45%, #dbeafe); color: #0f172a; padding: 80px 24px;">
  <div style="max-width: 1120px; margin: 0 auto; display: grid; gap: 40px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-items: center;">
    <div>
      <p style="font-size: 13px; font-weight: 900; letter-spacing: .24em; text-transform: uppercase; color: #7c3aed;" data-ai-text-id="${sectionId}-eyebrow">Business avatar</p>
      <h2 style="font-size: clamp(44px, 7vw, 76px); line-height: .92; margin: 16px 0 0; font-weight: 950;" data-ai-text-id="${sectionId}-heading">Meet the ${safeTrade}</h2>
      <p style="margin-top: 24px; font-size: 20px; line-height: 1.7; color: #475569;" data-ai-text-id="${sectionId}-intro">This is the character for ${safeBusiness}: a ${safeMood.toLowerCase()} ${safeStyle.toLowerCase()} avatar wearing ${safeOutfit}. Use it as a mascot, sticker, social post, or friendly guide.</p>
      <div style="margin-top: 28px; display: flex; flex-wrap: wrap; gap: 12px;">
        <span style="border-radius: 999px; background: white; border: 1px solid #ddd6fe; padding: 10px 14px; font-weight: 800;" data-ai-text-id="${sectionId}-style">Style: ${safeStyle}</span>
        <span style="border-radius: 999px; background: white; border: 1px solid #ddd6fe; padding: 10px 14px; font-weight: 800;" data-ai-text-id="${sectionId}-mood">Mood: ${safeMood}</span>
      </div>
    </div>
    <div style="border-radius: 36px; background: rgba(255,255,255,.78); border: 1px solid rgba(124,58,237,.22); padding: 18px; box-shadow: 0 30px 80px rgba(15,23,42,.14);">
      <img src="${safeImageUrl}" alt="${safeTrade} avatar for ${safeBusiness}" style="display: block; width: 100%; border-radius: 28px; object-fit: cover;" data-ai-editable="true" data-image-index="${sectionId}-image" data-ai-image-brief="A fun cartoon business avatar for ${safeBusiness}" />
    </div>
  </div>
</section>`;
};

export const addAvatarSectionToHtml = (html: string, config: AvatarConfig, businessName: string, imageUrl: string) => {
  const sectionId = 'business-avatar';
  const withoutOldAvatar = html.replace(/<section\b[^>]*id=["']business-avatar["'][\s\S]*?<\/section>/i, '');
  const withNav = /href=["']#business-avatar["']/i.test(withoutOldAvatar)
    ? withoutOldAvatar
    : addPageNavLinkToHtml(withoutOldAvatar, sectionId, 'Avatar');
  const avatarHtml = buildAvatarSectionHtml(config, businessName, imageUrl);

  if (/<\/main>/i.test(withNav)) {
    return withNav.replace(/<\/main>/i, `${avatarHtml}</main>`);
  }
  return withNav.replace(/<\/body>/i, `${avatarHtml}</body>`);
};
