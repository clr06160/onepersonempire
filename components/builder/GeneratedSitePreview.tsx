'use client';

type GeneratedSitePreviewProps = {
  html: string;
  renderKey: number;
  isEditing: boolean;
  cleanHtml: (html: string) => string;
  setPreviewModeHtml: (html: string, isEditMode: boolean) => string;
};

export function GeneratedSitePreview({
  html,
  renderKey,
  isEditing,
  cleanHtml,
  setPreviewModeHtml,
}: GeneratedSitePreviewProps) {
  return (
    <iframe
      key={renderKey}
      srcDoc={setPreviewModeHtml(cleanHtml(html), isEditing)}
      className="h-[720px] w-full border-0"
      title="Website Preview"
    />
  );
}
