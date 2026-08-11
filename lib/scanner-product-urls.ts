/** Public product URLs for Dream Tree Stocks / Flight Deck. */

export function getProductBaseUrl() {
  const configured = (
    process.env.NEXT_PUBLIC_PRODUCT_BASE_URL ||
    process.env.PRODUCT_BASE_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (configured) return configured;
  return 'https://dreamtreestocks.com';
}

export function getFlightDeckUrl() {
  return `${getProductBaseUrl()}/scanner/cockpit`;
}

export function getGardenUrl() {
  return `${getProductBaseUrl()}/scanner/garden`;
}

export function getMorningNoteUrl() {
  return `${getProductBaseUrl()}/scanner/desk-brief`;
}

export function getScannerLoginUrl() {
  return `${getProductBaseUrl()}/scanner`;
}
