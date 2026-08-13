/**
 * Mistakes — personal trading rules.
 *
 * Written from real mistakes, not theory. Each rule exists because it already cost money.
 * `hard` rules are kill switches: no judgment call, no "unless", no exceptions.
 * Append new rules to the relevant group; keep `why` specific to what actually happened.
 */

export type MistakeSeverity = 'hard' | 'standard';

export type MistakeRule = {
  id: string;
  rule: string;
  why: string;
  /** The sentence you catch yourself thinking right before you break it. */
  tell?: string;
  severity: MistakeSeverity;
  addedOn: string;
};

export type MistakeGroup = {
  id: string;
  label: string;
  note: string;
  rules: MistakeRule[];
};

export const MISTAKE_GROUPS: MistakeGroup[] = [
  {
    id: 'hard-stops',
    label: 'Hard stops',
    note: 'Not guidelines. If a rule here has an "unless", it is not a rule.',
    rules: [
      {
        id: 'daily-kill-switch',
        rule: 'If daily P&L hits −X, flatten everything and stop trading for the day.',
        why:
          'Broke this on Jul 28. Was up well on the day, kept trading, gave it all back. Being below the line is exactly when judgment is worst — that is what the line is for.',
        tell: 'I am close to even, one more trade gets me back.',
        severity: 'hard',
        addedOn: '2026-07-29',
      },
      {
        id: 'no-downtrend-buys',
        rule: 'No buying stocks in a downtrend — including when a paid service says to.',
        why:
          'Already a no-go in my own book, then bought bounces anyway because a service called them. Most did not work. The service clause is the part that was missing.',
        tell: 'They are smarter than me, so this one does not count.',
        severity: 'hard',
        addedOn: '2026-07-29',
      },
      {
        id: 'no-new-game-in-drawdown',
        rule: 'Do not start a new instrument or style while in a drawdown.',
        why:
          'Wanting to learn shorting or vol products right after missing a big down move is revenge dressed up as ambition. Learn it flat and calm, on paper, or not at all.',
        tell: 'My friend is up a lot doing this, I should be doing it too.',
        severity: 'hard',
        addedOn: '2026-07-29',
      },
      {
        id: 'account-threshold-small',
        rule: 'Below account threshold X → super-small size only. Scanner FULL does not unlock big size.',
        why:
          'The scanner optimizes market regime, not my ruin risk. When the account is below the line, pressing hard is how −4% becomes a hole. Threshold can only cut further than the overlay — never add.',
        tell: 'Scanner says full, so the threshold does not apply today.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
      {
        id: 'no-all-in-below-mas',
        rule: 'No all-in while short MAs are down / structure is not lined up.',
        why:
          'Two green days under the averages feel like confirmation and become all-in, then one bad day and a bail. That is the loop. Higher low + first pullback first; all-in is banned until structure is clean.',
        tell: 'It bounced hard, this is the bottom, go big.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
    ],
  },
  {
    id: 'untrained-aggression',
    label: 'Untrained aggression',
    note:
      'I am aggressive at heart. That is a weapon when PowerTrend is on and the tape pays. It is a liability when I press the same hard in weak regimes. Name it: untrained aggression.',
    rules: [
      {
        id: 'name-untrained-aggression',
        rule: 'When the hand goes for size, ask: trained or untrained aggression?',
        why:
          'Vague "be disciplined" is easy to argue with. Untrained aggression is specific: too much force, too early, no cushion. Naming it makes the next action obvious — shrink, wait, or pass.',
        tell: 'I am tough, I do not get affected by emotion.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
      {
        id: 'dial-down-weak-regimes',
        rule: 'Press hard only when the regime earns it. Dial down in chop / below MAs / PowerTrend off.',
        why:
          'Aggression works when PowerTrend is on and names trend clean. I press the same way all the time instead of being flexible. Weak regimes need half size and patience, not marathon pace on day one.',
        tell: 'I always size big — that is my edge.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
      {
        id: 'size-is-honesty',
        rule: 'Size to what I can hold, not what I wish I could hold. Oversizing is a lie.',
        why:
          'Saying I can handle SOXL/AAOI volatility at big size is fake toughness. Normal shakeouts force the exit; then I watch the winner without me. Size is honesty about the nervous system, not ambition.',
        tell: 'One percent is too tiny for a big winner.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
      {
        id: 'cushion-before-add',
        rule: 'Start small. Add only after a cushion. Never begin at marathon pace.',
        why:
          'Wanting to run a marathon before I can jog the block. Start 1% (or holdable size), add only if it works and structure holds. Aggression is earned after a cushion — not day-one all-in.',
        tell: 'I know this name, start big and manage it.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
      {
        id: 'no-size-up-after-green',
        rule: 'After a big green day, tomorrow size stays the same or goes down — never up.',
        why:
          'Yesterday\'s win is not permission. "I know best, I made a ton" is confidence from a result, not from a setup. That is when I go all-in under the MAs and get clobbered.',
        tell: 'I crushed it yesterday, press it today.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
      {
        id: 'scanner-full-not-emotional-all-in',
        rule: 'Scanner FULL is a ceiling, not an order to go emotional all-in with a one-day fuse.',
        why:
          'Bought the dip one day early, scanner said full, went all-in, one bad day, bailed — got the pain and missed the repair. The book assumes a holder. Translate FULL through threshold + holdable size.',
        tell: 'Scanner said 100%, so all-in is correct.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
      {
        id: 'rules-match-nervous-system',
        rule: 'Rules must match my nervous system, not my ambition.',
        why:
          'If a size would make me panic, the size is the mistake — not the stock. Pretending I am unaffected is pride. Ask why I am doing this; if the why is catch-up, FOMO, or friends\' P&L, cut or pass.',
        tell: 'I should be able to handle this by now.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
    ],
  },
  {
    id: 'sizing',
    label: 'Sizing',
    note: 'Almost every "I could not sit through it" problem is a sizing problem in disguise.',
    rules: [
      {
        id: 'size-from-stop',
        rule: 'Size = max acceptable loss ÷ distance to stop. Never start from how much I want to own.',
        why:
          'If a normal pullback makes me want to sell, the position was too big before the trade started. The stop sets the size, not the excitement.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'breakeven-stop',
        rule: 'Once a bounce trade moves up, pull the stop to breakeven. If it never moves, scrap it.',
        why:
          'This is the part I already do right. It turns a stretched-name bounce into a free option instead of a hope trade.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'no-overlay-override',
        rule: 'Do not override the pain overlay — in either direction.',
        why:
          'It called high pain risk and went CASH before the core book ran −11% in 20 days. It was right. Going bigger than it says is greed; cutting deeper than it says after a hole is the same override pointing the other way, and it leaves me underweight into the bounce.',
        tell: 'I wish I had cut more than it said, so this time I will.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'half-default-in-messy-tape',
        rule: 'Default to half size in messy tape. Size up slowly, never suddenly.',
        why:
          'Half keeps me in the game without giving a bounce enough rope to hang me. The failure mode is feeling good after 1–2 days and jumping to full/all-in.',
        tell: 'Half is leaving too much on the table.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
    ],
  },
  {
    id: 'outside-advice',
    label: 'Outside advice',
    note: 'Borrow their research. Never borrow half their strategy.',
    rules: [
      {
        id: 'alerts-are-watchlist',
        rule: 'Paid-service alerts are watchlist candidates only. Entry waits for my own confirmation.',
        why:
          'What I actually want is to know what they are buying and ride the trend — not buy and sit through drawdowns. That means their alert starts the clock, my setup starts the position.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'no-partial-copy',
        rule: 'Never take someone else\u2019s entry without their holding period. Follow fully or not at all.',
        why:
          'Buying because they said so and selling because I could not take the heat captures their bad timing, none of their recovery, plus my own exit friction. That is strictly worse than either playbook alone.',
        tell: 'I will get in like they did and just manage it my own way.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'they-dont-know-my-book',
        rule: 'Remember what a service cannot see: my size, my drawdown, my overlay.',
        why:
          'On Jul 28 my own model was flashing high pain risk while I took direction from something that had no idea what I was holding.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
    ],
  },
  {
    id: 'confirmation',
    label: 'Confirmation',
    note: 'A level tells you where to watch. Only price action tells you it turned.',
    rules: [
      {
        id: 'higher-low-required',
        rule: 'No bottom is confirmed without a higher low.',
        why:
          'Fib zones, moving averages, and oversold readings mark where to pay attention. MRVL, MAGS, QQQ, SOXL all sat on "support" while still making lower lows. Stochastics at 7 means a bounce is likely, not that the low is in.',
        tell: 'It is down enough, it has to bounce here.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'first-pullback-reentry',
        rule: 'Reentry after a washout = bounce, then first pullback that holds, then turn back up.',
        why:
          'Do not buy the rocket day. Wait for up → pullback that finds support → enter. One day can print a higher low; reentry is confirmation after that. Invalidation is below the higher low / pullback low.',
        tell: 'It is already going, chase it or miss it.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
      {
        id: 'model-levels-are-models',
        rule: 'Treat wave counts and fib targets as scenarios, not forecasts.',
        why:
          'The same QQQ chart supports wave 4 into new highs and a completed wave 5 into a deeper ABC. Most outside analysts lean bullish; my local engine leans bearish. Neither is confirmed, so size for both.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
    ],
  },
  {
    id: 'mindset',
    label: 'Mindset and tells',
    note: 'Rules are not a frame of reference. They exist to override me.',
    rules: [
      {
        id: 'catch-the-sentence',
        rule: 'When I catch myself reasoning about whether a rule applies, that reasoning IS the signal it is binding.',
        why:
          '"I know what I am doing so I can bend it here" and "I should stop" show up at the same moment. The first one always sounds better informed.',
        tell: 'I know what I am doing, so I can bend the rules a bit.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'process-not-pnl',
        rule: 'Care about following the process. Do not need this trade — or this day — to make money.',
        why:
          'Emotional indifference to a single outcome is what stops the forcing, the size-up, the moved stops, and the trading past cutoff. Indifference to risk is recklessness; indifference to one result is discipline.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'early-drawdown-is-not-failure',
        rule: 'Hitting a big drawdown early does not mean the system broke. Abandon it only if the process broke.',
        why:
          'Max drawdown is a property of the strategy, not a prediction of when it arrives. Starting near a peak is the worst sample, not proof of no edge. Core running −11% out of the gate is path, not verdict.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'external-not-mental',
        rule: 'Make rules external. Do not rely on remembering them better.',
        why:
          'Minds rationalize; platform lockouts, written numbers, and pre-committed consequences do not. Decide the number and the action the night before, while calm.',
        severity: 'standard',
        addedOn: '2026-07-29',
      },
      {
        id: 'no-revenge-from-comparison',
        rule: 'If the motive is catch up to friends, calendar, or a missed winner — no new risk.',
        why:
          'Friends up 50% while I am −4% YTD lights impatience and revenge size. Comparison → untrained aggression. −4% is a scar; revenge is how it becomes a wound. Ask why am I doing this — honestly.',
        tell: 'Year is almost Q4, I need gains soon or it is a down year.',
        severity: 'hard',
        addedOn: '2026-07-30',
      },
      {
        id: 'disappointment-does-not-veto-setup',
        rule: 'A dull prior trade does not cancel the next valid setup. Cut size if tired — do not ghost the process.',
        why:
          'Knew the stretch/bounce was coming, prior day trade yielded little, gave up feeling too risky, then watched it blow without me. Demoralization makes me skip A-setups. Tired means half frequency/size, not abandoned rules.',
        tell: 'I have no steam left, skip it.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
      {
        id: 'environment-not-identity',
        rule: 'Hard tape exposes gaps. It does not prove I am a fraud. Fix process, do not revenge my identity back.',
        why:
          'Big years were good environment amplifying me. This year exposed sizing/holding. Selection still works — a friend holds my picks and makes money. Incomplete is not dumb. Forcing a big year to prove otherwise is ego.',
        tell: 'I used to be good, I must force it now.',
        severity: 'standard',
        addedOn: '2026-07-30',
      },
    ],
  },
];

export function mistakeRuleCount(): number {
  return MISTAKE_GROUPS.reduce((total, group) => total + group.rules.length, 0);
}

export function hardRuleCount(): number {
  return MISTAKE_GROUPS.reduce(
    (total, group) => total + group.rules.filter((rule) => rule.severity === 'hard').length,
    0,
  );
}
