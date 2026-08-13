'use client';

import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { OpenConfirm, ShowToast } from '@/lib/builder/hooks/useBuilderToasts';
import { escapeHtmlContent, escapeRegExp } from '@/lib/builder/html-utils';
import { findImageTagByIndex, replaceImageSrcByIndex } from '@/lib/builder/image-transforms';
import {
  buildVenmoPayment,
  extractVenmoPhoneNumber,
  formatVenmoPhoneNumber,
  inferCheckoutProvider,
  normalizeCheckoutUrl,
  normalizePaymentAmount,
  parseVenmoPaymentInstructions,
  updatePaymentButtonHtml,
} from '@/lib/builder/payment-transforms';
import {
  formatIdeaWithBusinessMemory,
  readApiResponse,
  type BusinessMemory,
} from '@/lib/builder/home-storage-and-network';
import { AI_COPY_REWRITE_LIMIT, AI_IMAGE_GENERATION_LIMIT } from '@/lib/builder/home-page-config';
import type { ActiveImageEdit } from '@/lib/builder/home-page-types';
import { removeAddedPageFromHtml } from '@/lib/builder/page-templates';

type UsePreviewEditorOptions = {
  agent3Ref: MutableRefObject<string>;
  ideaRef: MutableRefObject<string>;
  businessMemoryRef: MutableRefObject<BusinessMemory>;
  setAgent3: Dispatch<SetStateAction<string>>;
  setRenderKey: Dispatch<SetStateAction<number>>;
  aiCopyRewriteCount: number;
  setAiCopyRewriteCount: Dispatch<SetStateAction<number>>;
  aiImageGenerationCount: number;
  setAiImageGenerationCount: Dispatch<SetStateAction<number>>;
  showToast: ShowToast;
  openConfirm: OpenConfirm;
};

export function usePreviewEditor({
  agent3Ref,
  ideaRef,
  businessMemoryRef,
  setAgent3,
  setRenderKey,
  aiCopyRewriteCount,
  setAiCopyRewriteCount,
  aiImageGenerationCount,
  setAiImageGenerationCount,
  showToast,
  openConfirm,
}: UsePreviewEditorOptions) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTextId, setActiveTextId] = useState('');
  const [modalText, setModalText] = useState('');
  const [activeDeletableSection, setActiveDeletableSection] = useState<{ id: string; label: string } | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [venmoPaymentAmount, setVenmoPaymentAmount] = useState('');
  const [venmoPaymentItem, setVenmoPaymentItem] = useState('');
  const [paymentMode, setPaymentMode] = useState<'venmo' | 'checkout'>('venmo');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [checkoutProvider, setCheckoutProvider] = useState('');
  const [isStripeModal, setIsStripeModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<ActiveImageEdit | null>(null);
  const [imageInstruction, setImageInstruction] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'EDIT_IMAGE') {
        const { imageIndex, instruction, altText, imageBrief, sectionText } = event.data;

        const currentHTML = agent3Ref.current;
        const imageTag = findImageTagByIndex(currentHTML, imageIndex);
        const currentSrc = imageTag.match(/\ssrc=(["'])(.*?)\1/i)?.[2] || '';

        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: instruction,
            idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemoryRef.current),
            imageIndex,
            currentSrc,
            altText,
            imageBrief,
            sectionText,
          }),
        });
        const data = await readApiResponse(res);
        if (data.success) {
          setAgent3((prev) => replaceImageSrcByIndex(prev, imageIndex, String(data.dataUrl || '')));
          setRenderKey((prev) => prev + 1);
        }
      }

      if (event.data?.type === 'OPEN_IMAGE_MODAL') {
        const nextImage = {
          imageIndex: event.data.imageIndex,
          currentSrc: event.data.currentSrc || '',
          altText: event.data.altText || '',
          imageBrief: event.data.imageBrief || '',
          sectionText: event.data.sectionText || '',
        };
        setActiveImage(nextImage);
        setImageInstruction(nextImage.imageBrief || nextImage.altText || '');
        setImageModalOpen(true);
      }

      if (event.data?.type === 'OPEN_TEXT_MODAL') {
        setActiveTextId(event.data.textId);
        setModalText(event.data.currentText || '');
        setActiveDeletableSection(event.data.canDeleteSection && event.data.sectionId
          ? {
            id: String(event.data.sectionId),
            label: String(event.data.sectionLabel || event.data.sectionId),
          }
          : null);
        if (event.data.textId?.startsWith('stripe-payment-button')) {
          const payment = parseVenmoPaymentInstructions(event.data.currentInstructions || '', event.data.currentLink || '');
          const mode = event.data.currentPaymentMode === 'checkout' || event.data.currentLink ? 'checkout' : 'venmo';
          setIsStripeModal(true);
          setPaymentMode(mode);
          setCheckoutUrl(event.data.currentLink || '');
          setCheckoutProvider(event.data.currentCheckoutProvider || inferCheckoutProvider(event.data.currentLink || ''));
          setPaymentInstructions(formatVenmoPhoneNumber(event.data.currentVenmoPhone || payment.phoneNumber));
          setVenmoPaymentAmount(event.data.currentProductPrice || payment.amount);
          setVenmoPaymentItem(event.data.currentProductName || payment.item);
        } else {
          setIsStripeModal(false);
        }
        setModalOpen(true);
      }

      if (event.data?.type === 'OPEN_PAYMENT_MODAL' || event.data?.type === 'OPEN_STRIPE_MODAL') {
        const payment = parseVenmoPaymentInstructions(event.data.currentInstructions || '', event.data.currentLink || '');
        const mode = event.data.currentPaymentMode === 'checkout' || event.data.currentLink ? 'checkout' : 'venmo';
        setActiveTextId(event.data.textId);
        setModalText(event.data.currentText || 'Pay Owner');
        setActiveDeletableSection(null);
        setPaymentMode(mode);
        setCheckoutUrl(event.data.currentLink || '');
        setCheckoutProvider(event.data.currentCheckoutProvider || inferCheckoutProvider(event.data.currentLink || ''));
        setPaymentInstructions(formatVenmoPhoneNumber(event.data.currentVenmoPhone || payment.phoneNumber));
        setVenmoPaymentAmount(event.data.currentProductPrice || payment.amount);
        setVenmoPaymentItem(event.data.currentProductName || payment.item);
        setIsStripeModal(true);
        setModalOpen(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [agent3Ref, businessMemoryRef, ideaRef, setAgent3, setRenderKey]);

  const handleManualSave = () => {
    const isStripe = isStripeModal || activeTextId.startsWith('stripe-payment-button');

    if (isStripe) {
      if (paymentMode === 'checkout') {
        const safeCheckoutUrl = normalizeCheckoutUrl(checkoutUrl);
        if (!safeCheckoutUrl) {
          showToast('Checkout link needed', 'Paste a valid Stripe or PayPal checkout link.', 'error');
          return;
        }
        const provider = checkoutProvider.trim() || inferCheckoutProvider(safeCheckoutUrl);
        const buttonLabel = modalText.trim() && ['Pay Now', 'Buy Now', 'Pay Owner'].includes(modalText.trim()) === false
          ? modalText
          : provider === 'PayPal'
            ? 'Pay with PayPal'
            : provider === 'Stripe'
              ? 'Pay with Card'
              : 'Checkout';
        setAgent3((prev) => updatePaymentButtonHtml(prev, activeTextId, buttonLabel, safeCheckoutUrl, '', {
          venmoPhone: '',
          productName: venmoPaymentItem,
          productPrice: normalizePaymentAmount(venmoPaymentAmount),
          paymentMode: 'checkout',
          checkoutProvider: provider,
        }));
        setRenderKey((prev) => prev + 1);
        setModalOpen(false);
        setActiveDeletableSection(null);
        return;
      }

      if (!extractVenmoPhoneNumber(paymentInstructions)) {
        showToast('Venmo phone needed', 'Please enter your Venmo phone number to receive payments.', 'error');
        return;
      }
      if (!normalizePaymentAmount(venmoPaymentAmount)) {
        showToast('Price needed', 'Enter the fixed price customers should pay.', 'error');
        return;
      }
      const venmoPayment = buildVenmoPayment(paymentInstructions, venmoPaymentAmount, venmoPaymentItem);
      if (!venmoPayment) {
        showToast('Payment setup failed', 'Could not set up the Venmo payment button.', 'error');
        return;
      }
      const buttonLabel = ['Pay Now', 'Buy Now', 'Pay Owner'].includes(modalText.trim())
        ? `${venmoPaymentItem.trim() ? `Pay for ${venmoPaymentItem.trim()} ` : 'Pay Owner '}${normalizePaymentAmount(venmoPaymentAmount)}`
        : modalText;
      setAgent3((prev) => updatePaymentButtonHtml(prev, activeTextId, buttonLabel, '', venmoPayment.fallbackText, {
        venmoPhone: venmoPayment.phoneNumber,
        productName: venmoPayment.item,
        productPrice: venmoPayment.amount,
        paymentMode: 'venmo',
        checkoutProvider: '',
      }));
    } else {
      const safeTextId = escapeRegExp(activeTextId);
      const safeModalText = escapeHtmlContent(modalText);
      const regex = new RegExp(`(data-ai-text-id="${safeTextId}"[^>]*>)(.*?)(<\\/)`, 'gs');
      setAgent3((prev) => prev.replace(regex, (_match, open: string, _oldText: string, close: string) => `${open}${safeModalText}${close}`));
    }
    setRenderKey((prev) => prev + 1);
    setModalOpen(false);
    setActiveDeletableSection(null);
  };

  const deleteActiveAddedPage = () => {
    if (!activeDeletableSection) return;
    const label = activeDeletableSection.label || activeDeletableSection.id;
    openConfirm({
      title: `Delete ${label}?`,
      message: 'This removes the page-style section and its More pages link from the website.',
      confirmLabel: 'Delete Page',
      tone: 'danger',
      onConfirm: () => {
        const nextHtml = removeAddedPageFromHtml(agent3Ref.current, activeDeletableSection.id);
        setAgent3(nextHtml);
        agent3Ref.current = nextHtml;
        setRenderKey((prev) => prev + 1);
        setModalOpen(false);
        setActiveDeletableSection(null);
        showToast('Page deleted', `${label} was removed from the website.`, 'success');
      },
    });
  };

  const handleAISave = async () => {
    if (aiCopyRewriteCount >= AI_COPY_REWRITE_LIMIT) {
      showToast('AI rewrite limit reached', `AI copy rewrites are limited to ${AI_COPY_REWRITE_LIMIT} per site. Manual edits are still unlimited.`, 'info');
      return;
    }

    setIsGenerating(true);
    const isStripe = isStripeModal || activeTextId.startsWith('stripe-payment-button');
    const prompt = isStripe
      ? `Return ONLY 2-4 words. Create a short, clear call-to-action for a local business customer payment button.
Examples: "Pay Owner", "Pay Deposit", "Pay Invoice", "Reserve Spot", "Book Now", "Claim Offer".
No explanations. No full sentences. Just the button text.`
      : `Rewrite this website copy so it sounds polished, specific, and persuasive.
Keep the same subject and important details.
Keep roughly the same length: if it is a paragraph, return a paragraph; if it is a heading, return a heading.
Do not shorten it into a vague slogan.
Return ONLY the rewritten copy.

Original copy:
${modalText}`;

    const res = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await readApiResponse(res);
    if (data.success) {
      let cleanText = String(data.text || '').replace(/['"]/g, '').trim();
      if (isStripe && cleanText.split(' ').length > 4) {
        cleanText = cleanText.split(' ').slice(0, 3).join(' ');
      }
      setModalText(cleanText);
      setAiCopyRewriteCount((prev) => prev + 1);
    }
    setIsGenerating(false);
  };

  const generateActiveImage = async () => {
    if (!activeImage || !imageInstruction.trim()) return;
    if (aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT) {
      showToast('Image limit reached', `AI image generation is limited to ${AI_IMAGE_GENERATION_LIMIT} per site. Uploading real photos is still unlimited.`, 'info');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const currentHTML = agent3Ref.current;
      const imageTag = findImageTagByIndex(currentHTML, activeImage.imageIndex);
      const currentSrc = imageTag.match(/\ssrc=(["'])(.*?)\1/i)?.[2] || activeImage.currentSrc;

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imageInstruction,
          idea: formatIdeaWithBusinessMemory(ideaRef.current, businessMemoryRef.current),
          imageIndex: activeImage.imageIndex,
          currentSrc,
          altText: activeImage.altText,
          imageBrief: activeImage.imageBrief,
          sectionText: activeImage.sectionText,
        }),
      });
      const data = await readApiResponse(res);
      if (data.success) {
        setAgent3((prev) => replaceImageSrcByIndex(prev, activeImage.imageIndex, String(data.dataUrl || '')));
        setRenderKey((prev) => prev + 1);
        setAiImageGenerationCount((prev) => prev + 1);
        setImageModalOpen(false);
      } else {
        showToast('Image generation failed', String(data.error || 'Image generation failed'), 'error');
      }
    } catch (error) {
      showToast('Image generation failed', error instanceof Error ? error.message : 'Image generation failed', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const uploadActiveImage = async (file: File | null) => {
    if (!activeImage || !file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file', 'The selected file is not an image.', 'error');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.readAsDataURL(file);
    });

    setAgent3((prev) => replaceImageSrcByIndex(prev, activeImage.imageIndex, dataUrl));
    setRenderKey((prev) => prev + 1);
    setImageModalOpen(false);
  };

  const testPaymentLink = () => {
    if (paymentMode === 'checkout') {
      const safeCheckoutUrl = normalizeCheckoutUrl(checkoutUrl);
      if (!safeCheckoutUrl) {
        showToast('Checkout link needed', 'Paste a valid Stripe or PayPal checkout link.', 'error');
        return;
      }
      window.open(safeCheckoutUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!extractVenmoPhoneNumber(paymentInstructions)) {
      showToast('Venmo phone needed', 'Please enter your Venmo phone number to receive payments.', 'error');
      return;
    }
    if (!normalizePaymentAmount(venmoPaymentAmount)) {
      showToast('Price needed', 'Enter the fixed price customers should pay.', 'error');
      return;
    }
    const venmoPayment = buildVenmoPayment(paymentInstructions, venmoPaymentAmount, venmoPaymentItem);
    if (venmoPayment) {
      showToast('Venmo payment preview', venmoPayment.fallbackText, 'info');
      return;
    }
    showToast('Payment preview failed', 'Could not preview Venmo payment info.', 'error');
  };

  return {
    modalOpen,
    setModalOpen,
    activeTextId,
    modalText,
    setModalText,
    activeDeletableSection,
    setActiveDeletableSection,
    paymentInstructions,
    setPaymentInstructions,
    venmoPaymentAmount,
    setVenmoPaymentAmount,
    venmoPaymentItem,
    setVenmoPaymentItem,
    paymentMode,
    setPaymentMode,
    checkoutUrl,
    setCheckoutUrl,
    checkoutProvider,
    setCheckoutProvider,
    isStripeModal,
    isGenerating,
    imageModalOpen,
    setImageModalOpen,
    activeImage,
    imageInstruction,
    setImageInstruction,
    isGeneratingImage,
    handleManualSave,
    deleteActiveAddedPage,
    handleAISave,
    generateActiveImage,
    uploadActiveImage,
    testPaymentLink,
  };
}
