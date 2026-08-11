import type { ScannerUser } from '@/lib/scanner-auth';

/** When true, signed-in viewers receive Dream Tree charts (not TradingView). Requires a display/redistribution license (e.g. Tiingo startup $250/mo). */
export function dreamTreeChartsForMembersEnabled(): boolean {
  const raw = process.env.SCANNER_DREAM_TREE_CHARTS_FOR_MEMBERS || '';
  return raw.trim().toLowerCase() === 'true' || raw === '1';
}

export function canAccessDreamTreeChartData(user: ScannerUser | null): boolean {
  if (!user) return false;
  if (user.role === 'developer') return true;
  return user.role === 'viewer' && dreamTreeChartsForMembersEnabled();
}

export function chartDataAttribution(): string | null {
  return process.env.SCANNER_CHART_DATA_ATTRIBUTION?.trim() || null;
}
