import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from './components/Board';
import { NumberPad, Toolbar } from './components/Controls';
import {
  HintPanel,
  LanguageSwitcher,
  NewGameDialog,
  StatusBar,
  WinDialog,
} from './components/Panels';
import { useKeyboard, useTimer } from './game/hooks';
import { useGameStore } from './game/store';

export function App() {
  const { t } = useTranslation();
  const game = useGameStore((s) => s.game);
  const generating = useGameStore((s) => s.generating);
  const [picking, setPicking] = useState(false);

  // First visit: start straight away with the last (default) difficulty.
  useEffect(() => {
    const { game, startNewGame, lastDifficulty } = useGameStore.getState();
    if (!game) void startNewGame(lastDifficulty);
  }, []);

  const playing = game?.status === 'playing' && !picking;
  useKeyboard(playing);
  useTimer(playing);

  return (
    <div className="mx-auto flex min-h-full max-w-[min(32rem,calc(100dvh-16rem))] min-w-[18rem] flex-col gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

      {game ? (
        <>
          <StatusBar game={game} />
          <Board game={game} />
          <HintPanel game={game} />
          <Toolbar game={game} />
          <NumberPad game={game} />
          {game.status === 'won' && !picking && (
            <WinDialog game={game} onAgain={() => setPicking(true)} />
          )}
        </>
      ) : (
        <p className="py-20 text-center text-muted">{generating ? t('newGame.generating') : ''}</p>
      )}

      {picking && <NewGameDialog onClose={() => setPicking(false)} />}
    </div>
  );
}
