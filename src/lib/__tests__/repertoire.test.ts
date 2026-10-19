import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { lineOf, repertoireOf, REPERTOIRE } from '../repertoire';
import type { Game } from '../../types/app';

let n = 0;
function game(moves: string, myColor: 'white' | 'black'): Game {
  const c = new Chess();
  for (const m of moves.split(' ')) c.move(m);
  return { id: `t${n++}`, pgn: c.pgn(), myColor } as Game;
}
const qg = REPERTOIRE.find((r) => r.id === 'queens-gambit')!;
const ck = REPERTOIRE.find((r) => r.id === 'caro-kann')!;

describe('repertoire matching', () => {
  it('matches color and first moves', () => {
    expect(repertoireOf(game('d4 d5 c4 e6', 'white'))?.id).toBe('queens-gambit');
    expect(repertoireOf(game('e4 c6 d4 d5', 'black'))?.id).toBe('caro-kann');
    expect(repertoireOf(game('d4 d5 c4 e6', 'black'))).toBeUndefined();
    expect(repertoireOf(game('e4 e5', 'white'))).toBeUndefined();
  });
  it("names Queen's Gambit lines", () => {
    expect(lineOf(qg, game('d4 d5 c4 dxc4 e3', 'white'))).toBe("Queen's Gambit Accepted");
    expect(lineOf(qg, game('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7', 'white'))).toBe('QGD Orthodox (4.Bg5)');
    expect(lineOf(qg, game('d4 d5 c4 c6 Nf3 Nf6 Nc3 e6', 'white'))).toBe('Semi-Slav');
    expect(lineOf(qg, game('d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4', 'white'))).toBe('Slav Defense');
    expect(lineOf(qg, game('d4 Nf6 c4 g6', 'white'))).toBe('Indian defenses (1...Nf6)');
    expect(lineOf(qg, game('d4 d5 Nf3', 'white'))).toBe('1.d4 d5 without 2.c4');
  });
  it('names Caro-Kann lines', () => {
    expect(lineOf(ck, game('e4 c6 d4 d5 e5 Bf5', 'black'))).toBe('Advance Variation');
    expect(lineOf(ck, game('e4 c6 d4 d5 exd5 cxd5 c4 Nf6', 'black'))).toBe('Panov Attack');
    expect(lineOf(ck, game('e4 c6 d4 d5 exd5 cxd5 Bd3', 'black'))).toBe('Exchange Variation');
    expect(lineOf(ck, game('e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3', 'black'))).toBe('Classical (4...Bf5)');
    expect(lineOf(ck, game('e4 c6 Nc3 d5 Nf3 Bg4', 'black'))).toBe('Two Knights');
    expect(repertoireOf(game('e4 e5 Nf3', 'black'))).toBeUndefined();
    expect(lineOf(ck, game('e4 c6 b3', 'black'))).toBe('Caro-Kann (other)');
  });
});

describe('trainer variations', async () => {
  const { variationsOf } = await import('../variations');
  it('hides generic buckets that would duplicate real variations', () => {
    const names = variationsOf(qg).map((v) => v.name);
    expect(names).not.toContain("Queen's Gambit");
    expect(names).not.toContain('1.d4 d5 without 2.c4');
    expect(names).toContain("Queen's Gambit Accepted");
    expect(variationsOf(ck).map((v) => v.name)).toContain('Main line (3.Nc3)');
  });
});

describe('variation main lines are distinct', async () => {
  const { variationsOf, mainLineMove } = await import('../variations');
  const entry = (sans: string[]) => ({ key: 'k', depth: 18, moves: sans.map((san, i) => ({ uci: '', san, win: 50 - i })) });
  it('QGD main line avoids the Tarrasch and Semi-Slav', () => {
    const qgd = variationsOf(qg).find((v) => v.name === "Queen's Gambit Declined")!;
    const path = ['d4', 'd5', 'c4', 'e6', 'Nc3'];
    expect(mainLineMove(qg, qgd, [], path, entry(['c5', 'c6', 'Nf6']))).toBe('Nf6');
    const tarrasch = variationsOf(qg).find((v) => v.name === 'Tarrasch Defense')!;
    expect(mainLineMove(qg, tarrasch, [], [...path, 'c5', 'cxd5'], entry(['exd5']))).toBe('exd5');
  });
  it('Caro-Kann Exchange avoids the Panov', () => {
    const ex = variationsOf(ck).find((v) => v.name === 'Exchange Variation')!;
    expect(mainLineMove(ck, ex, [], ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5'], entry(['c4', 'Bd3']))).toBe('Bd3');
  });
  it('my own move choices are not trainer variations', () => {
    const names = [...variationsOf(qg), ...variationsOf(ck)].map((v) => v.name);
    for (const n of ['QGD Exchange', 'QGD Orthodox (4.Bg5)', 'Slav Exchange', 'Classical (4...Bf5)', 'Karpov (4...Nd7)']) expect(names).not.toContain(n);
  });
});
