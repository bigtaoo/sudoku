import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  autoNotes,
  erase,
  inputDigit,
  remaining,
  requestHint,
  toggleNoteMode,
  undo,
  type Game,
} from '../game/game';
import { useGameStore } from '../game/store';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberPad({ game }: { game: Game }) {
  const { t } = useTranslation();
  const apply = useGameStore((s) => s.apply);
  return (
    <div className="grid grid-cols-9 gap-1">
      {DIGITS.map((d) => {
        const left = remaining(game, d);
        return (
          <button
            key={d}
            type="button"
            disabled={left === 0 || game.status !== 'playing'}
            aria-label={`${d}, ${t('pad.remaining', { count: left })}`}
            onClick={() => apply(inputDigit, d)}
            className="flex aspect-[3/4] flex-col items-center justify-center rounded-md bg-surface text-entry shadow-sm transition active:scale-95 disabled:opacity-25"
          >
            <span className="text-2xl leading-none sm:text-3xl">{d}</span>
            <span className="mt-1 text-[10px] leading-none text-muted">{left || ''}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  active = false,
  badge,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="relative flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-xs text-muted transition active:scale-95 disabled:opacity-40"
    >
      <span
        className={[
          'flex h-10 w-10 items-center justify-center rounded-full',
          active ? 'bg-accent text-accent-ink' : 'bg-surface text-ink shadow-sm',
        ].join(' ')}
      >
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
      {badge && (
        <span className="absolute top-0 right-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">
          {badge}
        </span>
      )}
    </button>
  );
}

const svg = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  undo: svg('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
  erase: svg('M20 20H8l-5-5 10-10 8 8-7 7M6.5 11.5l7 7'),
  notes: svg('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'),
  auto: svg(
    'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  ),
  hint: svg('M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2Z'),
};

export function Toolbar({ game }: { game: Game }) {
  const { t } = useTranslation();
  const apply = useGameStore((s) => s.apply);
  const playing = game.status === 'playing';
  return (
    <div className="grid grid-cols-5 gap-1">
      <ToolButton
        label={t('toolbar.undo')}
        icon={ICONS.undo}
        disabled={!playing || game.history.length === 0}
        onClick={() => apply(undo)}
      />
      <ToolButton
        label={t('toolbar.erase')}
        icon={ICONS.erase}
        disabled={!playing}
        onClick={() => apply(erase)}
      />
      <ToolButton
        label={t('toolbar.notes')}
        icon={ICONS.notes}
        active={game.noteMode}
        badge={game.noteMode ? t('toolbar.notesOn') : t('toolbar.notesOff')}
        disabled={!playing}
        onClick={() => apply(toggleNoteMode)}
      />
      <ToolButton
        label={t('toolbar.autoNotes')}
        icon={ICONS.auto}
        disabled={!playing}
        onClick={() => apply(autoNotes)}
      />
      <ToolButton
        label={t('toolbar.hint')}
        icon={ICONS.hint}
        disabled={!playing}
        onClick={() => apply(requestHint)}
      />
    </div>
  );
}
