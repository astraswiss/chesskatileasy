import { USERNAME } from '../config';
import type { ArchivesResponse, ChessComGame, ChessComResult, MonthlyGamesResponse } from '../types/chesscom';
import type { Game, MyResult } from '../types/app';
import { parseEcoUrl, parseHeaders } from './pgn';

const BASE = 'https://api.chess.com/pub/player';

export type ApiErrorKind = 'not-found' | 'offline' | 'server' | 'rate-limited' | 'unknown';

export class ApiError extends Error {
  kind: ApiErrorKind;
  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

async function getJson<T>(url: string): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline', 'You are offline.');
  }
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(navigator.onLine === false ? 'offline' : 'server', 'Could not reach chess.com.');
  }
  if (res.status === 404) throw new ApiError('not-found', `User "${USERNAME}" was not found on chess.com.`);
  if (res.status === 429) throw new ApiError('rate-limited', 'chess.com is rate limiting requests, try again shortly.');
  if (res.status >= 500) throw new ApiError('server', `chess.com API is unavailable (${res.status}).`);
  if (!res.ok) throw new ApiError('unknown', `Unexpected response ${res.status}.`);
  return (await res.json()) as T;
}

/** Archive month URLs, newest first. */
export async function fetchArchives(): Promise<string[]> {
  const data = await getJson<ArchivesResponse>(`${BASE}/${encodeURIComponent(USERNAME.toLowerCase())}/games/archives`);
  return [...(data.archives ?? [])].reverse();
}

export async function fetchMonth(archiveUrl: string): Promise<Game[]> {
  const data = await getJson<MonthlyGamesResponse>(archiveUrl);
  return (data.games ?? []).map((g) => normalizeGame(g, archiveUrl)).filter((g): g is Game => g !== null);
}

const DRAWS: ChessComResult[] = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'];

function toMyResult(r: ChessComResult): MyResult {
  if (r === 'win') return 'win';
  if (DRAWS.includes(r)) return 'draw';
  return 'loss';
}

/** Archive month URL ".../games/2024/05" → [year, month]. */
export function archiveYearMonth(url: string): [number, number] {
  const parts = url.split('/');
  return [Number(parts[parts.length - 2]), Number(parts[parts.length - 1])];
}

export function normalizeGame(g: ChessComGame, archive: string): Game | null {
  if (g.rules !== 'chess' || !g.pgn) return null; // variants are not supported
  const me = USERNAME.toLowerCase();
  const isWhite = g.white.username.toLowerCase() === me;
  if (!isWhite && g.black.username.toLowerCase() !== me) return null;
  const mine = isWhite ? g.white : g.black;
  const opp = isWhite ? g.black : g.white;
  const headers = parseHeaders(g.pgn);
  const ecoUrl = headers.ECOUrl ?? g.eco;
  const opening = headers.Opening ?? parseEcoUrl(ecoUrl).name;
  return {
    id: g.uuid ?? g.url.split('/').pop() ?? g.url,
    url: g.url,
    pgn: g.pgn,
    archive,
    endTime: g.end_time * 1000,
    timeClass: g.time_class,
    timeControl: g.time_control,
    rated: g.rated,
    myColor: isWhite ? 'white' : 'black',
    myResult: toMyResult(mine.result),
    myResultDetail: mine.result,
    oppResultDetail: opp.result,
    myRating: mine.rating,
    oppName: opp.username,
    oppRating: opp.rating,
    opening,
    eco: ecoUrl,
    chessComAccuracy: g.accuracies,
  };
}
