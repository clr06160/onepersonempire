import nodemailer from 'nodemailer';

import { getFlightDeckUrl } from '@/lib/scanner-product-urls';

export type SendAlertEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendAlertEmailResult = {
  ok: boolean;
  provider: 'gmail-smtp' | 'resend' | 'none';
  id?: string;
  error?: string;
};

function smtpUser() {
  return process.env.SCANNER_SMTP_USER?.trim() || '';
}

function smtpPass() {
  return process.env.SCANNER_SMTP_PASS?.trim() || '';
}

function smtpHost() {
  const configured = process.env.SCANNER_SMTP_HOST?.trim();
  if (configured) return configured;
  const user = smtpUser().toLowerCase();
  if (user.endsWith('@gmail.com') || user.endsWith('@googlemail.com')) return 'smtp.gmail.com';
  return '';
}

/** Resend wants either `email@domain` or `Name <email@domain>`. */
function configuredFrom() {
  const raw =
    process.env.SCANNER_ALERT_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    (smtpUser() ? `Flight Deck <${smtpUser()}>` : '') ||
    'Flight Deck <alerts@dreamtreestocks.com>';
  return raw.replace(/^["']|["']$/g, '').trim();
}

export function isAlertMailConfigured() {
  return Boolean((smtpUser() && smtpPass() && smtpHost()) || process.env.RESEND_API_KEY?.trim());
}

async function sendViaGmailSmtp(input: SendAlertEmailInput): Promise<SendAlertEmailResult> {
  const user = smtpUser();
  const pass = smtpPass();
  const host = smtpHost();
  if (!user || !pass || !host) {
    return { ok: false, provider: 'none', error: 'Gmail SMTP is not configured.' };
  }

  const port = Number(process.env.SCANNER_SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
  const secure = process.env.SCANNER_SMTP_SECURE
    ? process.env.SCANNER_SMTP_SECURE === 'true'
    : port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: configuredFrom(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, provider: 'gmail-smtp', id: String(info.messageId || '') };
  } catch (error) {
    return {
      ok: false,
      provider: 'gmail-smtp',
      error: error instanceof Error ? error.message : 'Gmail SMTP send failed.',
    };
  }
}

async function sendViaResend(input: SendAlertEmailInput): Promise<SendAlertEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, provider: 'none', error: 'RESEND_API_KEY is not set.' };
  }

  try {
    const from = configuredFrom();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
      statusCode?: number;
    };

    if (!response.ok) {
      const raw = payload.message || payload.name || `Resend HTTP ${response.status}`;
      const lower = String(raw).toLowerCase();
      const hint =
        lower.includes('domain') && (lower.includes('verif') || lower.includes('not'))
          ? `${raw} Confirm dreamtreestocks.com is Verified at resend.com/domains.`
          : lower.includes('api key') || response.status === 401
            ? `${raw} Re-check RESEND_API_KEY on Cloud Run.`
            : String(raw);
      console.error('[alert-mail] Resend rejected', {
        status: response.status,
        from,
        to: input.to,
        message: raw,
      });
      return { ok: false, provider: 'resend', error: hint };
    }

    return { ok: true, provider: 'resend', id: payload.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resend send failed.';
    console.error('[alert-mail] Resend threw', message);
    return { ok: false, provider: 'resend', error: `Resend request failed: ${message}` };
  }
}

export async function sendAlertEmail(input: SendAlertEmailInput): Promise<SendAlertEmailResult> {
  // Prefer Resend once configured (branded alerts@dreamtreestocks.com).
  // Gmail SMTP remains a local/dev fallback only.
  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend(input);
  }
  if (smtpUser() && smtpPass() && smtpHost()) {
    return sendViaGmailSmtp(input);
  }
  return {
    ok: false,
    provider: 'none',
    error:
      'No email provider configured. Set RESEND_API_KEY on Cloud Run (preferred for alerts@dreamtreestocks.com), or SCANNER_SMTP_USER + SCANNER_SMTP_PASS.',
  };
}

export function formatAlertEmail(args: {
  events: Array<{ title: string; detail: string }>;
  asOf: string;
  bookTickers: string[];
  addedTickers?: string[];
  removedTickers?: string[];
  cashBrake: boolean;
  powerTrendOn: boolean;
  powerTrendLabel?: string;
  totalReturnPct?: number;
}) {
  const deckUrl = getFlightDeckUrl();
  const book = args.bookTickers.map((t) => t.toUpperCase());
  const removed = (args.removedTickers || []).map((t) => t.toUpperCase());
  const added = (args.addedTickers || []).map((t) => t.toUpperCase()).filter((t) => book.includes(t));
  const addedSet = new Set(added);
  const holding = book.filter((t) => !addedSet.has(t));

  const ptLabel = args.powerTrendOn
    ? `ON${args.powerTrendLabel ? ` · ${args.powerTrendLabel}` : ''}`
    : 'OFF';
  const cashLabel = args.cashBrake ? 'ON' : 'clear';

  const ret =
    typeof args.totalReturnPct === 'number' && Number.isFinite(args.totalReturnPct)
      ? args.totalReturnPct
      : null;
  const retLabel = ret == null ? '—' : `${ret > 0 ? '+' : ''}${ret.toFixed(2)}%`;
  const retColor = ret == null ? '#a1a1aa' : ret >= 0 ? '#34d399' : '#f87171';

  const lines = [
    'Flight Deck',
    `Live scoreboard: ${retLabel}`,
    '',
    `New positions today: ${added.length ? added.join(' · ') : 'none'}`,
    `Positions holding: ${holding.length ? holding.join(' · ') : 'none'}`,
    removed.length ? `Off the book: ${removed.join(' · ')}` : '',
    '',
    ...args.events.map((event) => `${event.title}: ${event.detail}`),
    '',
    `PowerTrend: ${ptLabel}`,
    `Cash brake: ${cashLabel}`,
    `As of: ${args.asOf || 'n/a'}`,
    '',
    deckUrl,
  ].filter(Boolean);

  const chipRow = (tickers: string[], kind: 'new' | 'hold') => {
    if (!tickers.length) {
      return `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="font-family:Arial,sans-serif;font-size:13px;color:#71717a">none</td></tr></table>`;
    }
    const rows: string[] = [];
    for (let i = 0; i < tickers.length; i += 4) {
      const chunk = tickers.slice(i, i + 4);
      const cells = chunk
        .map((ticker, j) => {
          const pad = j > 0 ? `<td width="6" style="font-size:0">&nbsp;</td>` : '';
          if (kind === 'new') {
            return `${pad}<td bgcolor="#059669" style="padding:8px 12px;font-family:Consolas,Monaco,monospace;font-size:14px;font-weight:bold;color:#ffffff">${ticker}</td>`;
          }
          return `${pad}<td bgcolor="#09090b" style="padding:8px 12px;border:1px solid #52525b;font-family:Consolas,Monaco,monospace;font-size:14px;font-weight:bold;color:#ffffff">${ticker}</td>`;
        })
        .join('');
      rows.push(`<tr>${cells}</tr>`);
    }
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0">${rows.join('')}</table>`;
  };

  // Gmail-safe scoreboard (no SVG — many clients strip it).
  const meterPct =
    ret == null ? 50 : Math.round(((Math.max(-20, Math.min(40, ret)) + 20) / 60) * 100);
  const gaugeHtml = `
    <table role="presentation" width="240" cellspacing="0" cellpadding="0" align="center" border="0" style="margin:12px auto">
      <tr>
        <td align="center" bgcolor="#27272a" style="padding:18px 22px;border-radius:10px">
          <p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:32px;font-weight:bold;line-height:1.1;color:${retColor}">${retLabel}</p>
          <p style="margin:8px 0 12px;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:0.2em;color:#a1a1aa">LIVE SCOREBOARD</p>
          <table role="presentation" width="200" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td bgcolor="${ret == null ? '#52525b' : retColor}" width="${meterPct}%" height="8" style="font-size:0;line-height:0">&nbsp;</td>
              <td bgcolor="#52525b" width="${100 - meterPct}%" height="8" style="font-size:0;line-height:0">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0b">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0b">
    <tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:520px;max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:14px">
        <tr><td style="padding:22px 22px 6px;font-family:Segoe UI,Helvetica,Arial,sans-serif" align="center">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#d97706">Flight Deck</p>
          <div style="margin:14px 0 4px">${gaugeHtml}</div>
        </td></tr>

        <tr><td style="padding:18px 22px 6px;font-family:Segoe UI,Helvetica,Arial,sans-serif">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#fafafa">New positions today:</p>
          ${chipRow(added, 'new')}
        </td></tr>

        <tr><td style="padding:16px 22px 6px;font-family:Segoe UI,Helvetica,Arial,sans-serif">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#fafafa">Positions holding:</p>
          ${chipRow(holding, 'hold')}
          ${
            removed.length
              ? `<p style="margin:12px 0 0;font-size:12px;color:#71717a">Off: <span style="color:#fca5a5;font-family:ui-monospace,Consolas,monospace">${removed.join(' · ')}</span></p>`
              : ''
          }
        </td></tr>

        ${
          args.events.length
            ? `<tr><td style="padding:10px 22px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif">
          ${args.events
            .map(
              (event) =>
                `<p style="margin:0 0 6px;font-size:12px;color:#71717a"><span style="color:#a1a1aa">${event.title}</span> — ${event.detail}</p>`,
            )
            .join('')}
        </td></tr>`
            : ''
        }

        <tr><td style="padding:18px 22px 8px;font-family:Segoe UI,Helvetica,Arial,sans-serif;border-top:1px solid #27272a">
          <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa">
            PowerTrend
            <strong style="color:${args.powerTrendOn ? '#34d399' : '#a1a1aa'};margin-left:6px">${ptLabel}</strong>
          </p>
          <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa">
            Cash brake
            <strong style="color:${args.cashBrake ? '#f87171' : '#a1a1aa'};margin-left:6px">${cashLabel}</strong>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#52525b">As of ${args.asOf || 'n/a'}</p>
        </td></tr>

        <tr><td style="padding:12px 22px 22px;font-family:Segoe UI,Helvetica,Arial,sans-serif">
          <a href="${deckUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#d97706;color:#09090b;font-size:13px;font-weight:700;text-decoration:none">Open Flight Deck</a>
          <p style="margin:14px 0 0;font-size:11px;color:#52525b">Dream Tree Stocks</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  const subject =
    added.length > 0
      ? `Flight Deck: new ${added.slice(0, 4).join(' · ')}${added.length > 4 ? '…' : ''}`
      : args.events.length === 1
        ? `Flight Deck: ${args.events[0].title}`
        : `Flight Deck: ${Math.max(args.events.length, 1)} update${
            Math.max(args.events.length, 1) === 1 ? '' : 's'
          }`;

  return { subject, text: lines.join('\n'), html };
}

