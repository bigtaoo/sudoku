import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  activeFocus,
  autoNotes,
  erase,
  hasAssists,
  inputDigit,
  remaining,
  requestHint,
  toggleFocus,
  toggleNoteMode,
  undo,
  type Game,
} from '../game/game';
import { useGameStore } from '../game/store';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const LONG_PRESS_MS = 450;
const FOCUS_TIP_KEY = 'sudoku:focusTipSeen';

// The tip flag is a per-device nicety; storage may be blocked, so failures are ignored.
function focusTipSeen(): boolean {
  try {
    return localStorage.getItem(FOCUS_TIP_KEY) === '1';
  } catch {
    return false;
  }
}

function markFocusTipSeen(): void {
  try {
    localStorage.setItem(FOCUS_TIP_KEY, '1');
  } catch {
    // Ignore.
  }
}

export function NumberPad({ game }: { game: Game }) {
  const { t } = useTranslation();
  const apply = useGameStore((s) => s.apply);
  const assists = hasAssists(game);
  const focus = activeFocus(game);
  // A tap fills the selected cell; holding a key toggles focus mode instead, and the click that
  // follows the long press is swallowed.
  const press = useRef<{ timer: number; long: boolean } | null>(null);

  const startPress = (d: number) => {
    if (press.current) clearTimeout(press.current.timer);
    if (!assists) return void (press.current = null);
    const p = { long: false, timer: 0 };
    p.timer = window.setTimeout(() => {
      p.long = true;
      if ('vibrate' in navigator) navigator.vibrate(10);
      markFocusTipSeen();
      apply(toggleFocus, d);
    }, LONG_PRESS_MS);
    press.current = p;
  };
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
  };
  const click = (d: number) => {
    if (press.current?.long) return void (press.current = null);
    apply(inputDigit, d);
  };

  return (
    <div className="grid grid-cols-9 gap-1">
      {DIGITS.map((d) => {
        const left = remaining(game, d);
        const focused = focus === d;
        return (
          <button
            key={d}
            type="button"
            disabled={left === 0 || game.status !== 'playing'}
            aria-label={`${d}, ${t('pad.remaining', { count: left })}`}
            aria-pressed={assists ? focused : undefined}
            onClick={() => click(d)}
            onPointerDown={() => startPress(d)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            className={[
              'flex h-[clamp(3.25rem,8dvh,4.5rem)] flex-col items-center justify-center rounded-md shadow-sm transition [-webkit-touch-callout:none] active:scale-95 disabled:opacity-25',
              focused ? 'bg-accent text-accent-ink' : 'bg-surface text-entry',
            ].join(' ')}
          >
            <span className="text-3xl leading-none">{d}</span>
            <span
              className={[
                'mt-1 text-[10px] leading-none',
                focused ? 'opacity-80' : 'text-muted',
              ].join(' ')}
            >
              {left || ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One-time pointer to focus mode, floating above the board like the hint panel. */
export function FocusTip({ game }: { game: Game }) {
  const { t } = useTranslation();
  const [closed, setClosed] = useState(false);
  // Read on every render: the number pad sets the flag on the first long press.
  if (closed || focusTipSeen() || !hasAssists(game) || game.status !== 'playing' || game.hint)
    return null;
  return (
    <div
      role="status"
      className="absolute inset-x-0 bottom-full z-20 mb-2 flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm text-bg shadow-lg"
    >
      <span className="flex-1">{t('focus.tip')}</span>
      <button
        type="button"
        aria-label={t('hint.close')}
        onClick={() => {
          markFocusTipSeen();
          setClosed(true);
        }}
        className="px-1 text-lg leading-none opacity-70"
      >
        ×
      </button>
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
  const assists = hasAssists(game);
  return (
    <div className={['grid gap-1', assists ? 'grid-cols-5' : 'grid-cols-4'].join(' ')}>
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
      {assists && (
        <ToolButton
          label={t('toolbar.autoNotes')}
          icon={ICONS.auto}
          disabled={!playing}
          onClick={() => apply(autoNotes)}
        />
      )}
      <ToolButton
        label={t('toolbar.hint')}
        icon={ICONS.hint}
        disabled={!playing}
        onClick={() => apply(requestHint)}
      />
    </div>
  );
}
