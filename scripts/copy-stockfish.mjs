// Copies the single-threaded "lite" Stockfish build into public/stockfish so it is
// served as a static file (the worker locates its .wasm next to its own URL).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish', 'bin');
const out = join(root, 'public', 'stockfish');
mkdirSync(out, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(join(src, f), join(out, f));
}
console.log('Stockfish lite-single copied to public/stockfish');
