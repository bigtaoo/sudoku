import type { LeaderboardEntry, LeaderboardResponse } from '@sudoku/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, currentGuest } from '../api/client';
import { useGameStore, type DailyState, type Mode } from '../game/store';
import { Dialog, formatTime, StatusBar } from './Panels';

export function useDateLabel(date: string): string {
  const { i18n } = useTranslation();
  // Noon avoids DST edges turning the local date into the previous day.
  return new Date(`${date}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage, {
    dateStyle: 'medium',
  });
}

export function ModeSwitch({ onLeaderboard }: { onLeaderboard: () => void }) {
  const { t } = useTranslation();
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const tab = (m: Mode) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => mode !== m && setMode(m)}
      className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
        mode === m ? 'bg-surface text-ink shadow-sm' : 'text-muted'
      }`}
    >
      {t(`mode.${m}`)}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={t('mode.label')} className="flex flex-1 rounded-lg bg-peer p-1">
        {tab('classic')}
        {tab('daily')}
      </div>
      <button
        type="button"
        onClick={onLeaderboard}
        aria-label={t('leaderboard.button')}
        title={t('leaderboard.button')}
        className="rounded-lg border border-line p-2 text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
        </svg>
      </button>
    </div>
  );
}

/** Placeholder while today's puzzle has not been loaded. */
export function DailyLoading() {
  const { t } = useTranslation();
  const failed = useGameStore((s) => s.dailyError);
  const loadDaily = useGameStore((s) => s.loadDaily);
  return (
    <div className="py-20 text-center text-muted">
      <p>
        {!failed ? t('daily.loading') : navigator.onLine ? t('daily.error') : t('daily.offline')}
      </p>
      {failed && (
        <button
          type="button"
          onClick={() => void loadDaily()}
          className="mt-3 rounded-md bg-accent px-4 py-2 font-medium text-accent-ink"
        >
          {t('daily.retry')}
        </button>
      )}
    </div>
  );
}

export function DailyDoneDialog({
  daily,
  onLeaderboard,
}: {
  daily: DailyState;
  onLeaderboard: () => void;
}) {
  const { t } = useTranslation();
  const setMode = useGameStore((s) => s.setMode);
  const submitDaily = useGameStore((s) => s.submitDaily);
  const { game, result, submit } = daily;
  const won = game.status === 'won';
  const label = useDateLabel(daily.date);

  return (
    <Dialog title={won ? t('win.title') : t('daily.title', { date: label })}>
      <p className="mb-4">
        {won ? t('win.body', { difficulty: t(`difficulty.${game.difficulty}`) }) : t('daily.done')}
      </p>
      {won && (
        <div className="mb-4">
          <StatusBar game={game} />
        </div>
      )}
      <div className="mb-4 text-center" aria-live="polite">
        {result ? (
          <>
            <div className="text-2xl font-bold">
              {t('daily.rank', { rank: result.rank, total: result.total })}
            </div>
            <div className="text-sm text-muted tabular-nums">
              {t('daily.score', { score: formatTime(result.scoreMs) })}
            </div>
          </>
        ) : submit === 'error' ? (
          <p className="text-sm text-wrong">
            {t('daily.submitError')}{' '}
            <button type="button" onClick={() => void submitDaily()} className="underline">
              {t('daily.retry')}
            </button>
          </p>
        ) : (
          <p className="text-sm text-muted">{t('daily.submitting')}</p>
        )}
      </div>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onLeaderboard}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-accent-ink"
        >
          {t('leaderboard.button')}
        </button>
        <button
          type="button"
          onClick={() => setMode('classic')}
          className="w-full rounded-lg py-2 text-muted"
        >
          {t('daily.playClassic')}
        </button>
      </div>
    </Dialog>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useTranslation();
  return (
    <tr className={entry.me ? 'bg-sel font-semibold' : ''}>
      <td className="py-1.5 pr-2 text-right tabular-nums">{entry.rank}</td>
      <td className="max-w-0 truncate py-1.5 pr-2">
        {entry.name}
        {entry.me && <span className="ml-1 text-xs text-muted">({t('leaderboard.you')})</span>}
      </td>
      <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
        {formatTime(entry.elapsedMs)}
      </td>
      <td className="py-1.5 text-right tabular-nums">{formatTime(entry.scoreMs)}</td>
    </tr>
  );
}

export function LeaderboardDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState(() => currentGuest()?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const label = useDateLabel(date);

  const load = () => {
    setFailed(false);
    api
      .leaderboard(date)
      .then((b) => {
        setBoard(b);
        // The first authed call may have just created the guest.
        setName((n) => n || (currentGuest()?.name ?? ''));
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, [date]);

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      setName((await api.rename(name)).name);
      load();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title={t('leaderboard.title', { date: label })} onClose={onClose}>
      <div className="max-h-[50dvh] overflow-y-auto">
        {!board ? (
          <p className="py-6 text-center text-sm text-muted">
            {failed ? t('leaderboard.error') : t('leaderboard.loading')}
          </p>
        ) : board.entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t('leaderboard.empty')}</p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-16" />
              <col className="w-16" />
            </colgroup>
            <thead className="text-xs text-muted">
              <tr>
                <th className="pr-2 text-right font-normal">#</th>
                <th className="pr-2 text-left font-normal">{t('leaderboard.name')}</th>
                <th className="pr-2 text-right font-normal">{t('leaderboard.time')}</th>
                <th className="text-right font-normal">{t('leaderboard.score')}</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <Row key={e.rank} entry={e} />
              ))}
              {board.me && (
                <>
                  <tr aria-hidden>
                    <td colSpan={4} className="text-center text-muted">
                      ⋯
                    </td>
                  </tr>
                  <Row entry={board.me} />
                </>
              )}
            </tbody>
          </table>
        )}
      </div>
      {board && board.total > 0 && (
        <p className="mt-2 text-xs text-muted">
          {t('leaderboard.players', { count: board.total })} · {t('leaderboard.penalty')}
        </p>
      )}

      {currentGuest() && (
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-1 flex-col text-xs text-muted">
            {t('leaderboard.nickname')}
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {t('leaderboard.save')}
          </button>
        </form>
      )}
      {saveError && <p className="mt-1 text-xs text-wrong">{t('leaderboard.saveError')}</p>}

      <button type="button" onClick={onClose} className="mt-3 w-full rounded-md py-2 text-muted">
        {t('leaderboard.close')}
      </button>
    </Dialog>
  );
}
