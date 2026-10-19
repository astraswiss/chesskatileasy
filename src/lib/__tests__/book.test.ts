import { describe, expect, it, vi } from 'vitest';
vi.mock('../db', () => ({ getBookEntry: vi.fn(), putBookEntry: vi.fn(), getDrillCards: vi.fn(), putDrillCard: vi.fn() }));
import { fenAfter, fenKey, mainMove, newCard, opponentReplies, reviewCard } from '../book';
import type { BookEntry } from '../../types/app';

const entry: BookEntry = {
  key: 'k',
  depth: 18,
  moves: [
    { uci: 'g1f3', san: 'Nf3', win: 55 },
    { uci: 'c2c4', san: 'c4', win: 53.5 },
    { uci: 'b1c3', san: 'Nc3', win: 50 },
    { uci: 'h2h4', san: 'h4', win: 30 },
  ],
};

describe('opening book', () => {
  it('keeps your repertoire move when it is practically as good', () => {
    expect(mainMove(entry, 'c4')).toBe('c4');
    expect(mainMove(entry, 'Nc3')).toBe('Nf3'); // 5 points worse → learn the engine move
    expect(mainMove(entry)).toBe('Nf3');
  });
  it('mixes real opponent moves with sensible engine replies', () => {
    const r = new Map(opponentReplies(entry, new Map([['e6', 3]])));
    expect(r.get('e6')).toBe(6);
    expect(r.has('Nf3')).toBe(true);
    expect(r.has('h4')).toBe(false); // too bad to practise against
  });
  it('fen helpers', () => {
    expect(fenKey(fenAfter(['d4', 'd5', 'c4']))).toBe('rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -');
  });
  it('spaced repetition 1 → 3 → 7 → 21 → 60 days, reset on error', () => {
    const DAY = 86_400_000;
    let c = newCard('qg', ['d4', 'd5'], 'c4', 0);
    expect(c.due).toBe(DAY);
    c = reviewCard(c, true, DAY);
    expect(c.due).toBe(DAY + 3 * DAY);
    c = reviewCard(c, true, 0);
    c = reviewCard(c, true, 0);
    c = reviewCard(c, true, 0);
    expect(c.due).toBe(60 * DAY);
    c = reviewCard(c, false, 0);
    expect(c.due).toBe(DAY);
    expect(c.wrong).toBe(1);
  });
});
