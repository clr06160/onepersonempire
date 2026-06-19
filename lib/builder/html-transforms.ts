export const setPreviewModeHtml = (html: string, isEditMode: boolean) => {
  const modeScript = `<script id="ope-preview-mode">window.__OPE_EDIT_MODE__=${isEditMode ? 'true' : 'false'};</script>`;
  const withoutOld = html.replace(/<script\b[^>]*id=["']ope-preview-mode["'][^>]*>[\s\S]*?<\/script>/gi, '');
  if (withoutOld.includes('</head>')) {
    return withoutOld.replace('</head>', `${modeScript}</head>`);
  }
  return `${modeScript}${withoutOld}`;
};
