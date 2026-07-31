'use client';

import { useEffect, useState } from 'react';

import { MISTAKE_GROUPS, type MistakeRule } from '@/lib/scanner-mistakes-rules';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

function RuleCard({ rule }: { rule: MistakeRule }) {
  const isHard = rule.severity === 'hard';

  return (
    <article
      className={`rounded-xl border p-5 ${
        isHard ? 'border-red-900/70 bg-red-950/20' : 'border-zinc-800 bg-zinc-950/70'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className={`text-lg font-semibold ${isHard ? 'text-red-100' : 'text-zinc-100'}`}>{rule.rule}</h3>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isHard ? 'border-red-800 text-red-300' : 'border-zinc-700 text-zinc-400'
          }`}
        >
          {isHard ? 'Kill switch' : 'Rule'}
        </span>
      </div>

      <p className="mt-3 text-sm text-zinc-300">{rule.why}</p>

      {rule.tell ? (
        <p className="mt-3 border-l-2 border-amber-700 pl-3 text-sm italic text-amber-200">
          Tell: &ldquo;{rule.tell}&rdquo;
        </p>
      ) : null}

      <p className="mt-3 text-xs text-zinc-600">added {rule.addedOn}</p>
    </article>
  );
}

export default function MistakesClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scanner/session', { cache: 'no-store', credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return;
        setUser(payload?.user || null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <ScannerExtrasNav active="/scanner/mistakes" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading rules...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-6">
            <h2 className="text-xl font-semibold text-amber-100">How to use this page</h2>
            <p className="mt-2 max-w-3xl text-sm text-amber-100/80">
              Kill switches have no exceptions — when one fires, the action is already decided and there is nothing left
              to think about. For everything else, the moment I start reasoning about whether a rule applies to this
              situation, that reasoning is the signal that it does.
            </p>
          </section>

          {MISTAKE_GROUPS.map((group) => (
            <section key={group.id} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">{group.label}</h2>
                <p className="mt-1 text-sm text-zinc-400">{group.note}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
