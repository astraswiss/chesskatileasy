import type { Game } from '../types/app';
import type { TimeClass } from '../types/chesscom';
import type { Pair } from './coach';

export interface WDL {
  w: number;
  d: number;
  l: number;
  n: number;
}

function wdl(games: Game[]): WDL {
  const r = { w: 0, d: 0, l: 0, n: games.length };
  for (const g of games) {
    if (g.myResult === 'win') r.w++;
    else if (g.myResult === 'draw') r.d++;
    else r.l++;
  }
  return r;
}

export const TIME_CLASSES: TimeClass[] = ['bullet', 'blitz', 'rapid', 'daily'];

export function buildStats(games: Game[], pairs: Pair[]) {
  const byColor = { white: wdl(games.filter((g) => g.myColor === 'white')), black: wdl(games.filter((g) => g.myColor === 'black')) };
  const byTimeClass = TIME_CLASSES.map((tc) => ({ tc, ...wdl(games.filter((g) => g.timeClass === tc)) })).filter((r) => r.n > 0);

  // Rating history: one series per time class (rated games only, oldest → newest).
  const chrono = [...games].sort((a, b) => a.endTime - b.endTime);
  const rating: Record<string, { t: number; rating: number }[]> = {};
  for (const g of chrono) if (g.rated) (rating[g.timeClass] ??= []).push({ t: g.endTime, rating: g.myRating });

  const openingMap = new Map<string, Game[]>();
  for (const g of games) openingMap.set(g.opening, [...(openingMap.get(g.opening) ?? []), g]);
  const openings = [...openingMap.entries()]
    .map(([name, gs]) => ({ name, ...wdl(gs), white: gs.filter((g) => g.myColor === 'white').length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  // Average accuracy per month.
  const months = new Map<string, number[]>();
  for (const { game, analysis } of pairs) {
    const d = new Date(game.endTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, [...(months.get(key) ?? []), analysis.accuracy[game.myColor]]);
  }
  const accuracyByMonth = [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, accs]) => ({ month, accuracy: accs.reduce((a, b) => a + b, 0) / accs.length, games: accs.length }));

  return { total: wdl(games), byColor, byTimeClass, rating, openings, accuracyByMonth };
}
