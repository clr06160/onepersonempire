'use client';

export type BuilderAddon = 'none' | 'agents' | 'fun' | 'levelup' | 'memory' | 'edit' | 'expand' | 'invoice' | 'launch' | 'debug';

type LevelUpFeature = {
  level: string;
  name: string;
  status: string;
  description: string;
  payoff: string;
};

type LevelUpPanelProps = {
  features: LevelUpFeature[];
  activeAddon: BuilderAddon;
  onSelectAddon: (addon: BuilderAddon) => void;
};

const LEVEL_UP_GROUPS: {
  title: string;
  eyebrow: string;
  tools: { key: BuilderAddon; label: string; note: string; disabled?: boolean }[];
}[] = [
  {
    title: 'Publish',
    eyebrow: 'Go live',
    tools: [
      { key: 'launch', label: 'Tester launch', note: 'Owner payment setup, live URL publishing, and GoDaddy instructions.' },
      { key: 'debug', label: 'HTML tools', note: 'Copy or download the generated HTML for testing or backup.' },
    ],
  },
  {
    title: 'Get Paid',
    eyebrow: 'Money tools',
    tools: [
      { key: 'launch', label: 'Post-publish tools', note: 'Open the Launch panel for domain setup after publishing.' },
      { key: 'edit', label: 'Rewrite copy', note: 'Tighten selected sales copy before customers see it.' },
    ],
  },
  {
    title: 'Memory',
    eyebrow: 'Save facts',
    tools: [
      { key: 'memory', label: 'Business memory', note: 'Save names, services, payment info, and tone for future agents.' },
      { key: 'expand', label: 'Shop pages', note: 'Add page-style sections for menus, service areas, reviews, and FAQs.' },
    ],
  },
  {
    title: 'Customers',
    eyebrow: 'Sell smarter',
    tools: [
      { key: 'agents', label: 'Offer help', note: 'Open validator, idea hunter, and launch plan agents.' },
      { key: 'levelup', label: 'Future CRM', note: 'Coming later: customer notes, reminders, recurring billing, and follow-ups.', disabled: true },
    ],
  },
];

export function LevelUpPanel({ features, activeAddon, onSelectAddon }: LevelUpPanelProps) {
  return (
    <div className="bg-gradient-to-br from-sky-950 via-black to-zinc-950 border-b border-sky-900/60 px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Level Up</p>
          <h3 className="mt-2 text-2xl font-bold text-white">Serious tools for when the website starts working.</h3>
          <p className="mt-2 max-w-2xl text-sm text-zinc-300">
            Keep the first version simple. These are the upgrades contractors may ask for after they see the site, payments, and invoice links working.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-900 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
          Website first. Business tools next.
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.name} className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-sky-300">{feature.level}</p>
                <p className="mt-1 text-lg font-bold text-white">{feature.name}</p>
              </div>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-100">
                {feature.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{feature.description}</p>
            <p className="mt-3 rounded-xl bg-zinc-950 p-3 text-sm text-zinc-200">
              <span className="font-bold text-sky-300">Why it sells:</span> {feature.payoff}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {LEVEL_UP_GROUPS.map((group) => (
          <div key={group.title} className="rounded-3xl border border-zinc-800 bg-black/50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">{group.eyebrow}</p>
            <p className="mt-1 text-lg font-bold text-white">{group.title}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.tools.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  onClick={() => onSelectAddon(tool.key)}
                  disabled={tool.disabled}
                  className={`rounded-2xl border bg-zinc-950 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    activeAddon === tool.key
                      ? 'border-sky-400 text-white'
                      : 'border-zinc-700 text-zinc-200 hover:border-sky-500 hover:text-white'
                  }`}
                >
                  <span className="text-sm font-bold">{tool.label}</span>
                  <span className="mt-2 block text-xs leading-5 text-zinc-400">{tool.note}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
