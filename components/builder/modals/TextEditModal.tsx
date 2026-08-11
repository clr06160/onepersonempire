'use client';

import { AI_COPY_REWRITE_LIMIT } from '@/lib/builder/home-page-config';
import {
  buildVenmoPayment,
  formatVenmoPhoneNumber,
  inferCheckoutProvider,
  normalizeCheckoutUrl,
} from '@/lib/builder/payment-transforms';

type TextEditModalProps = {
  open: boolean;
  activeTextId: string;
  isStripeModal: boolean;
  modalText: string;
  setModalText: (value: string) => void;
  paymentMode: 'venmo' | 'checkout';
  setPaymentMode: (mode: 'venmo' | 'checkout') => void;
  venmoPaymentItem: string;
  setVenmoPaymentItem: (value: string) => void;
  venmoPaymentAmount: string;
  setVenmoPaymentAmount: (value: string) => void;
  paymentInstructions: string;
  setPaymentInstructions: (value: string) => void;
  checkoutUrl: string;
  setCheckoutUrl: (value: string) => void;
  checkoutProvider: string;
  setCheckoutProvider: (value: string | ((current: string) => string)) => void;
  activeDeletableSection: { id: string; label: string } | null;
  setActiveDeletableSection: (value: { id: string; label: string } | null) => void;
  isGenerating: boolean;
  aiCopyRewriteCount: number;
  onClose: () => void;
  onSave: () => void;
  onAiSave: () => void;
  onDeleteAddedPage: () => void;
  onTestPaymentLink: () => void;
};

export function TextEditModal({
  open,
  activeTextId,
  isStripeModal,
  modalText,
  setModalText,
  paymentMode,
  setPaymentMode,
  venmoPaymentItem,
  setVenmoPaymentItem,
  venmoPaymentAmount,
  setVenmoPaymentAmount,
  paymentInstructions,
  setPaymentInstructions,
  checkoutUrl,
  setCheckoutUrl,
  checkoutProvider,
  setCheckoutProvider,
  activeDeletableSection,
  setActiveDeletableSection,
  isGenerating,
  aiCopyRewriteCount,
  onClose,
  onSave,
  onAiSave,
  onDeleteAddedPage,
  onTestPaymentLink,
}: TextEditModalProps) {
  if (!open) return null;

  const isPaymentModal = isStripeModal || activeTextId.startsWith('stripe-payment-button');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700 w-full max-w-lg shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">
          {isPaymentModal ? 'Set Up Owner Payment Button' : 'Edit Content'}
        </h2>

        {isPaymentModal ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
              <p className="text-sm font-bold text-white">Payment setup</p>
              <p className="mt-1 text-sm text-zinc-400">
                Start simple with Venmo. Upgrade later by pasting a Stripe Payment Link or PayPal checkout link. No API keys needed.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('venmo')}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    paymentMode === 'venmo'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-emerald-600'
                  }`}
                >
                  Venmo / Manual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('checkout');
                    setCheckoutProvider((current) => current || inferCheckoutProvider(checkoutUrl));
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    paymentMode === 'checkout'
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-sky-600'
                  }`}
                >
                  Stripe / PayPal Link
                </button>
              </div>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-300">Button text</span>
              <input
                className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                placeholder="Pay Owner"
                value={modalText}
                onChange={(e) => setModalText(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Owner&apos;s product or service</span>
                <input
                  className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                  placeholder="Example: Full detail"
                  value={venmoPaymentItem}
                  onChange={(e) => setVenmoPaymentItem(e.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Customer price</span>
                <input
                  className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                  placeholder="Example: $149"
                  value={venmoPaymentAmount}
                  onChange={(e) => setVenmoPaymentAmount(e.target.value)}
                />
              </label>
            </div>
            {paymentMode === 'venmo' ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-zinc-300">Owner&apos;s Venmo phone number</span>
                  <input
                    className="w-full p-4 bg-black rounded-xl border border-zinc-700"
                    placeholder="555-555-5555"
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(formatVenmoPhoneNumber(e.target.value))}
                  />
                </label>
                {buildVenmoPayment(paymentInstructions, venmoPaymentAmount, venmoPaymentItem) && (
                  <p className="rounded-2xl border border-zinc-800 bg-black/50 p-4 text-sm text-zinc-300">
                    Venmo is ready. Customers click the button and see exactly where to send payment.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3 rounded-2xl border border-sky-900 bg-sky-950/20 p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-sky-100">Stripe or PayPal checkout link</span>
                  <input
                    className="w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500"
                    placeholder="https://buy.stripe.com/... or https://paypal.me/..."
                    value={checkoutUrl}
                    onChange={(e) => {
                      setCheckoutUrl(e.target.value);
                      setCheckoutProvider(inferCheckoutProvider(e.target.value));
                    }}
                  />
                </label>
                <p className="text-sm text-zinc-300">
                  Use a Stripe Payment Link or PayPal checkout/pay link owned by the business. OnePerson Empire does not store card data or API keys in this lite setup.
                </p>
                {normalizeCheckoutUrl(checkoutUrl) && (
                  <p className="rounded-xl border border-sky-800 bg-black/50 p-3 text-sm text-sky-100">
                    Checkout link detected: {checkoutProvider || inferCheckoutProvider(checkoutUrl)}
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onTestPaymentLink}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
            >
              {paymentMode === 'checkout' ? 'Open Checkout Link' : 'Preview Customer Payment Info'}
            </button>
          </div>
        ) : (
          <>
            <textarea
              className="w-full h-32 bg-black p-4 rounded-xl border border-zinc-700 mb-4"
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
            />
            {activeDeletableSection && (
              <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/20 p-4">
                <p className="text-sm font-bold text-red-200">Added page: {activeDeletableSection.label}</p>
                <p className="mt-1 text-xs leading-5 text-red-100/80">
                  Changed your mind? Delete this page-style section and its More pages link.
                </p>
                <button
                  type="button"
                  onClick={onDeleteAddedPage}
                  className="mt-3 rounded-xl border border-red-700 px-4 py-2 text-sm font-bold text-red-100 hover:border-red-400 hover:bg-red-950"
                >
                  Delete Page
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex gap-4 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 py-3 bg-zinc-700 rounded-xl font-bold"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onAiSave}
            disabled={isGenerating || aiCopyRewriteCount >= AI_COPY_REWRITE_LIMIT}
            className="flex-1 py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50"
          >
            {isGenerating ? '...' : aiCopyRewriteCount >= AI_COPY_REWRITE_LIMIT ? 'Limit Hit' : '✨ AI Rewrite'}
          </button>
        </div>
      </div>
    </div>
  );
}
