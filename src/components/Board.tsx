import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chessboard, type Arrow } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { Classification } from '../types/app';
import { ClassIcon } from './ClassIcon';

export interface BoardProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string };
  badge?: { square: string; c: Classification };
  arrows?: Arrow[];
  /** Enables moving pieces (drag or tap-tap). Return true if the move was accepted. */
  onMove?: (from: string, to: string) => boolean;
  id?: string;
}

export const BOARD_COLORS = { light: '#eeeed2', dark: '#769656' };

const dot = (capture: boolean): CSSProperties =>
  capture
    ? { background: 'radial-gradient(circle, transparent 58%, rgba(0, 0, 0, 0.18) 60%)' }
    : { background: 'radial-gradient(circle, rgba(0, 0, 0, 0.18) 22%, transparent 24%)' };

export function Board({ fen, orientation, lastMove, badge, arrows = [], onMove, id = 'board' }: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [fen]);

  const targets = useMemo(() => {
    if (!selected) return [];
    try {
      return new Chess(fen).moves({ square: selected as Square, verbose: true });
    } catch {
      return [];
    }
  }, [fen, selected]);

  const squareStyles = useMemo(() => {
    const s: Record<string, CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { background: 'rgba(255, 255, 51, 0.35)' };
      s[lastMove.to] = { background: 'rgba(255, 255, 51, 0.45)' };
    }
    if (selected) s[selected] = { background: 'rgba(255, 255, 51, 0.5)' };
    for (const m of targets) s[m.to] = { ...s[m.to], ...dot(!!m.captured) };
    return s;
  }, [lastMove, selected, targets]);

  const onSquareClick = (square: string) => {
    if (!onMove) return;
    const c = new Chess(fen);
    const piece = c.get(square as Square);
    if (selected && selected !== square && !(piece && piece.color === c.turn())) {
      onMove(selected, square);
      setSelected(null);
    } else if (piece && piece.color === c.turn() && selected !== square) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="aspect-square w-full touch-none select-none overflow-hidden rounded-xl">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          arrows,
          allowDrawingArrows: false,
          allowDragging: !!onMove,
          darkSquareStyle: { backgroundColor: BOARD_COLORS.dark },
          lightSquareStyle: { backgroundColor: BOARD_COLORS.light },
          animationDurationInMs: 200,
          canDragPiece: ({ piece }) => piece.pieceType[0] === fen.split(' ')[1],
          onPieceDrop: onMove
            ? ({ sourceSquare, targetSquare }) => {
                setSelected(null);
                return targetSquare && targetSquare !== sourceSquare ? onMove(sourceSquare, targetSquare) : false;
              }
            : undefined,
          onSquareClick: onMove ? ({ square }) => onSquareClick(square) : undefined,
          // Rendering squares ourselves (instead of `squareStyles`) keeps highlights working
          // together with the classification badge.
          squareRenderer: ({ square, children }) => (
            <div className="relative h-full w-full" style={squareStyles[square]}>
              {children}
              {badge && square === badge.square && (
                <div className="pointer-events-none absolute -right-[10%] -top-[10%] z-10 w-[44%]">
                  <ClassIcon c={badge.c} size={100} className="h-auto w-full drop-shadow" />
                </div>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
