'use client';

import Image from 'next/image';

import { AI_IMAGE_GENERATION_LIMIT } from '@/lib/builder/home-page-config';
import type { ActiveImageEdit } from '@/lib/builder/home-page-types';

type ImageEditModalProps = {
  open: boolean;
  activeImage: ActiveImageEdit | null;
  imageInstruction: string;
  setImageInstruction: (value: string) => void;
  isGeneratingImage: boolean;
  aiImageGenerationCount: number;
  onClose: () => void;
  onUpload: (file: File | null) => void;
  onGenerate: () => void;
};

export function ImageEditModal({
  open,
  activeImage,
  imageInstruction,
  setImageInstruction,
  isGeneratingImage,
  aiImageGenerationCount,
  onClose,
  onUpload,
  onGenerate,
}: ImageEditModalProps) {
  if (!open || !activeImage) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-700 w-full max-w-xl shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">Replace Photo</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Real business photos usually build the most trust. Upload one if you have it, or generate an AI image if you do not.
        </p>

        {activeImage.currentSrc && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-zinc-700 bg-black">
            <Image
              src={activeImage.currentSrc}
              alt="Current selected website image"
              width={900}
              height={315}
              unoptimized
              className="max-h-56 w-full object-cover"
            />
          </div>
        )}

        <label className="block mb-5 rounded-2xl border border-dashed border-emerald-600 bg-emerald-950/20 p-5 text-center cursor-pointer hover:border-emerald-400">
          <span className="block font-semibold text-white">Upload Real Photo</span>
          <span className="block mt-1 text-sm text-emerald-100">Best choice: real job photo, product, storefront, logo, team photo, or before/after image.</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0] || null)}
          />
        </label>

        <div className="mb-6 rounded-2xl border border-purple-900 bg-purple-950/20 p-4">
          <p className="text-sm font-bold text-purple-200">No real photo yet?</p>
          <p className="mt-1 text-sm text-zinc-400">
            Use AI to generate an image. You can replace it with a real owner photo later if you want.
          </p>
          <textarea
            className="mt-3 h-28 w-full rounded-xl border border-zinc-700 bg-black p-4 text-white placeholder-zinc-500"
            placeholder="Describe a simple, believable placeholder image..."
            value={imageInstruction}
            onChange={(e) => setImageInstruction(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGeneratingImage || !imageInstruction.trim() || aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT}
            className="flex-1 py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50"
          >
            {isGeneratingImage ? 'Generating…' : aiImageGenerationCount >= AI_IMAGE_GENERATION_LIMIT ? 'Image Limit Hit' : 'Generate AI Image'}
          </button>
        </div>
      </div>
    </div>
  );
}
