import { COL_OF, digitsOf, ROW_OF, sees } from '@sudoku/core';
import { useTranslation } from 'react-i18next';
import { isGiven, isWrong, select, type Game } from '../game/game';
import { useGameStore } from '../game/store';

type Shade = 'sel' | 'hintStrong' | 'hint' | 'same' | 'peer' | 'none';

const SHADE_CLASS: Record<Shade, string> = {
  sel: 'bg-sel',
  hintStrong: 'bg-hint-strong',
  hint: 'bg-hint',
  same: 'bg-same',
  peer: 'bg-peer',
  none: 'bg-surface',
};

function hintCells(game: Game) {
  const strong = new Set<number>();
  const soft = new Set<number>();
  const eliminated = new Map<number, number>();
  const hint = game.hint;
  if (hint?.kind === 'mistakes') hint.cells.forEach((c) => strong.add(c));
  if (hint?.kind === 'step') {
    const { step } = hint;
    step.pattern.forEach((c) => soft.add(c));
    step.placements.forEach(({ cell }) => strong.add(cell));
    for (const { cell, digit } of step.eliminations) {
      strong.add(cell);
      eliminated.set(cell, (eliminated.get(cell) ?? 0) | (1 << digit));
    }
  }
  return { strong, soft, eliminated };
}

export function Board({ game }: { game: Game }) {
  const { t } = useTranslation();
  const apply = useGameStore((s) => s.apply);
  const { selected } = game;
  const selDigit = selected === null ? 0 : game.values[selected]!;
  const { strong, soft, eliminated } = hintCells(game);

  const shadeOf = (i: number): Shade => {
    if (i === selected) return 'sel';
    if (strong.has(i)) return 'hintStrong';
    if (soft.has(i)) return 'hint';
    if (selDigit && game.values[i] === selDigit) return 'same';
    if (selected !== null && sees(selected, i)) return 'peer';
    return 'none';
  };

  return (
    <div
      role="grid"
      aria-label={t('app.title')}
      className="@container grid aspect-square w-full grid-cols-9 overflow-hidden rounded-md border-2 border-line-strong bg-line select-none"
    >
      {game.values.map((v, i) => {
        const col = COL_OF[i]!;
        const row = ROW_OF[i]!;
        const given = isGiven(game, i);
        const wrong = isWrong(game, i);
        const notes = game.notes[i]!;
        const label = [
          t('cell.label', { row: row + 1, col: col + 1 }),
          v
            ? given
              ? t('cell.given', { digit: v })
              : t('cell.value', { digit: v })
            : notes
              ? t('cell.notes', { digits: digitsOf(notes).join(' ') })
              : t('cell.empty'),
        ].join(', ');
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={label}
            aria-selected={i === selected}
            onClick={() => apply(select, i)}
            className={[
              'relative flex items-center justify-center outline-none',
              SHADE_CLASS[shadeOf(i)],
              i === selected ? 'shadow-[inset_0_0_0_2px_var(--accent)]' : '',
              // Hairline gaps come from the bg-line container; thick box borders via extra margin.
              col % 3 === 2 && col < 8 ? 'mr-[2px]' : 'mr-px',
              row % 3 === 2 && row < 8 ? 'mb-[2px]' : 'mb-px',
              col === 8 ? 'mr-0' : '',
              row === 8 ? 'mb-0' : '',
            ].join(' ')}
          >
            {wrong && (
              // Shape cue for a wrong digit, so it does not rely on the red alone.
              <span
                aria-hidden
                className="absolute top-0 right-0 size-[30%] bg-wrong [clip-path:polygon(0_0,100%_0,100%_100%)]"
              />
            )}
            {v ? (
              <span
                className={[
                  'text-[7.2cqw] leading-none',
                  given ? 'font-semibold text-ink' : wrong ? 'text-wrong' : 'text-entry',
                ].join(' ')}
              >
                {v}
              </span>
            ) : notes ? (
              <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[0.3cqw]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                  const on = (notes >> d) & 1;
                  const gone = (eliminated.get(i) ?? 0) & (1 << d);
                  return (
                    <span
                      key={d}
                      className={[
                        'flex items-center justify-center text-[3cqw] leading-none',
                        gone ? 'font-bold text-wrong line-through' : 'text-muted',
                        on && selDigit === d && !gone ? 'font-bold text-entry' : '',
                      ].join(' ')}
                    >
                      {on ? d : ''}
                    </span>
                  );
                })}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
