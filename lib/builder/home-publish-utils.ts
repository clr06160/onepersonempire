import { parsePublishedSiteSlug } from '@/lib/builder/home-storage-and-network';
import type { PublishedSiteCredentials } from '@/lib/builder/home-page-types';

export const stripWwwPrefix = (domain: string) => domain.replace(/^www\./, '');

export const buildEditLinkBackupMessage = (params: {
  slug: string;
  publishedUrl: string;
  siteEditUrl: string;
}) => {
  const slug = params.slug || parsePublishedSiteSlug(params.publishedUrl);
  return [
    `Your private OnePerson Empire edit link${slug ? ` for ${slug}` : ''}:`,
    params.siteEditUrl,
    '',
    'Bookmark this to edit your site later. Do not share publicly.',
  ].join('\n');
};

export const parseEditLinkCredentials = (
  siteEditUrl: string,
  publishSlug = '',
): PublishedSiteCredentials | null => {
  if (!siteEditUrl) return null;
  try {
    const parsed = new URL(siteEditUrl);
    const slug = parsed.searchParams.get('edit') || publishSlug;
    const key = parsed.searchParams.get('key') || '';
    if (!slug || !key) return null;
    return { slug, key };
  } catch {
    return null;
  }
};

export const buildDomainSetupInstructions = (domainExample: string, domainTarget: string) => {
  const rootDomain = stripWwwPrefix(domainExample);
  return [
    'Use your own domain with your OnePerson Empire website:',
    '',
    '1. Publish your site.',
    '2. Enter your domain and click Save domain.',
    '3. Open Show DNS records and give those records to GoDaddy.',
    `4. After GoDaddy updates DNS, wait a little while, then open your site at www.${rootDomain}`,
    '',
    `Domain: ${rootDomain}`,
    '',
    'DNS record for www:',
    'Type: CNAME',
    'Name: www',
    `Value: ${domainTarget}`,
    '',
    'Root domain forwarding:',
    `Forward ${rootDomain} to https://www.${rootDomain}`,
    '',
    'You keep control of your domain. No second website builder or hosting plan needed.',
  ].join('\n');
};

export const PAYMENT_SETUP_SCRIPT = [
  'Quick payment setup question for your website:',
  '',
  'For the first tester version, the easiest option is your Venmo phone number. Customers click the payment button and see where to send payment.',
  '',
  'If you already use Stripe or PayPal, send me your Stripe Payment Link or PayPal checkout/pay link instead, and I can make the button open that checkout page.',
  '',
  'Please send one of these:',
  '1. Venmo phone number, plus the product/service name and price',
  '2. Stripe Payment Link',
  '3. PayPal checkout/pay link',
].join('\n');

export const formatPublishedSiteLoadedStatus = (updatedAt?: string) => (
  updatedAt
    ? `Loaded published site (last updated ${new Date(updatedAt).toLocaleString()}). Edit and republish when ready.`
    : 'Loaded published site. Edit and republish when ready.'
);

export const formatPublishSuccessStatus = (params: {
  assetCount?: number;
  chunkCount?: number;
  needsSafetyReview?: boolean;
}) => {
  const reviewStatus = params.needsSafetyReview ? ' Safety review needs human follow-up.' : '';
  return `Published. Uploaded ${params.assetCount || 0} image asset(s), saved ${params.chunkCount || 0} HTML chunk(s).${reviewStatus}`;
};
