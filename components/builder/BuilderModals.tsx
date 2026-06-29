'use client';

import { CouponModal } from '@/components/builder/modals/CouponModal';
import { ImageEditModal } from '@/components/builder/modals/ImageEditModal';
import { StartOverConfirmModal } from '@/components/builder/modals/StartOverConfirmModal';
import { TextEditModal } from '@/components/builder/modals/TextEditModal';
import type { ActiveImageEdit } from '@/lib/builder/home-page-types';

export type BuilderModalsProps = {
  startOverConfirmOpen: boolean;
  onCancelStartOver: () => void;
  onConfirmStartOver: () => void;
  couponModalOpen: boolean;
  couponDiscount: string;
  setCouponDiscount: (value: string) => void;
  couponDetails: string;
  setCouponDetails: (value: string) => void;
  onCloseCouponModal: () => void;
  onCreateCoupon: () => void;
  imageModalOpen: boolean;
  activeImage: ActiveImageEdit | null;
  imageInstruction: string;
  setImageInstruction: (value: string) => void;
  isGeneratingImage: boolean;
  aiImageGenerationCount: number;
  onCloseImageModal: () => void;
  onUploadImage: (file: File | null) => void;
  onGenerateImage: () => void;
  modalOpen: boolean;
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
  onCloseTextModal: () => void;
  onSaveText: () => void;
  onAiSaveText: () => void;
  onDeleteAddedPage: () => void;
  onTestPaymentLink: () => void;
};

export function BuilderModals(props: BuilderModalsProps) {
  return (
    <>
      <StartOverConfirmModal
        open={props.startOverConfirmOpen}
        onCancel={props.onCancelStartOver}
        onConfirm={props.onConfirmStartOver}
      />
      <CouponModal
        open={props.couponModalOpen}
        couponDiscount={props.couponDiscount}
        setCouponDiscount={props.setCouponDiscount}
        couponDetails={props.couponDetails}
        setCouponDetails={props.setCouponDetails}
        onClose={props.onCloseCouponModal}
        onCreate={props.onCreateCoupon}
      />
      <ImageEditModal
        open={props.imageModalOpen}
        activeImage={props.activeImage}
        imageInstruction={props.imageInstruction}
        setImageInstruction={props.setImageInstruction}
        isGeneratingImage={props.isGeneratingImage}
        aiImageGenerationCount={props.aiImageGenerationCount}
        onClose={props.onCloseImageModal}
        onUpload={props.onUploadImage}
        onGenerate={props.onGenerateImage}
      />
      <TextEditModal
        open={props.modalOpen}
        activeTextId={props.activeTextId}
        isStripeModal={props.isStripeModal}
        modalText={props.modalText}
        setModalText={props.setModalText}
        paymentMode={props.paymentMode}
        setPaymentMode={props.setPaymentMode}
        venmoPaymentItem={props.venmoPaymentItem}
        setVenmoPaymentItem={props.setVenmoPaymentItem}
        venmoPaymentAmount={props.venmoPaymentAmount}
        setVenmoPaymentAmount={props.setVenmoPaymentAmount}
        paymentInstructions={props.paymentInstructions}
        setPaymentInstructions={props.setPaymentInstructions}
        checkoutUrl={props.checkoutUrl}
        setCheckoutUrl={props.setCheckoutUrl}
        checkoutProvider={props.checkoutProvider}
        setCheckoutProvider={props.setCheckoutProvider}
        activeDeletableSection={props.activeDeletableSection}
        setActiveDeletableSection={props.setActiveDeletableSection}
        isGenerating={props.isGenerating}
        aiCopyRewriteCount={props.aiCopyRewriteCount}
        onClose={props.onCloseTextModal}
        onSave={props.onSaveText}
        onAiSave={props.onAiSaveText}
        onDeleteAddedPage={props.onDeleteAddedPage}
        onTestPaymentLink={props.onTestPaymentLink}
      />
    </>
  );
}
