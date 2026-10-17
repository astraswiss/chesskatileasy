// Typed responses of the public chess.com API (https://www.chess.com/news/view/published-data-api)

export interface ArchivesResponse {
  archives: string[];
}

export type ChessComResult =
  | 'win'
  | 'checkmated'
  | 'agreed'
  | 'repetition'
  | 'timeout'
  | 'resigned'
  | 'stalemate'
  | 'lose'
  | 'insufficient'
  | '50move'
  | 'abandoned'
  | 'kingofthehill'
  | 'threecheck'
  | 'timevsinsufficient'
  | 'bughousepartnerlose';

export interface ChessComPlayer {
  rating: number;
  result: ChessComResult;
  '@id': string;
  username: string;
  uuid?: string;
}

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export interface ChessComGame {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  accuracies?: { white: number; black: number };
  tcn?: string;
  uuid?: string;
  initial_setup?: string;
  fen: string;
  time_class: TimeClass;
  rules: string;
  white: ChessComPlayer;
  black: ChessComPlayer;
  eco?: string;
}

export interface MonthlyGamesResponse {
  games: ChessComGame[];
}

export interface ChessComError {
  code: number;
  message: string;
}
