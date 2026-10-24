import { useEffect } from 'react';
import {
  erase,
  inputDigit,
  moveSelection,
  redo,
  requestHint,
  tick,
  toggleNoteMode,
  undo,
} from './game';
import { useGameStore } from './store';

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export function useKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || (e.target as HTMLElement | null)?.closest('input, select, textarea, dialog'))
        return;
      const { apply } = useGameStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // e.code keeps Shift+digit working on layouts where Shift changes the character.
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];

      if (mod && key === 'z') apply(e.shiftKey ? redo : undo);
      else if (mod && key === 'y') apply(redo);
      else if (mod) return;
      else if (digit) apply(inputDigit, Number(digit), e.shiftKey ? true : undefined);
      else if (['Backspace', 'Delete', '0'].includes(e.key)) apply(erase);
      else if (ARROWS[e.key]) apply(moveSelection, ...ARROWS[e.key]);
      else if (key === 'n') apply(toggleNoteMode);
      else if (key === 'h') apply(requestHint);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** Advances the game clock once a second while the tab is visible. */
export function useTimer(running: boolean) {
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (document.visibilityState === 'visible') useGameStore.getState().apply(tick, dt);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
}
