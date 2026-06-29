'use client';

type CouponModalProps = {
  open: boolean;
  couponDiscount: string;
  setCouponDiscount: (value: string) => void;
  couponDetails: string;
  setCouponDetails: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
};

export function CouponModal({
  open,
  couponDiscount,
  setCouponDiscount,
  couponDetails,
  setCouponDetails,
  onClose,
  onCreate,
}: CouponModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 p-8 rounded-3xl border border-yellow-700/60 w-full max-w-lg shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">Coupon Agent</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Add a coupon section to the website. For Venmo, this works as a code/instruction the customer mentions before paying, not an automatic checkout discount.
        </p>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-zinc-300">Discount amount</span>
          <input
            className="w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-yellow-400"
            placeholder="Example: 10%, $25, Free estimate"
            value={couponDiscount}
            onChange={(e) => setCouponDiscount(e.target.value)}
          />
        </label>
        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-zinc-300">Coupon details optional</span>
          <textarea
            className="h-28 w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500 outline-none focus:border-yellow-400"
            placeholder="Example: Valid for first-time customers this month. Mention the coupon before booking."
            value={couponDetails}
            onChange={(e) => setCouponDetails(e.target.value)}
          />
        </label>
        <div className="mt-6 rounded-2xl border border-yellow-800 bg-yellow-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">MVP payment note</p>
          <p className="mt-2 text-sm text-zinc-300">
            Venmo phone-number payment cannot reliably auto-apply a coupon. This creates a visible coupon code and instruction for the owner/customer.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-bold text-white hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="flex-1 rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300"
          >
            Create Coupon
          </button>
        </div>
      </div>
    </div>
  );
}
