import { useMemo, type CSSProperties } from 'react';
import { Chessboard, type Arrow } from 'react-chessboard';
import type { Classification } from '../types/app';
import { ClassIcon } from './ClassIcon';

export interface BoardProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string };
  badge?: { square: string; c: Classification };
  arrows?: Arrow[];
  onDrop?: (from: string, to: string, piece: string) => boolean;
  highlight?: Record<string, CSSProperties>;
  id?: string;
}

export function Board({ fen, orientation, lastMove, badge, arrows = [], onDrop, highlight, id = 'board' }: BoardProps) {
  const squareStyles = useMemo(() => {
    const s: Record<string, CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { background: 'rgba(255, 255, 51, 0.35)' };
      s[lastMove.to] = { background: 'rgba(255, 255, 51, 0.45)' };
    }
    return { ...s, ...highlight };
  }, [lastMove, highlight]);

  return (
    <div className="aspect-square w-full touch-none select-none">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          arrows,
          allowDrawingArrows: false,
          allowDragging: !!onDrop,
          squareStyles,
          darkSquareStyle: { backgroundColor: '#769656' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
          animationDurationInMs: 180,
          onPieceDrop: onDrop
            ? ({ sourceSquare, targetSquare, piece }) => (targetSquare ? onDrop(sourceSquare, targetSquare, piece.pieceType) : false)
            : undefined,
          squareRenderer: badge
            ? ({ square, children }) => (
                <div className="relative h-full w-full">
                  {children}
                  {square === badge.square && (
                    <div className="pointer-events-none absolute -right-[12%] -top-[12%] z-10 w-[48%]">
                      <ClassIcon c={badge.c} size={100} className="h-auto w-full drop-shadow" />
                    </div>
                  )}
                </div>
              )
            : undefined,
        }}
      />
    </div>
  );
}
