'use client';

type StartOverConfirmModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StartOverConfirmModal({ open, onCancel, onConfirm }: StartOverConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-3xl border border-amber-700/60 bg-zinc-900 p-7 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Start over?</p>
        <h2 className="mt-3 text-2xl font-bold text-white">This will start over with a new website.</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          Your current generated website will be cleared from this screen. Cancel if you want to keep editing it.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-bold text-white hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-amber-400 px-4 py-3 font-bold text-black hover:bg-amber-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
