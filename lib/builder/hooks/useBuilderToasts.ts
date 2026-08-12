'use client';

import { useCallback, useRef, useState } from 'react';

import type { AppToast, ConfirmAction } from '@/components/builder/FeedbackOverlays';

export type ShowToast = (title: string, message?: string, tone?: AppToast['tone']) => void;
export type OpenConfirm = (action: NonNullable<ConfirmAction>) => void;

export function useBuilderToasts() {
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const toastIdRef = useRef(0);

  const showToast = useCallback<ShowToast>((title, message = '', tone = 'info') => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { id, title, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const openConfirm = useCallback<OpenConfirm>((action) => {
    setConfirmAction(action);
  }, []);

  const copyText = useCallback(async (text: string, title: string, message: string) => {
    await navigator.clipboard.writeText(text);
    showToast(title, message, 'success');
  }, [showToast]);

  return {
    toasts,
    setToasts,
    confirmAction,
    setConfirmAction,
    showToast,
    openConfirm,
    copyText,
  };
}
