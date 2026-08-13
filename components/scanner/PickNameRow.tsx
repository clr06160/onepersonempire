import TickerLink from '@/app/scanner/TickerLink';
import type { PickContext } from '@/lib/scanner-pick-context';

import PickContextChips from './PickContextChips';

type PickNameRowProps = {
  ticker: string;
  index: number;
  ewLabel?: string;
  context?: PickContext;
  priorityLabel?: string;
  highlight?: boolean;
};

export default function PickNameRow({
  ticker,
  index,
  ewLabel,
  context,
  priorityLabel,
  highlight = false,
}: PickNameRowProps) {
  const vetoed = context?.vetoed;
  const rowHighlight = highlight && !vetoed;

  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${
        vetoed
          ? 'border border-red-900/50 bg-red-950/20 text-zinc-300'
          : rowHighlight
            ? 'bg-emerald-950/50 text-emerald-200'
            : 'bg-zinc-900 text-zinc-200'
      }`}
      title={vetoed ? context?.vetoReasons.join(' · ') : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="w-7 shrink-0 text-sm tabular-nums text-zinc-500">#{index + 1}</span>
        <div className="w-[88px] shrink-0 sm:w-[104px]">
          <TickerLink ticker={ticker} ewLabel={ewLabel} />
        </div>
        <div className="min-w-0 flex-1">
          <PickContextChips context={context} inline />
        </div>
        {priorityLabel ? (
          <span className="hidden shrink-0 text-right text-xs text-zinc-500 lg:inline lg:min-w-[108px]">{priorityLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
