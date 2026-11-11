import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const partsDir = resolve(root, 'source-parts');
const partFiles = (await readdir(partsDir))
  .filter((name) => /^part-\\d+\\.b64$/.test(name))
  .sort();

if (partFiles.length !== 7) {
  throw new Error(`Expected 7 source parts, found ${partFiles.length}. Check the repository download.`);
}

const encoded = (await Promise.all(
  partFiles.map((name) => readFile(resolve(partsDir, name), 'utf8')),
)).join('').replace(/\\s+/g, '');

const compressed = Buffer.from(encoded, 'base64');
const checksum = createHash('sha256').update(compressed).digest('hex');
const expectedChecksum = '91762483488c76adb068ea5122785c1ab19734ec31aabef3c93248d39c517c6a';

if (checksum !== expectedChecksum) {
  throw new Error('Source archive checksum mismatch. Do not extract this bundle.');
}

const tar = brotliDecompressSync(compressed);
const tarPath = resolve(root, 'UPSHS-source.tar');

await writeFile(tarPath, tar);
execFileSync('tar', ['-xf', tarPath, '-C', root], { stdio: 'inherit' });

console.log('UNIPRA website source restored and checksum verified.');
console.log('Next: npm install && npm run check && npm run build');
