import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';

type ScannerManifest = {
  packageVersion: number;
  packageName: string;
  scanners: Array<{
    id: string;
    label: string;
    file: string;
    variantHint?: string;
  }>;
  sharedFiles?: string[];
  dashboardFiles?: string[];
};

const PACKAGE_ROOT = path.join(process.cwd(), 'scanner-download');
const BLOCKED_FILE_NAMES = new Set(['.env', '.env.local', '.env.production']);
const BLOCKED_EXTENSIONS = new Set(['.log', '.pem', '.key', '.p12', '.pfx']);

function isBlockedRelativePath(relativePath: string) {
  const base = path.basename(relativePath).toLowerCase();
  const ext = path.extname(base).toLowerCase();
  if (BLOCKED_FILE_NAMES.has(base)) return true;
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  if (base.includes('credentials') || base.includes('secret')) return true;
  return false;
}

async function readManifest() {
  const raw = await fs.readFile(path.join(PACKAGE_ROOT, 'manifest.json'), 'utf8');
  return JSON.parse(raw) as ScannerManifest;
}

async function addFileToZip(zip: JSZip, relativePath: string) {
  if (isBlockedRelativePath(relativePath)) return;
  const absolutePath = path.join(PACKAGE_ROOT, relativePath);
  const content = await fs.readFile(absolutePath);
  zip.file(relativePath.replace(/\\/g, '/'), content);
}

async function addScannerHeaders(zip: JSZip, manifest: ScannerManifest) {
  for (const scanner of manifest.scanners) {
    const zipPath = scanner.file.replace(/\\/g, '/');
    const entry = zip.file(zipPath);
    if (!entry) continue;

    const header = [
      '"""',
      `OnePersonEmpire scanner: ${scanner.label}`,
      `Dashboard id: ${scanner.id}`,
      scanner.variantHint ? `Variant hint: ${scanner.variantHint}` : '',
      '"""',
      '',
    ]
      .filter(Boolean)
      .join('\n');

    const original = await entry.async('string');
    if (!original.startsWith('"""OnePersonEmpire scanner:')) {
      zip.file(zipPath, `${header}${original}`);
    }
  }
}

export async function buildScannerDownloadZip() {
  const manifest = await readManifest();
  const zip = new JSZip();

  await addFileToZip(zip, 'README.txt');
  await addFileToZip(zip, 'requirements.txt');
  await addFileToZip(zip, 'manifest.json');

  for (const relativePath of manifest.sharedFiles || []) {
    await addFileToZip(zip, relativePath);
  }

  for (const scanner of manifest.scanners) {
    await addFileToZip(zip, scanner.file);
  }

  for (const relativePath of manifest.dashboardFiles || []) {
    await addFileToZip(zip, relativePath);
  }

  await addScannerHeaders(zip, manifest);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `${manifest.packageName}-${stamp}.zip`,
    scannerCount: manifest.scanners.length,
  };
}

export async function listScannerDownloadSummary() {
  const manifest = await readManifest();
  return {
    downloadsEnabled: true,
    packageName: manifest.packageName,
    packageVersion: manifest.packageVersion,
    scannerCount: manifest.scanners.length,
    scanners: manifest.scanners.map((scanner) => ({
      id: scanner.id,
      label: scanner.label,
      file: scanner.file,
    })),
  };
}
