import { describe, expect, it } from 'vitest';
import { buildProgress } from '../progress';
import type { Pair } from '../coach';
import type { MoveAnalysis } from '../../types/app';

function pair(i: number, accuracy: number, blunders: number, hangLoss: number): Pair {
  const moves: MoveAnalysis[] = [];
  for (let k = 0; k < 20; k++) {
    const bad = k < blunders;
    moves.push({
      ply: k * 2, san: 'e4', uci: 'e2e4', color: 'white', fenBefore: '', classification: bad ? 'blunder' : 'good',
      winBefore: 50, winAfter: bad ? 50 - hangLoss : 49, loss: bad ? hangLoss / 100 : 0.01, accuracy, phase: 'middlegame',
      piece: 'p', capture: false, check: false, oppPrevMistake: false, tags: bad ? ['hanging-piece'] : [],
    });
  }
  return {
    game: { id: `g${i}`, myColor: 'white', myResult: 'loss', opening: 'X', timeControl: '180+2', endTime: 1e12 - i } as Pair['game'],
    analysis: { moves, myColor: 'white', accuracy: { white: accuracy, black: 80 }, counts: { white: { blunder: blunders }, black: {} } } as unknown as Pair['analysis'],
  };
}

describe('buildProgress', () => {
  it('needs enough games', () => {
    expect(buildProgress([pair(0, 80, 1, 25)], 30)).toBeNull();
  });
  it('detects improvement in recent games (newest first)', () => {
    const recent = Array.from({ length: 10 }, (_, i) => pair(i, 88, 0, 0));
    const older = Array.from({ length: 10 }, (_, i) => pair(10 + i, 80, 2, 25));
    const p = buildProgress([...recent, ...older], 30)!;
    expect(p.recent).toBe(10);
    const keys = p.items.map((x) => x.key);
    expect(keys).toContain('accuracy');
    expect(keys).toContain('blunders');
    expect(keys).toContain('tag:hanging-piece');
    expect(p.items.every((x) => x.good)).toBe(true);
  });
  it('reports declines too', () => {
    const recent = Array.from({ length: 10 }, (_, i) => pair(i, 78, 2, 25));
    const older = Array.from({ length: 10 }, (_, i) => pair(10 + i, 86, 0, 0));
    const p = buildProgress([...recent, ...older], 30)!;
    expect(p.items.find((x) => x.key === 'accuracy')?.good).toBe(false);
  });
});
