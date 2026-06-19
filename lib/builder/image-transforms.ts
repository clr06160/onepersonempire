import { escapeRegExp } from './html-utils';

export const findImageTagByIndex = (html: string, imageIndex: number | string) => {
  const safeImageIndex = escapeRegExp(String(imageIndex));
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map(match => match[0])
    .find(tag => new RegExp(`\\bdata-image-index=(["'])${safeImageIndex}\\1`, 'i').test(tag)) || '';
};

export const replaceImageSrcByIndex = (html: string, imageIndex: number | string, dataUrl: string) => {
  const safeImageIndex = escapeRegExp(String(imageIndex));
  let replaced = false;
  const updated = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!new RegExp(`\\bdata-image-index=(["'])${safeImageIndex}\\1`, 'i').test(tag)) return tag;
    replaced = true;
    if (/\ssrc=(["'])[\s\S]*?\1/i.test(tag)) {
      return tag.replace(/\ssrc=(["'])[\s\S]*?\1/i, ` src="${dataUrl}"`);
    }
    return tag.replace(/<img\b/i, `<img src="${dataUrl}"`);
  });
  return replaced ? updated : html;
};
