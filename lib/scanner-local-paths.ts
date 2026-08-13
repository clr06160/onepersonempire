import path from 'path';

/** Env path first, then sibling Projects/stocks/scanners file in local dev. */
export function resolveScannerJsonCandidates(envVar: string, scannersFileName: string): string[] {
  const candidates: string[] = [];
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) candidates.push(fromEnv);
  if (process.env.NODE_ENV === 'development') {
    candidates.push(path.resolve(process.cwd(), '../Projects/stocks/scanners', scannersFileName));
  }
  return candidates;
}
