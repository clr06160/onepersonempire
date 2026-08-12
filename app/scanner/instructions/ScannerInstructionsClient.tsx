'use client';

import { useCallback, useEffect, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import {
  quickReference,
  sharedConcepts,
  systemInstructions,
  type InstructionSection,
} from '@/lib/scanner-instructions-content';
import type { LearnedPainOverlay, ScannerInstructionSystem } from '@/lib/scanner-instructions';

type ScannerUser = { email: string; role: string };

type LiveInstructions = {
  generatedAt?: string;
  learnedPainOverlay?: LearnedPainOverlay;
  systems?: ScannerInstructionSystem[];
};

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function InlineText({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={`${index}-${part}`} className="font-semibold text-zinc-100">
            {part}
          </strong>
        ) : (
          <span key={`${index}-${part}`}>{part}</span>
        ),
      )}
    </>
  );
}

function SectionBlock({ section, level = 2 }: { section: InstructionSection; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <section id={section.id} className="scroll-mt-24 border-t border-zinc-800 pt-8 first:border-t-0 first:pt-0">
      <Heading className="text-xl font-semibold text-zinc-100">{section.title}</Heading>
      {section.subtitle ? <p className="mt-1 text-sm text-emerald-400/90">{section.subtitle}</p> : null}
      {section.backtest ? (
        <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-xs text-zinc-400">
          {section.backtest}
        </p>
      ) : null}
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
        {section.body.map((paragraph, index) => (
          <p key={`${section.id}-body-${index}`}>
            <InlineText text={paragraph} />
          </p>
        ))}
      </div>
      {section.steps?.length ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          {section.steps.map((step, index) => (
            <li key={`${section.id}-step-${index}`}>
              <InlineText text={step} />
            </li>
          ))}
        </ol>
      ) : null}
      {section.cautions?.length ? (
        <ul className="mt-4 space-y-2 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-100/90">
          {section.cautions.map((item, index) => (
            <li key={`${section.id}-caution-${index}`} className="flex gap-2">
              <span className="text-amber-500">⚠</span>
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function ScannerInstructionsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [live, setLive] = useState<LiveInstructions | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const [sessionResponse, instructionsResponse] = await Promise.all([
      fetch('/api/scanner/session', fetchInit),
      fetch('/api/scanner/instructions', fetchInit),
    ]);
    const payload = await sessionResponse.json();
    setUser(payload.user || null);
    if (instructionsResponse.ok) {
      const instructionsPayload = await instructionsResponse.json();
      setLive(instructionsPayload.data || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSession]);

  const toc = [
    ...(live?.learnedPainOverlay ? [{ id: 'live-regime', label: 'Live regime (today)' }] : []),
    ...sharedConcepts.map((s) => ({ id: s.id, label: s.title })),
    ...systemInstructions.map((s) => ({ id: s.id, label: s.title })),
    { id: 'quick-reference', label: 'Quick reference table' },
  ];

  const regimeNotesById = Object.fromEntries(
    (live?.systems || []).filter((s) => s.regimeNote).map((s) => [s.id, s.regimeNote as string]),
  );
  const learnedPain = live?.learnedPainOverlay;

  return (
    <>
      <ScannerExtrasNav active="/scanner/instructions" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">On this page</p>
              <ul className="max-h-[70vh] space-y-1 overflow-y-auto text-sm">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="block rounded-lg px-2 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
            <p className="text-sm text-zinc-500">Logged in as {user.email}</p>
            {live?.generatedAt ? (
              <p className="mt-2 text-sm text-zinc-400">
                Live overlay updated: <span className="font-semibold text-emerald-300">{live.generatedAt}</span>
              </p>
            ) : null}
            <p className="mt-4 text-zinc-300">
              How to actually trade each scanner system — rebalance timing, which list to use, position sizing, and
              PowerTrend / QQQ200 rules. Numbers come from the research backtests; live baskets are on the{' '}
              <a href="/scanner" className="text-emerald-300 hover:text-emerald-200">
                main scanner
              </a>
              .
            </p>

            <div className="mt-10 space-y-10">
              {learnedPain ? (
                <section
                  id="live-regime"
                  className="scroll-mt-24 rounded-2xl border border-amber-800/50 bg-amber-950/20 p-6"
                >
                  <h2 className="text-xl font-semibold text-amber-100">
                    {learnedPain.title || 'Learned pain overlay — core only'}
                  </h2>
                  {learnedPain.summary ? <p className="mt-3 text-sm text-zinc-300">{learnedPain.summary}</p> : null}
                  {learnedPain.live?.label ? (
                    <p className="mt-4 rounded-xl border border-amber-800/40 bg-zinc-950/60 p-4 text-sm text-amber-100">
                      Today:{' '}
                      <span className="font-semibold">{learnedPain.badge || 'LEARNED PAIN - CORE'}</span>
                      {' · '}
                      {learnedPain.live.label}
                      {' · scale '}
                      {learnedPain.live.scalePct ?? 'n/a'}%
                      {' · pain '}
                      {learnedPain.live.painProbPct ?? 'n/a'}
                      {learnedPain.live.reason ? ` · ${learnedPain.live.reason}` : ''}
                      {learnedPain.live.asOf ? ` · as of ${learnedPain.live.asOf}` : ''}
                    </p>
                  ) : null}
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {learnedPain.thresholds?.length ? (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Thresholds</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
                          {learnedPain.thresholds.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {learnedPain.stacking?.length ? (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Stacking with core
                        </h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
                          {learnedPain.stacking.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <div>
                <h2 className="mb-6 text-2xl font-semibold">Shared concepts</h2>
                <div className="space-y-10">
                  {sharedConcepts.map((section) => (
                    <SectionBlock key={section.id} section={section} />
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-2 text-2xl font-semibold">System-by-system</h2>
                <p className="mb-8 text-sm text-zinc-400">One section per dropdown option on the scanner.</p>
                <div className="space-y-10">
                  {systemInstructions.map((section) => (
                    <div key={section.id}>
                      <SectionBlock section={section} />
                      {regimeNotesById[section.id] ? (
                        <div className="mt-4 rounded-xl border border-sky-800/60 bg-sky-950/30 p-4 text-sm text-sky-100">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-400/80">
                            Current overlay signal
                          </p>
                          {regimeNotesById[section.id]}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <section id="quick-reference" className="scroll-mt-24 border-t border-zinc-800 pt-8">
                <h2 className="text-xl font-semibold">Quick reference table</h2>
                <p className="mt-2 text-sm text-zinc-400">At-a-glance cheat sheet. Details above.</p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-4 py-3 font-medium">System</th>
                        <th className="px-4 py-3 font-medium">When to rebalance</th>
                        <th className="px-4 py-3 font-medium">Which list</th>
                        <th className="px-4 py-3 font-medium">Sizing</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      {quickReference.map((row) => (
                        <tr key={row.system} className="border-b border-zinc-800/80 last:border-0">
                          <td className="px-4 py-3 font-medium text-zinc-100">{row.system}</td>
                          <td className="px-4 py-3">{row.when}</td>
                          <td className="px-4 py-3">{row.basket}</td>
                          <td className="px-4 py-3">{row.sizing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-5 text-sm text-zinc-400">
                <p className="font-medium text-zinc-200">Disclaimer</p>
                <p className="mt-2">
                  These instructions describe how the backtests and live scanner are built — not personal financial
                  advice. Past simulated performance includes survivorship and data-cache assumptions. Always size
                  positions for your own risk tolerance.
                </p>
              </section>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
