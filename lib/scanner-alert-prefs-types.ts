export type ScannerAlertEvents = {
  ptFlip: boolean;
  bookChange: boolean;
  cashBrake: boolean;
  /** Soft morning postcard for Fun / Watchers — no desk noise. */
  morningPostcard?: boolean;
};

export type ScannerAlertPrefs = {
  email: string;
  enabled: boolean;
  events: ScannerAlertEvents;
  /** ISO timestamp once the one-time Flight Deck intro is dismissed. */
  onboardingCompletedAt?: string;
  updatedAt?: string;
};
