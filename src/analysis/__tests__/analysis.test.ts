import { describe, expect, it } from 'vitest';
import { gameAccuracy, moveAccuracy, scoreToCp, winPercent } from '../winprob';
import { gamePhases, isEndgame } from '../phase';
import { parseEcoUrl, parseGame, parseTimeControl } from '../../lib/pgn';
import { buildAnalysis } from '../build';
import type { Game, PositionEval } from '../../types/app';

describe('win probability & accuracy', () => {
  it('maps cp to win%', () => {
    expect(winPercent(0)).toBeCloseTo(50);
    expect(winPercent(10000)).toBeCloseTo(100, 3);
    expect(winPercent(-300)).toBeLessThan(30);
    expect(winPercent(100) + winPercent(-100)).toBeCloseTo(100);
  });
  it('clamps mate scores', () => {
    expect(scoreToCp({ mate: 3 })).toBe(10000);
    expect(scoreToCp({ mate: -1 })).toBe(-10000);
    expect(scoreToCp({ mate: 0 })).toBe(-10000);
    expect(scoreToCp({ cp: 20000 })).toBe(10000);
  });
  it('move accuracy formula', () => {
    expect(moveAccuracy(0)).toBeCloseTo(99.9999, 3);
    expect(moveAccuracy(100)).toBe(0);
    expect(moveAccuracy(10)).toBeCloseTo(103.1668 * Math.exp(-0.4354) - 3.1669);
  });
  it('game accuracy = mean of arithmetic & harmonic', () => {
    expect(gameAccuracy([100, 100])).toBeCloseTo(100);
    const a = [90, 60];
    expect(gameAccuracy(a)).toBeCloseTo((75 + 2 / (1 / 90 + 1 / 60)) / 2);
  });
});

describe('pgn helpers', () => {
  it('parses eco urls', () => {
    expect(parseEcoUrl('https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3-e5-7.Nb3')).toEqual({
      name: 'Sicilian Defense Najdorf Variation',
      plies: 13,
    });
    expect(parseEcoUrl('https://www.chess.com/openings/Scandinavian-Defense-3...Qa5').plies).toBe(6);
    expect(parseEcoUrl(undefined).name).toBe('Unknown opening');
  });
  it('parses time controls', () => {
    expect(parseTimeControl('180+2')).toEqual({ base: 180, inc: 2, daily: false });
    expect(parseTimeControl('1/86400').daily).toBe(true);
  });
});

describe('phases', () => {
  it('detects endgame by non-pawn material', () => {
    expect(isEndgame('8/5k2/8/8/8/8/3R1K2/8 w - - 0 50')).toBe(true);
    expect(isEndgame('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
  });
  it('opening ends after move 12', () => {
    const ph = gamePhases([
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 13',
    ]);
    expect(ph).toEqual(['opening', 'middlegame']);
  });
});

const PGN = `[White "me"]
[Black "opp"]
[TimeControl "60"]
[ECOUrl "https://www.chess.com/openings/Kings-Pawn-Opening"]

1. f3 {[%clk 0:00:59]} 1... e5 {[%clk 0:00:59]} 2. g4 {[%clk 0:00:58]} 2... Qh4# {[%clk 0:00:57]} 0-1`;

describe('buildAnalysis', () => {
  it('classifies a fool’s mate', () => {
    const game = { id: 'g', pgn: PGN, timeControl: '60', myColor: 'white', endTime: 0 } as unknown as Game;
    const pg = parseGame(PGN);
    expect(pg.clocks).toEqual([59, 59, 58, 57]);
    const positions: PositionEval[] = [
      { fen: pg.fens[0], score: { cp: 30 }, best: 'e2e4', pv: ['e2e4'], depth: 10 },
      { fen: pg.fens[1], score: { cp: -20 }, best: 'e7e5', pv: ['e7e5'], depth: 10 },
      { fen: pg.fens[2], score: { cp: -90 }, best: 'e2e4', pv: ['e2e4'], depth: 10 },
      { fen: pg.fens[3], score: { mate: 1 }, best: 'd8h4', pv: ['d8h4'], depth: 10 },
      { fen: pg.fens[4], score: { mate: 0 }, pv: [], depth: 0 },
    ];
    const a = buildAnalysis(game, positions, 10, pg);
    expect(a.moves.map((m) => m.classification)).toEqual(['book', 'book', 'blunder', 'best']);
    expect(a.moves[2].tags).toContain('opening-prep');
    expect(a.moves[2].timeSpent).toBe(1);
    expect(a.accuracy.black).toBeGreaterThan(a.accuracy.white);
  });
});
