'use client';

import { useMemo, useState } from 'react';

type AvatarOption = {
  id: string;
  label: string;
};

type VectorAvatarConfig = {
  skin: string;
  hair: string;
  eyes: string;
  mouth: string;
  outfit: string;
  tool: string;
  pet: string;
};

type VectorAvatarBuilderProps = {
  defaultRole: string;
  onAddToSite: (imageUrl: string, outfitSummary: string) => void;
};

const SKIN_OPTIONS: AvatarOption[] = [
  { id: 'warm', label: 'Warm' },
  { id: 'deep', label: 'Deep' },
  { id: 'light', label: 'Light' },
];

const HAIR_OPTIONS: AvatarOption[] = [
  { id: 'short-brown', label: 'Short Brown' },
  { id: 'long-blonde', label: 'Long Blonde' },
  { id: 'pink-buns', label: 'Pink Buns' },
];

const EYE_OPTIONS: AvatarOption[] = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'cool', label: 'Cool' },
  { id: 'sparkle', label: 'Sparkle' },
];

const MOUTH_OPTIONS: AvatarOption[] = [
  { id: 'smile', label: 'Smile' },
  { id: 'excited', label: 'Excited' },
  { id: 'confident', label: 'Confident' },
];

const OUTFIT_OPTIONS: AvatarOption[] = [
  { id: 'apron', label: 'Shop Apron' },
  { id: 'hoodie', label: 'Creator Hoodie' },
  { id: 'work-shirt', label: 'Work Shirt' },
];

const TOOL_OPTIONS: AvatarOption[] = [
  { id: 'none', label: 'None' },
  { id: 'cup', label: 'Cup' },
  { id: 'brush', label: 'Brush' },
  { id: 'sparkle', label: 'Sparkle' },
];

const PET_OPTIONS: AvatarOption[] = [
  { id: 'none', label: 'None' },
  { id: 'blob', label: 'Blob Pet' },
  { id: 'cat', label: 'Tiny Cat' },
];

const OPTION_GROUPS: { key: keyof VectorAvatarConfig; label: string; options: AvatarOption[] }[] = [
  { key: 'skin', label: 'Skin', options: SKIN_OPTIONS },
  { key: 'hair', label: 'Hair', options: HAIR_OPTIONS },
  { key: 'eyes', label: 'Eyes', options: EYE_OPTIONS },
  { key: 'mouth', label: 'Mouth', options: MOUTH_OPTIONS },
  { key: 'outfit', label: 'Outfit', options: OUTFIT_OPTIONS },
  { key: 'tool', label: 'Tool', options: TOOL_OPTIONS },
  { key: 'pet', label: 'Pet', options: PET_OPTIONS },
];

const skinColor = (skin: string) => {
  if (skin === 'deep') return '#8b5638';
  if (skin === 'light') return '#ffd9bd';
  return '#c98255';
};

const hairFill = (hair: string) => {
  if (hair === 'long-blonde') return '#facc6b';
  if (hair === 'pink-buns') return '#f472b6';
  return '#5b3428';
};

const outfitFill = (outfit: string) => {
  if (outfit === 'hoodie') return '#8b5cf6';
  if (outfit === 'work-shirt') return '#0ea5e9';
  return '#0f766e';
};

function svgMarkup(config: VectorAvatarConfig, role: string) {
  const skin = skinColor(config.skin);
  const hair = hairFill(config.hair);
  const outfit = outfitFill(config.outfit);
  const eye = config.eyes === 'sparkle' ? '#7c3aed' : config.eyes === 'cool' ? '#0f172a' : '#1f2937';

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${role} vector avatar">
  <rect width="512" height="512" rx="64" fill="#f8fafc"/>
  <circle cx="256" cy="238" r="166" fill="#ede9fe"/>
  ${config.pet === 'blob' ? '<path d="M350 390c-22-34 16-72 53-58 34 13 35 61 3 77-20 10-44 2-56-19z" fill="#86efac" stroke="#0f172a" stroke-width="8"/><circle cx="385" cy="365" r="5" fill="#0f172a"/><circle cx="411" cy="365" r="5" fill="#0f172a"/>' : ''}
  ${config.pet === 'cat' ? '<path d="M352 397l16-52 28 25 31-23 9 55c-24 19-61 17-84-5z" fill="#fdba74" stroke="#0f172a" stroke-width="8"/><circle cx="388" cy="380" r="5" fill="#0f172a"/><circle cx="414" cy="380" r="5" fill="#0f172a"/>' : ''}
  <path d="M155 432c12-95 190-95 202 0z" fill="${outfit}" stroke="#0f172a" stroke-width="10"/>
  ${config.outfit === 'apron' ? '<path d="M202 327h108l-12 111h-84z" fill="#134e4a" opacity=".9"/><path d="M224 365h64v42h-64z" fill="#0f766e" stroke="#e0f2fe" stroke-width="5"/>' : ''}
  ${config.outfit === 'hoodie' ? '<path d="M192 348c14-48 114-48 128 0" fill="none" stroke="#c4b5fd" stroke-width="18" stroke-linecap="round"/><path d="M230 368v66M282 368v66" stroke="#c4b5fd" stroke-width="7" stroke-linecap="round"/>' : ''}
  ${config.outfit === 'work-shirt' ? '<path d="M212 341l44 42 44-42" fill="none" stroke="#e0f2fe" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M216 400h80" stroke="#075985" stroke-width="8" stroke-linecap="round"/>' : ''}
  <circle cx="256" cy="200" r="101" fill="${skin}" stroke="#0f172a" stroke-width="10"/>
  ${config.hair === 'short-brown' ? `<path d="M157 190c-9-84 128-127 190-46 18 29 11 61-2 83-46-52-104-60-184-19z" fill="${hair}" stroke="#0f172a" stroke-width="9"/>` : ''}
  ${config.hair === 'long-blonde' ? `<path d="M151 202c-12-108 148-138 204-51 35 56 10 139-8 178-36-24-145-24-181 0-17-48-23-88-15-127z" fill="${hair}" stroke="#0f172a" stroke-width="9"/><path d="M176 190c37-46 95-55 156-14" fill="none" stroke="#fde68a" stroke-width="16" stroke-linecap="round"/>` : ''}
  ${config.hair === 'pink-buns' ? `<circle cx="157" cy="164" r="38" fill="${hair}" stroke="#0f172a" stroke-width="9"/><circle cx="355" cy="164" r="38" fill="${hair}" stroke="#0f172a" stroke-width="9"/><path d="M173 164c18-61 148-61 166 0 2 18-2 38-8 53-50-36-101-36-151 0-7-17-10-36-7-53z" fill="${hair}" stroke="#0f172a" stroke-width="9"/>` : ''}
  ${config.eyes === 'cool' ? `<path d="M198 199h43M271 199h43" stroke="${eye}" stroke-width="12" stroke-linecap="round"/><circle cx="220" cy="199" r="6" fill="#38bdf8"/><circle cx="292" cy="199" r="6" fill="#38bdf8"/>` : ''}
  ${config.eyes !== 'cool' ? `<circle cx="218" cy="205" r="13" fill="#fff"/><circle cx="294" cy="205" r="13" fill="#fff"/><circle cx="218" cy="205" r="7" fill="${eye}"/><circle cx="294" cy="205" r="7" fill="${eye}"/>` : ''}
  ${config.eyes === 'sparkle' ? '<path d="M205 181l8 15 15 8-15 8-8 15-8-15-15-8 15-8zM304 181l8 15 15 8-15 8-8 15-8-15-15-8 15-8z" fill="#f0abfc"/>' : ''}
  <path d="M256 214l-12 33h27z" fill="#b86f49" opacity=".7"/>
  ${config.mouth === 'smile' ? '<path d="M218 265c23 27 55 27 78 0" fill="none" stroke="#0f172a" stroke-width="10" stroke-linecap="round"/>' : ''}
  ${config.mouth === 'excited' ? '<path d="M215 260c22 42 61 42 83 0z" fill="#0f172a"/><path d="M235 265h42" stroke="#fff" stroke-width="8" stroke-linecap="round"/>' : ''}
  ${config.mouth === 'confident' ? '<path d="M225 266c22 14 46 14 68 0" fill="none" stroke="#0f172a" stroke-width="10" stroke-linecap="round"/>' : ''}
  ${config.tool === 'cup' ? '<path d="M354 281h58l-9 93h-40z" fill="#f8fafc" stroke="#0f172a" stroke-width="8"/><path d="M360 315h47" stroke="#38bdf8" stroke-width="12"/><path d="M362 281l8-22h29l8 22" fill="#facc15" stroke="#0f172a" stroke-width="8"/>' : ''}
  ${config.tool === 'brush' ? '<path d="M104 353l76-76" stroke="#f59e0b" stroke-width="16" stroke-linecap="round"/><path d="M173 269l31 31-28 15-18-18z" fill="#f8fafc" stroke="#0f172a" stroke-width="7"/>' : ''}
  ${config.tool === 'sparkle' ? '<path d="M385 94l15 37 37 15-37 15-15 37-15-37-37-15 37-15z" fill="#f0abfc" stroke="#86198f" stroke-width="7"/>' : ''}
</svg>`.trim();
}

const encodeSvgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function VectorAvatarBuilder({ defaultRole, onAddToSite }: VectorAvatarBuilderProps) {
  const [config, setConfig] = useState<VectorAvatarConfig>({
    skin: 'warm',
    hair: 'short-brown',
    eyes: 'friendly',
    mouth: 'smile',
    outfit: 'apron',
    tool: 'cup',
    pet: 'blob',
  });

  const svg = useMemo(() => svgMarkup(config, defaultRole), [config, defaultRole]);
  const imageUrl = useMemo(() => encodeSvgDataUrl(svg), [svg]);

  const selectOption = (key: keyof VectorAvatarConfig, value: string) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const selectedSummary = OPTION_GROUPS
    .map((group) => group.options.find((option) => option.id === config[group.key])?.label)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mt-5 rounded-3xl border border-fuchsia-800 bg-black/50 p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Working avatar builder</p>
          <p className="mt-1 text-lg font-bold text-white">Click features and they line up</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
            This uses aligned vector parts instead of the broken generated sprite sheet. It is basic, but it actually works.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAddToSite(imageUrl, selectedSummary)}
          className="rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-black text-white hover:bg-fuchsia-400"
        >
          Add This Avatar
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-3xl border border-fuchsia-900 bg-white p-4">
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="space-y-4">
          {OPTION_GROUPS.map((group) => (
            <div key={group.key} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{group.label}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const isSelected = config[group.key] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectOption(group.key, option.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        isSelected
                          ? 'border-fuchsia-300 bg-fuchsia-500 text-white'
                          : 'border-zinc-700 bg-black text-zinc-200 hover:border-fuchsia-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
