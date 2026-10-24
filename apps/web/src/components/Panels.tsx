import { DIFFICULTIES, type Difficulty } from '@sudoku/core';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { applyHint, dismissHint, type Game } from '../game/game';
import { explainStep } from '../game/hintText';
import { useGameStore } from '../game/store';
import { LANGUAGES } from '../i18n';

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="flex items-center text-sm text-muted">
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StatusBar({ game, label = '' }: { game: Game; label?: string }) {
  const { t } = useTranslation();
  const item = (label: string, value: ReactNode) => (
    <div className="flex flex-col items-center">
      <span className="text-[11px] text-muted uppercase">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-4 text-sm">
      {item(label, t(`difficulty.${game.difficulty}`))}
      {item(t('status.mistakes'), game.mistakes)}
      {item(t('status.hints'), game.hintsUsed)}
      {item(t('status.time'), formatTime(game.elapsedMs))}
    </div>
  );
}

export function HintPanel({ game }: { game: Game }) {
  const { t } = useTranslation();
  const apply = useGameStore((s) => s.apply);
  const hint = game.hint;
  if (!hint) return null;

  let title = '';
  let body: string;
  if (hint.kind === 'none') body = t('hint.none');
  else if (hint.kind === 'mistakes') body = t('hint.mistakes', { count: hint.cells.length });
  else {
    title = t(`hint.technique.${hint.step.technique}`);
    body = explainStep(t, hint.step);
    if (!hint.step.placements.length) body += ' ' + t('hint.eliminationNote');
  }

  return (
    <div role="status" className="rounded-lg border border-hint-strong bg-hint p-3 text-sm">
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <p className="leading-snug">{body}</p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => apply(dismissHint)}
          className="rounded-md px-3 py-1.5 text-muted"
        >
          {t('hint.close')}
        </button>
        {hint.kind !== 'none' && (
          <button
            type="button"
            onClick={() => apply(applyHint)}
            className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink"
          >
            {t('hint.apply')}
          </button>
        )}
      </div>
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40"
    >
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </dialog>
  );
}

export function NewGameDialog({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const startNewGame = useGameStore((s) => s.startNewGame);
  const generating = useGameStore((s) => s.generating);
  const error = useGameStore((s) => s.error);

  const start = async (d: Difficulty) => {
    await startNewGame(d);
    if (!useGameStore.getState().error) onClose?.();
  };

  return (
    <Dialog title={t('newGame.title')} {...(onClose ? { onClose } : {})}>
      <p className="mb-3 text-sm text-muted">
        {generating ? t('newGame.generating') : t('newGame.pick')}
      </p>
      <div className="grid gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            disabled={generating}
            onClick={() => void start(d)}
            className="rounded-lg border border-line px-4 py-3 text-left font-medium transition hover:bg-peer disabled:opacity-50"
          >
            {t(`difficulty.${d}`)}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-wrong">{t('newGame.failed')}</p>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={generating}
          className="mt-3 w-full rounded-md py-2 text-muted"
        >
          {t('newGame.cancel')}
        </button>
      )}
    </Dialog>
  );
}

export function WinDialog({ game, onAgain }: { game: Game; onAgain: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog title={t('win.title')}>
      <p className="mb-4">{t('win.body', { difficulty: t(`difficulty.${game.difficulty}`) })}</p>
      <div className="mb-4">
        <StatusBar game={game} />
      </div>
      <button
        type="button"
        onClick={onAgain}
        className="w-full rounded-lg bg-accent py-2.5 font-medium text-accent-ink"
      >
        {t('win.again')}
      </button>
    </Dialog>
  );
}
