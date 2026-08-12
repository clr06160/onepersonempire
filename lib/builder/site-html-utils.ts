/** Strip ```html fences the model sometimes leaves in generated HTML. */
export const stripMarkdownHtmlFences = (html: string) => {
  if (!html) return '';
  const backticks = String.fromCharCode(96, 96, 96);
  return html.split(`${backticks}html`).join('').split(backticks).join('').trim();
};

export const downloadHtmlFile = (html: string, filenamePrefix = 'onepersonempire-site') => {
  const cleaned = stripMarkdownHtmlFences(html);
  if (!cleaned) return false;

  const blob = new Blob([cleaned], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
};
