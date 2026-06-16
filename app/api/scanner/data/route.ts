import { readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';

export const runtime = 'nodejs';

async function loadScannerData() {
  const jsonPath = process.env.SCANNER_RESULTS_JSON_PATH;
  const htmlPath = process.env.SCANNER_RESULTS_HTML_PATH;
  if (!jsonPath && !htmlPath) {
    return {
      connected: false,
      message: 'Scanner login is working. Set SCANNER_RESULTS_JSON_PATH or SCANNER_RESULTS_HTML_PATH next.',
      systems: [],
    };
  }

  if (jsonPath) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? { connected: true, systems: parsed } : parsed;
    } catch (error) {
      if (!htmlPath) throw error;
    }
  }

  const html = await readFile(htmlPath as string, 'utf8');
  const match = html.match(/const systems = (\[[\s\S]*?\]);\s*const select =/);
  if (!match) {
    throw new Error('Could not find scanner systems in dashboard HTML.');
  }
  return {
    connected: true,
    source: 'html-fallback',
    systems: JSON.parse(match[1]),
  };
}

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadScannerData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load scanner data.';
    return NextResponse.json({ user, data: { connected: false, message, systems: [] } });
  }
}
