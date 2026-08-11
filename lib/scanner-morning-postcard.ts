import { isAlertMailConfigured, sendAlertEmail } from '@/lib/scanner-alert-mail';
import { listEnabledAlertPrefs } from '@/lib/scanner-alert-store';
import { loadLatestDeskBrief } from '@/lib/scanner-desk-brief';
import { getGardenUrl, getMorningNoteUrl } from '@/lib/scanner-product-urls';

export type PostcardDispatchResult = {
  mailConfigured: boolean;
  recipients: number;
  emailed: number;
  failed: number;
  asOf: string;
  message: string;
};

function postcardBody(brief: Awaited<ReturnType<typeof loadLatestDeskBrief>>) {
  const headline = brief.headline || 'Morning postcard';
  const bullets = (brief.bullets || []).slice(0, 5);
  const sectionBits = (brief.sections || [])
    .slice(0, 2)
    .map((section) => `${section.title}: ${section.body}`)
    .filter(Boolean);
  const lines = [
    headline,
    '',
    ...bullets.map((line) => `• ${line}`),
    ...(bullets.length ? [''] : []),
    ...sectionBits,
    '',
    'You don’t have to trade — this is just today’s read.',
    `Garden: ${getGardenUrl()}`,
    `Morning note: ${getMorningNoteUrl()}`,
  ].filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''));

  return {
    subject: `Dream Tree postcard · ${brief.asOf || 'today'}`,
    text: lines.join('\n'),
    html: `
      <div style="font-family:Georgia,serif;max-width:560px;line-height:1.5;color:#18181b">
        <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#059669">Dream Tree · morning postcard</p>
        <h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(headline)}</h1>
        ${bullets.length ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
        ${sectionBits.map((bit) => `<p>${escapeHtml(bit)}</p>`).join('')}
        <p style="color:#71717a;font-size:14px">You don’t have to trade — this is just today’s read.</p>
        <p><a href="${getGardenUrl()}">Open Today</a> · <a href="${getMorningNoteUrl()}">Morning note</a></p>
      </div>
    `,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function dispatchMorningPostcards(opts?: {
  onlyEmail?: string;
}): Promise<PostcardDispatchResult> {
  const brief = await loadLatestDeskBrief();
  const mailConfigured = isAlertMailConfigured();
  const prefs = await listEnabledAlertPrefs();
  const recipients = prefs.filter((row) => {
    if (!row.events.morningPostcard) return false;
    if (opts?.onlyEmail) return row.email === opts.onlyEmail.toLowerCase();
    return true;
  });

  if (!brief.connected || !brief.headline) {
    return {
      mailConfigured,
      recipients: recipients.length,
      emailed: 0,
      failed: 0,
      asOf: brief.asOf,
      message: 'No morning note ready yet.',
    };
  }

  if (!mailConfigured) {
    return {
      mailConfigured: false,
      recipients: recipients.length,
      emailed: 0,
      failed: 0,
      asOf: brief.asOf,
      message: 'Email provider is not configured.',
    };
  }

  if (!recipients.length) {
    return {
      mailConfigured,
      recipients: 0,
      emailed: 0,
      failed: 0,
      asOf: brief.asOf,
      message: 'No Watchers opted into the morning postcard.',
    };
  }

  const body = postcardBody(brief);
  let emailed = 0;
  let failed = 0;
  for (const row of recipients) {
    const result = await sendAlertEmail({
      to: row.email,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
    if (result.ok) emailed += 1;
    else failed += 1;
  }

  return {
    mailConfigured,
    recipients: recipients.length,
    emailed,
    failed,
    asOf: brief.asOf,
    message:
      failed > 0
        ? `Sent ${emailed}/${recipients.length} postcards (${failed} failed).`
        : `Sent ${emailed} morning postcard${emailed === 1 ? '' : 's'}.`,
  };
}
