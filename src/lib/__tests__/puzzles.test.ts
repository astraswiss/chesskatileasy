import { describe, expect, it, vi } from 'vitest';
vi.mock('../db', () => ({ putPuzzle: vi.fn(), addPuzzles: vi.fn(), getAllAnalyses: vi.fn(), getAllGames: vi.fn(), getMeta: vi.fn(), setMeta: vi.fn() }));
import { isDue, recordAttempt } from '../puzzles';
import type { Puzzle } from '../../types/app';

const DAY = 86_400_000;
const base = { status: 'new', stage: 0, due: 0, attempts: 0, solvedCount: 0, failedCount: 0 } as Puzzle;

describe('spaced repetition', () => {
  it('fail → 1d, then 3d, then 7d, then retired', async () => {
    let p = await recordAttempt(base, false, 0);
    expect(p.due).toBe(DAY);
    expect(isDue(p, DAY - 1)).toBe(false);
    expect(isDue(p, DAY)).toBe(true);
    p = await recordAttempt(p, true, DAY);
    expect(p.due).toBe(4 * DAY);
    p = await recordAttempt(p, true, 4 * DAY);
    expect(p.due).toBe(11 * DAY);
    p = await recordAttempt(p, true, 11 * DAY);
    expect(p.status).toBe('solved');
  });
  it('failing again resets to 1 day', async () => {
    let p = await recordAttempt(base, false, 0);
    p = await recordAttempt(p, true, DAY);
    p = await recordAttempt(p, false, 2 * DAY);
    expect(p.due).toBe(3 * DAY);
    expect(p.stage).toBe(0);
  });
  it('solved first time is done', async () => {
    const p = await recordAttempt(base, true, 0);
    expect(p.status).toBe('solved');
    expect(isDue(p)).toBe(false);
  });
});
