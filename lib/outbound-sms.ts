export function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

export async function sendOutboundSms(input: {
  to: string;
  body: string;
}) {
  const to = normalizePhoneNumber(input.to);
  if (!to) {
    return { sent: false, reason: 'Enter a valid US phone number.' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) {
    return { sent: false, reason: 'Server text sending is not configured.' };
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: from,
      To: to,
      Body: input.body,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return { sent: false, reason: errorText.slice(0, 240) || `Twilio returned ${res.status}.` };
  }

  return { sent: true, reason: '' };
}
