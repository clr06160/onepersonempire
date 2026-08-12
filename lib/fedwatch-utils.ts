export type FedWatchBucket = {
  range: string;
  probability: number;
};

export type FedWatchMeeting = {
  meetingDate: string;
  contract?: string;
  probabilities?: {
    cut25?: number;
    hold?: number;
    hike25?: number;
    [key: string]: number | undefined;
  };
  dominant?: string;
  buckets?: FedWatchBucket[];
  preMeetingRate?: number;
  postMeetingRate?: number;
  impliedMonthRate?: number;
  source?: string;
};

export type FedWatchPolicy = {
  targetLower?: number;
  targetUpper?: number;
  targetLabel?: string;
  effectiveRate?: number;
  effectiveAsOf?: string;
  iorbRate?: number;
  iorbAsOf?: string;
  sofrRate?: number;
  sofrAsOf?: string;
  fredConnected?: boolean;
};

export type FedWatchPayload = {
  connected?: boolean;
  generatedAt?: string;
  source?: string;
  note?: string;
  policy?: FedWatchPolicy;
  meetings?: FedWatchMeeting[];
  sepProjections?: unknown;
  officialToolUrl?: string;
  attribution?: string;
  message?: string;
};

export type RateLean = {
  direction: 'hike' | 'cut' | 'hold';
  label: string;
  prob: number;
  tone: 'hike' | 'cut' | 'hold';
};

/** The earliest meeting on or after `asOf` (defaults to today, local date). */
export function nextUpcomingMeeting(
  payload: FedWatchPayload | null | undefined,
  asOf?: string,
): FedWatchMeeting | null {
  const meetings = payload?.meetings || [];
  if (!meetings.length) return null;
  const today = asOf || new Date().toISOString().slice(0, 10);
  const upcoming = meetings
    .filter((meeting) => meeting.meetingDate && meeting.meetingDate >= today)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  return upcoming[0] || null;
}

/**
 * The directional lean for a meeting: whichever of hike/cut carries more probability
 * (ties or all-hold fall back to "hold"). `prob` is that outcome's probability in %.
 */
export function rateLean(meeting: FedWatchMeeting | null | undefined): RateLean | null {
  if (!meeting) return null;
  const hike = Number(meeting.probabilities?.hike25 ?? 0);
  const cut = Number(meeting.probabilities?.cut25 ?? 0);
  const hold = Number(meeting.probabilities?.hold ?? 0);

  if (hike <= 0 && cut <= 0) {
    return { direction: 'hold', label: 'Rate hold', prob: hold, tone: 'hold' };
  }
  if (hike >= cut) {
    return { direction: 'hike', label: 'Rate hike', prob: hike, tone: 'hike' };
  }
  return { direction: 'cut', label: 'Rate cut', prob: cut, tone: 'cut' };
}

export function formatMeetingDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
