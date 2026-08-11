'use client';

import Link from 'next/link';

import {
  CORE_DESK_ALLOCATION,
  CORE_DESK_HERO,
  CORE_DESK_LINKS,
  CORE_DESK_ONE_LINER,
  CORE_DESK_SECTIONS,
} from '@/lib/scanner-core-desk';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

export default function CoreDeskClient() {
  return (
    <div className="space-y-8">
      <ScannerExtrasNav active="/scanner/core" />

      <header className="overflow-hidden rounded-3xl border border-emerald-800/40 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-400">{CORE_DESK_HERO.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-emerald-50 sm:text-5xl">{CORE_DESK_HERO.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">{CORE_DESK_HERO.summary}</p>
        <p className="mt-5 rounded-2xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm font-medium leading-6 text-emerald-100/90">
          {CORE_DESK_ONE_LINER}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-500">Allocation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CORE_DESK_ALLOCATION.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{row.label}</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{row.pct}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{row.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-5">
        {CORE_DESK_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-3xl border border-zinc-800 bg-zinc-900/40 px-5 py-6 sm:px-6"
          >
            <h2 className="text-xl font-bold tracking-tight text-zinc-50">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{section.body}</p>
            {section.bullets?.length ? (
              <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-400">
                {section.bullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 px-5 py-6 sm:px-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-500">Go trade</h2>
        <ul className="mt-4 space-y-3">
          {CORE_DESK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 transition hover:border-emerald-700/60 hover:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-emerald-300 group-hover:text-emerald-200">{link.label}</span>
                <span className="mt-1 text-sm text-zinc-500 sm:mt-0 sm:text-right">{link.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
