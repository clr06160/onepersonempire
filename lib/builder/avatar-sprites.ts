export type AvatarSpriteFrame = {
  id: string;
  label: string;
  kind: 'base' | 'hair' | 'eyes' | 'mouth' | 'outfit' | 'tool' | 'pet' | 'badge' | 'decor';
  rarity: 'starter' | 'uncommon' | 'rare';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AvatarSpritePack = {
  id: string;
  name: string;
  src: string;
  frameSize: number;
  status?: 'placeholder' | 'generated';
  purpose?: string;
  cropReady?: boolean;
  frames: AvatarSpriteFrame[];
};

const frame = (
  id: string,
  label: string,
  kind: AvatarSpriteFrame['kind'],
  rarity: AvatarSpriteFrame['rarity'],
  x: number,
  y: number,
): AvatarSpriteFrame => ({
  id,
  label,
  kind,
  rarity,
  x,
  y,
  width: 256,
  height: 256,
});

export const AVATAR_SPRITE_PACKS: AvatarSpritePack[] = [
  {
    id: 'poc-one-person',
    name: 'POC One-Person Avatar Sheet',
    src: '/avatar-sprites/poc-one-person.png',
    frameSize: 256,
    status: 'generated',
    purpose: 'Small production test: one consistent person with basic reusable parts before creating a large collection.',
    cropReady: false,
    frames: [
      frame('poc-base', 'Base Person', 'base', 'starter', 0, 0),
      frame('poc-hair-short', 'Short Hair', 'hair', 'starter', 256, 0),
      frame('poc-hair-long', 'Long Hair', 'hair', 'starter', 512, 0),
      frame('poc-eyes-friendly', 'Friendly Eyes', 'eyes', 'starter', 768, 0),
      frame('poc-mouth-smile', 'Smile', 'mouth', 'starter', 0, 256),
      frame('poc-mouth-excited', 'Excited Mouth', 'mouth', 'starter', 256, 256),
      frame('poc-outfit-apron', 'Shop Apron', 'outfit', 'starter', 512, 256),
      frame('poc-outfit-hoodie', 'Creator Hoodie', 'outfit', 'starter', 768, 256),
      frame('poc-tool-cup', 'Cup Tool', 'tool', 'starter', 0, 512),
      frame('poc-tool-brush', 'Brush Tool', 'tool', 'starter', 256, 512),
      frame('poc-pet-blob', 'Blob Pet', 'pet', 'uncommon', 512, 512),
      frame('poc-badge-first-sale', 'First Sale Badge', 'badge', 'rare', 768, 512),
    ],
  },
  {
    id: 'starter-pack',
    name: 'Starter Shop Avatar Pack',
    src: '/avatar-sprites/starter-pack.svg',
    frameSize: 256,
    status: 'placeholder',
    purpose: 'Hand-coded fallback sheet used while generated production parts are being tested.',
    cropReady: true,
    frames: [
      frame('base-light', 'Base Light', 'base', 'starter', 0, 0),
      frame('base-deep', 'Base Deep', 'base', 'starter', 256, 0),
      frame('hair-short', 'Short Hair', 'hair', 'starter', 512, 0),
      frame('hair-long', 'Long Hair', 'hair', 'starter', 768, 0),
      frame('eyes-cool', 'Cool Eyes', 'eyes', 'starter', 0, 256),
      frame('eyes-bright', 'Bright Eyes', 'eyes', 'starter', 256, 256),
      frame('mouth-smile', 'Smile', 'mouth', 'starter', 512, 256),
      frame('mouth-goofy', 'Goofy Mouth', 'mouth', 'uncommon', 768, 256),
      frame('outfit-apron', 'Shop Apron', 'outfit', 'starter', 0, 512),
      frame('outfit-hoodie', 'Creator Hoodie', 'outfit', 'starter', 256, 512),
      frame('tool-brush', 'Paint Brush', 'tool', 'starter', 512, 512),
      frame('tool-cup', 'Cafe Cup', 'tool', 'starter', 768, 512),
      frame('pet-blob', 'Blob Pet', 'pet', 'uncommon', 0, 768),
      frame('badge-first-sale', 'First Sale Badge', 'badge', 'rare', 256, 768),
      frame('shop-sign', 'Shop Sign', 'decor', 'starter', 512, 768),
      frame('sparkle', 'Sparkle', 'decor', 'starter', 768, 768),
    ],
  },
];

export const POC_AVATAR_SPRITE_PACK = AVATAR_SPRITE_PACKS[0];
export const STARTER_AVATAR_SPRITE_PACK = AVATAR_SPRITE_PACKS[1];
