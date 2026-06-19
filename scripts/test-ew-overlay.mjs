import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';

config({ path: '.env.local' });

const path = process.env.SCANNER_EW_JSON_PATH;
if (!path) {
  console.error('SCANNER_EW_JSON_PATH not set');
  process.exit(1);
}

const raw = await readFile(path, 'utf8');
const overlay = JSON.parse(raw);
const systems = Object.keys(overlay.labelsBySystem || {});
const count = systems.reduce((sum, id) => sum + Object.keys(overlay.labelsBySystem[id] || {}).length, 0);
console.log(`EW overlay OK: ${count} labels across ${systems.length} systems`);
console.log('Sample core:', overlay.labelsBySystem?.core);
