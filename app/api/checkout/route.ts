import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

type ProductKey = 'launchSetup' | 'monthlyHosting' | 'guidedDomain';
type CheckoutMode = 'payment' | 'subscription';

const CHECKOUT_PRODUCTS: Record<ProductKey, {
  name: string;
  description: string;
  unitAmount: number;
  mode: CheckoutMode;
  recurring?: { interval: 'month' };
}> = {
  launchSetup: {
    name: 'OnePerson Empire Launch Setup',
    description: 'One-time setup help for publishing a customer site.',
    unitAmount: 9900,
    mode: 'payment',
  },
  monthlyHosting: {
    name: 'OnePerson Empire Hosting + Text Updates',
    description: 'Monthly hosted site support and lightweight text-update tooling.',
    unitAmount: 2900,
    mode: 'subscription',
    recurring: { interval: 'month' },
  },
  guidedDomain: {
    name: 'OnePerson Empire Guided Domain Setup',
    description: 'One-time guided setup for connecting a customer-owned domain.',
    unitAmount: 4900,
    mode: 'payment',
  },
};

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(secretKey);
}

function getBaseUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_URL
    || process.env.NEXT_PUBLIC_BASE_URL
    || req.nextUrl.origin
  ).replace(/\/$/, '');
}

function normalizeProductKey(value: unknown): ProductKey | null {
  return typeof value === 'string' && value in CHECKOUT_PRODUCTS
    ? value as ProductKey
    : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productKey = normalizeProductKey(body.productKey);
    if (!productKey) {
      return NextResponse.json({ error: 'Choose a valid checkout product.' }, { status: 400 });
    }

    const product = CHECKOUT_PRODUCTS[productKey];
    const baseUrl = getBaseUrl(req);

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.unitAmount,
          ...(product.recurring ? { recurring: product.recurring } : {}),
        },
        quantity: 1,
      }],
      mode: product.mode,
      metadata: { productKey },
      success_url: `${baseUrl}/success?product=${productKey}`,
      cancel_url: baseUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
