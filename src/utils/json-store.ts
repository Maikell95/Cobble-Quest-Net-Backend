import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', 'data');

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function readJSON<T>(filename: string): Promise<T[]> {
  const filePath = join(DATA_DIR, filename);
  await ensureDir(dirname(filePath));

  if (!existsSync(filePath)) {
    await writeFile(filePath, '[]', 'utf-8');
    return [];
  }

  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T[];
}

export async function writeJSON<T>(filename: string, data: T[]): Promise<void> {
  const filePath = join(DATA_DIR, filename);
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
