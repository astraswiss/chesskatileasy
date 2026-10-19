/** Your chess.com username. */
export const USERNAME = "katileasy";

/** Default engine depth for manual analysis (adjustable in Settings). */
export const DEFAULT_DEPTH = 16;
/** Depth used by background auto-analysis (lower to save battery). */
export const AUTO_DEPTH = 12;

/**
 * Your opening repertoire. Games are matched by color and by the first moves (SAN).
 * `lines` name the variations: the longest matching move prefix (after `root`) wins.
 */
export const REPERTOIRE: RepertoireDef[] = [
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    color: 'white',
    root: ['d4'],
    lines: [
      { name: "Queen's Gambit", moves: ['d5', 'c4'] },
      { name: "Queen's Gambit Accepted", moves: ['d5', 'c4', 'dxc4'] },
      { name: "Queen's Gambit Declined", moves: ['d5', 'c4', 'e6'] },
      { name: 'QGD Exchange', moves: ['d5', 'c4', 'e6', 'cxd5'] },
      { name: 'QGD Exchange', moves: ['d5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5'] },
      { name: 'QGD Orthodox (4.Bg5)', moves: ['d5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5'] },
      { name: 'Tarrasch Defense', moves: ['d5', 'c4', 'e6', 'Nc3', 'c5'] },
      { name: 'Semi-Slav', moves: ['d5', 'c4', 'e6', 'Nc3', 'c6'] },
      { name: 'Semi-Slav', moves: ['d5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6'] },
      { name: 'Semi-Slav', moves: ['d5', 'c4', 'c6', 'Nc3', 'Nf6', 'Nf3', 'e6'] },
      { name: 'Slav Defense', moves: ['d5', 'c4', 'c6'] },
      { name: 'Slav Exchange', moves: ['d5', 'c4', 'c6', 'cxd5'] },
      { name: 'Albin Countergambit', moves: ['d5', 'c4', 'e5'] },
      { name: 'Chigorin Defense', moves: ['d5', 'c4', 'Nc6'] },
      { name: 'Baltic Defense', moves: ['d5', 'c4', 'Bf5'] },
      { name: '1.d4 d5 without 2.c4', moves: ['d5'] },
      { name: 'Indian defenses (1...Nf6)', moves: ['Nf6'] },
      { name: 'Dutch Defense', moves: ['f5'] },
      { name: 'Other replies to 1.d4', moves: [] },
    ],
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann',
    color: 'black',
    root: ['e4', 'c6'],
    lines: [
      { name: 'Caro-Kann (other)', moves: [] },
      { name: 'Advance Variation', moves: ['d4', 'd5', 'e5'] },
      { name: 'Exchange Variation', moves: ['d4', 'd5', 'exd5', 'cxd5'] },
      { name: 'Panov Attack', moves: ['d4', 'd5', 'exd5', 'cxd5', 'c4'] },
      { name: 'Main line (3.Nc3)', moves: ['d4', 'd5', 'Nc3'] },
      { name: 'Main line (3.Nd2)', moves: ['d4', 'd5', 'Nd2'] },
      { name: 'Classical (4...Bf5)', moves: ['d4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'] },
      { name: 'Classical (4...Bf5)', moves: ['d4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Bf5'] },
      { name: 'Karpov (4...Nd7)', moves: ['d4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nd7'] },
      { name: 'Karpov (4...Nd7)', moves: ['d4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nd7'] },
      { name: 'Fantasy Variation', moves: ['d4', 'd5', 'f3'] },
      { name: 'Two Knights', moves: ['Nc3', 'd5', 'Nf3'] },
      { name: '2.Nc3', moves: ['Nc3'] },
      { name: 'Accelerated Panov (2.c4)', moves: ['c4'] },
      { name: '2.Nf3', moves: ['Nf3'] },
      { name: "King's Indian Attack (2.d3)", moves: ['d3'] },
    ],
  },
];

export interface RepertoireDef {
  id: string;
  name: string;
  color: 'white' | 'black';
  root: string[];
  lines: { name: string; moves: string[] }[];
}
