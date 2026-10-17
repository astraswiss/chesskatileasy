import { Chess, type Move } from 'chess.js';

export function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const re = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn))) headers[m[1]] = m[2];
  return headers;
}

/** Splits an ECO url slug into a readable opening name and the moves it encodes. */
export function parseEcoUrl(url?: string): { name: string; plies?: number } {
  if (!url) return { name: 'Unknown opening' };
  const slug = decodeURIComponent(url.split('/').pop() ?? '');
  const tokens = slug.split('-').filter(Boolean);
  const nameParts: string[] = [];
  let i = 0;
  for (; i < tokens.length; i++) {
    if (/^\d+\.{1,3}/.test(tokens[i])) break;
    nameParts.push(tokens[i]);
  }
  let plies: number | undefined;
  for (let j = i; j < tokens.length; j++) {
    const mm = /^(\d+)(\.{1,3})/.exec(tokens[j]);
    if (mm) {
      const n = Number(mm[1]);
      plies = (n - 1) * 2 + (mm[2] === '...' ? 2 : 1);
    } else if (plies !== undefined) {
      plies += 1;
    }
  }
  const name = nameParts.join(' ').replace(/\s+/g, ' ').trim() || 'Unknown opening';
  return { name, plies };
}

export interface TimeControl {
  base?: number; // seconds
  inc: number;
  daily: boolean;
}

export function parseTimeControl(tc: string): TimeControl {
  if (tc.includes('/')) return { daily: true, inc: 0 };
  const [b, i] = tc.split('+');
  return { base: Number(b) || undefined, inc: Number(i) || 0, daily: false };
}

export function formatTimeControl(tc: string): string {
  const p = parseTimeControl(tc);
  if (p.daily) {
    const days = Number(tc.split('/')[1]) / 86400;
    return `${days || 1}d`;
  }
  const base = p.base ?? 0;
  const mins = base >= 60 ? `${base / 60}` : `${base}s`;
  return p.inc ? `${mins}+${p.inc}` : `${mins} min`;
}

function clkToSeconds(s: string): number {
  const parts = s.split(':').map(Number);
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}

export interface ParsedGame {
  headers: Record<string, string>;
  startFen: string;
  moves: Move[];
  /** fens[i] = position before move i; fens[moves.length] = final position. */
  fens: string[];
  /** Clock (seconds) after each move, if present. */
  clocks: (number | undefined)[];
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function parseGame(pgn: string): ParsedGame {
  const headers = parseHeaders(pgn);
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });
  const startFen = headers.SetUp === '1' && headers.FEN ? headers.FEN : START_FEN;
  const fens = moves.length ? [...moves.map((m) => m.before), moves[moves.length - 1].after] : [startFen];

  const body = pgn.replace(/^\[.*\]\s*$/gm, '');
  const clocks: (number | undefined)[] = [];
  const clkRe = /\[%clk\s+([\d:.]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = clkRe.exec(body))) clocks.push(clkToSeconds(m[1]));
  if (clocks.length !== moves.length) clocks.length = 0;

  return { headers, startFen, moves, fens, clocks: moves.map((_, i) => clocks[i]) };
}
