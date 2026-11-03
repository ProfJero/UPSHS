import { brotliDecompressSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const compressedPath = resolve(root, 'UPSHS-source.tar.br');
const tarPath = resolve(root, 'UPSHS-source.tar');

const tar = brotliDecompressSync(await readFile(compressedPath));
await writeFile(tarPath, tar);
execFileSync('tar', ['-xf', tarPath, '-C', root], { stdio: 'inherit' });

console.log('UNIPRA website source restored.');
console.log('Next: npm install && npm run check && npm run build');
