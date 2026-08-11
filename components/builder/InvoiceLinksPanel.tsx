'use client';

import { openSmsComposer } from '@/lib/builder/home-storage-and-network';

type InvoiceLinksPanelProps = {
  publishedUrl: string;
  invoiceCustomerName: string;
  setInvoiceCustomerName: (value: string) => void;
  invoiceAmount: string;
  setInvoiceAmount: (value: string) => void;
  invoiceDescription: string;
  setInvoiceDescription: (value: string) => void;
  invoiceUrl: string;
  isCreatingInvoice: boolean;
  onCreateInvoice: () => void;
};

export function InvoiceLinksPanel({
  publishedUrl,
  invoiceCustomerName,
  setInvoiceCustomerName,
  invoiceAmount,
  setInvoiceAmount,
  invoiceDescription,
  setInvoiceDescription,
  invoiceUrl,
  isCreatingInvoice,
  onCreateInvoice,
}: InvoiceLinksPanelProps) {
  return (
    <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4">
      <p className="text-sm font-semibold text-emerald-300">Invoice links</p>
      <p className="mt-2 text-sm text-zinc-300">
        Create a pay-ready invoice link and send it by text, email, or however you already talk to customers.
        {!publishedUrl && ' Publish the site first so the invoice attaches to the right business.'}
      </p>
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
            placeholder="Customer name optional"
            value={invoiceCustomerName}
            onChange={(e) => setInvoiceCustomerName(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
            placeholder="Amount, example 250"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-700 bg-black p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
            placeholder="For, example gutter cleaning"
            value={invoiceDescription}
            onChange={(e) => setInvoiceDescription(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onCreateInvoice}
            disabled={isCreatingInvoice || !invoiceAmount.trim() || !invoiceDescription.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isCreatingInvoice ? 'Creating...' : 'Create Invoice Link'}
          </button>
          {invoiceUrl && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => openSmsComposer(`Invoice for ${invoiceDescription.trim()}: ${invoiceUrl}`)}
                className="rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm font-bold text-zinc-200 hover:border-emerald-500 hover:text-white"
              >
                Text Invoice Link
              </button>
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Open invoice
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
