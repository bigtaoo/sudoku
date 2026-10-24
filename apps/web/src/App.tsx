import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localDate } from './api/client';
import { Board } from './components/Board';
import { NumberPad, Toolbar } from './components/Controls';
import {
  DailyDoneDialog,
  DailyLoading,
  LeaderboardDialog,
  ModeSwitch,
  useDateLabel,
} from './components/Daily';
import {
  HintPanel,
  LanguageSwitcher,
  NewGameDialog,
  StatusBar,
  WinDialog,
} from './components/Panels';
import { PwaToast } from './components/PwaToast';
import { useKeyboard, useTimer } from './game/hooks';
import { currentGame, useGameStore } from './game/store';

export function App() {
  const { t } = useTranslation();
  const mode = useGameStore((s) => s.mode);
  const daily = useGameStore((s) => s.daily);
  const game = useGameStore(currentGame);
  const generating = useGameStore((s) => s.generating);
  const [picking, setPicking] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const dailyLabel = useDateLabel(daily?.date ?? localDate());

  useEffect(() => {
    const { mode, classic, startNewGame, loadDaily, lastDifficulty } = useGameStore.getState();
    // First visit: start straight away with the last (default) difficulty.
    if (mode === 'daily') void loadDaily();
    else if (!classic) void startNewGame(lastDifficulty);

    // Coming back to the tab on a new day switches to that day's puzzle.
    const onVisible = () => {
      const { mode, daily, loadDaily } = useGameStore.getState();
      if (document.visibilityState === 'visible' && mode === 'daily' && daily?.date !== localDate())
        void loadDaily();
    };
    // Back online: fetch the daily puzzle that failed to load, or send a win that failed to submit.
    const onOnline = () => {
      const { mode, daily, dailyError, loadDaily } = useGameStore.getState();
      if (mode === 'daily' && (dailyError || daily?.submit === 'error')) void loadDaily();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const dailyDone = mode === 'daily' && !!daily && (game?.status === 'won' || !!daily.result);
  const playing = game?.status === 'playing' && !dailyDone && !picking && !leaderboard;
  useKeyboard(playing);
  useTimer(playing);

  return (
    <div className="mx-auto flex min-h-full max-w-[min(32rem,calc(100dvh-18rem))] min-w-[18rem] flex-col gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">{t('app.title')}</h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
          >
            {t('newGame.button')}
          </button>
        </div>
      </header>

      <ModeSwitch onLeaderboard={() => setLeaderboard(true)} />

      {game ? (
        <>
          <StatusBar game={game} {...(mode === 'daily' ? { label: dailyLabel } : {})} />
          <Board game={game} />
          <HintPanel game={game} />
          <Toolbar game={game} />
          <NumberPad game={game} />
          {mode === 'classic' && game.status === 'won' && !picking && (
            <WinDialog game={game} onAgain={() => setPicking(true)} />
          )}
          {dailyDone && !picking && !leaderboard && (
            <DailyDoneDialog daily={daily} onLeaderboard={() => setLeaderboard(true)} />
          )}
        </>
      ) : mode === 'daily' ? (
        <DailyLoading />
      ) : (
        <p className="py-20 text-center text-muted">{generating ? t('newGame.generating') : ''}</p>
      )}

      {picking && <NewGameDialog onClose={() => setPicking(false)} />}
      <PwaToast />
      {leaderboard && (
        <LeaderboardDialog
          date={daily?.date ?? localDate()}
          onClose={() => setLeaderboard(false)}
        />
      )}
    </div>
  );
}
