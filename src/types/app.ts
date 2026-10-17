import type { ChessComResult, TimeClass } from './chesscom';

export type Color = 'white' | 'black';
export type MyResult = 'win' | 'loss' | 'draw';

/** A normalized game as stored in IndexedDB. */
export interface Game {
  id: string;
  url: string;
  pgn: string;
  archive: string;
  endTime: number; // ms
  timeClass: TimeClass;
  timeControl: string;
  rated: boolean;
  myColor: Color;
  myResult: MyResult;
  myResultDetail: ChessComResult;
  oppResultDetail: ChessComResult;
  myRating: number;
  oppName: string;
  oppRating: number;
  opening: string;
  eco?: string;
  chessComAccuracy?: { white: number; black: number };
}

export type Classification =
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export type Phase = 'opening' | 'middlegame' | 'endgame';

export type PatternTag =
  | 'hanging-piece'
  | 'missed-tactic'
  | 'missed-punish'
  | 'time-trouble'
  | 'endgame-technique'
  | 'opening-prep';

export interface EngineScore {
  /** Centipawns from side-to-move perspective. */
  cp?: number;
  /** Mate in N from side-to-move perspective (negative = getting mated). */
  mate?: number;
}

export interface PositionEval {
  fen: string;
  score: EngineScore;
  best?: string; // uci
  pv: string[]; // uci
  depth: number;
}

export interface MoveAnalysis {
  ply: number; // 0-based index of the move in the game
  san: string;
  uci: string;
  color: Color;
  fenBefore: string;
  classification: Classification;
  /** Win% (0-100) of the mover before and after the move. */
  winBefore: number;
  winAfter: number;
  /** Win probability lost, fraction 0-1. */
  loss: number;
  accuracy: number;
  phase: Phase;
  clock?: number; // seconds left after the move
  timeSpent?: number; // seconds
  piece: string; // p n b r q k
  capture: boolean;
  check: boolean;
  oppPrevMistake: boolean;
  bestUci?: string;
  bestSan?: string;
  tags: PatternTag[];
}

export interface ClassCounts {
  white: Partial<Record<Classification, number>>;
  black: Partial<Record<Classification, number>>;
}

export interface GameAnalysis {
  gameId: string;
  depth: number;
  createdAt: number;
  version: number;
  positions: PositionEval[];
  moves: MoveAnalysis[];
  accuracy: { white: number; black: number };
  counts: ClassCounts;
  /** Denormalized for fast coach/stats queries. */
  myColor: Color;
  endTime: number;
}

export interface Puzzle {
  id: string; // gameId:ply
  gameId: string;
  ply: number;
  fen: string;
  bestUci: string;
  bestSan: string;
  playedSan: string;
  bestWin: number; // mover win% of the best move (0-100)
  tags: PatternTag[];
  classification: Classification;
  createdAt: number;
  endTime: number;
  /** Spaced repetition. */
  status: 'new' | 'solved' | 'failed';
  stage: number; // 0 = due after 1 day, 1 = 3 days, 2 = 7 days
  due: number; // ms timestamp when it's next due
  attempts: number;
  solvedCount: number;
  failedCount: number;
}

export interface Settings {
  depth: number;
  autoAnalyze: boolean;
  autoMaxPerSession: number;
}
