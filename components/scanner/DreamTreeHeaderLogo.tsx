'use client';

const TREE_SRC = '/brand/dream-tree-header.webp?v=9';

type DreamTreeHeaderLogoProps = {
  className?: string;
};

/** Full 2026 tree — gallery matte cutout on light sky (see art_lab/build_header_tree.py). */
export default function DreamTreeHeaderLogo({ className = '' }: DreamTreeHeaderLogoProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl bg-[#e8f4fc] ring-1 ring-zinc-300/50 ${className}`}
      title="Dream Tree Stocks"
      aria-label="Dream Tree Stocks logo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TREE_SRC} alt="" className="h-full w-full object-cover object-bottom" />
    </div>
  );
}
