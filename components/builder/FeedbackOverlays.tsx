'use client';

export type AppToast = {
  id: number;
  title: string;
  message?: string;
  tone: 'success' | 'error' | 'info';
};

export type ConfirmAction = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'cost' | 'info';
  onConfirm: () => void;
} | null;

type FeedbackOverlaysProps = {
  toasts: AppToast[];
  confirmAction: ConfirmAction;
  onDismissToast: (id: number) => void;
  onCancelConfirm: () => void;
  onRunConfirm: () => void;
};

export function FeedbackOverlays({
  toasts,
  confirmAction,
  onDismissToast,
  onCancelConfirm,
  onRunConfirm,
}: FeedbackOverlaysProps) {
  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-2xl border p-4 shadow-2xl backdrop-blur ${
                toast.tone === 'success'
                  ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-50'
                  : toast.tone === 'error'
                    ? 'border-rose-500/50 bg-rose-950/90 text-rose-50'
                    : 'border-sky-500/50 bg-sky-950/90 text-sky-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black">{toast.title}</p>
                  {toast.message && <p className="mt-1 text-sm opacity-85">{toast.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onDismissToast(toast.id)}
                  className="rounded-full px-2 text-lg leading-none opacity-70 hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <p className={`text-xs font-black uppercase tracking-[0.25em] ${
              confirmAction.tone === 'danger'
                ? 'text-rose-300'
                : confirmAction.tone === 'cost'
                  ? 'text-fuchsia-300'
                  : 'text-sky-300'
            }`}>
              Confirm
            </p>
            <h2 className="mt-3 text-2xl font-black text-white">{confirmAction.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{confirmAction.message}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancelConfirm}
                className="flex-1 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 hover:border-zinc-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onRunConfirm}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white ${
                  confirmAction.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : confirmAction.tone === 'cost'
                      ? 'bg-fuchsia-600 hover:bg-fuchsia-500'
                      : 'bg-sky-600 hover:bg-sky-500'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
