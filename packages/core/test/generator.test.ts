import { describe, expect, it } from 'vitest';
import {
  countClues,
  DIFFICULTIES,
  generatePuzzle,
  grade,
  hasUniqueSolution,
  isValidSolution,
  MIN_CLUES,
  TECHNIQUE_TIER,
} from '../src';

describe('generatePuzzle', () => {
  it('is deterministic per seed', () => {
    const a = generatePuzzle({ difficulty: 'medium', seed: '2026-10-24' });
    const b = generatePuzzle({ difficulty: 'medium', seed: '2026-10-24' });
    const c = generatePuzzle({ difficulty: 'medium', seed: '2026-10-25' });
    expect(b).toEqual(a);
    expect(c.puzzle).not.toEqual(a.puzzle);
  });

  it.each(DIFFICULTIES)('produces valid %s puzzles at the requested tier', (difficulty) => {
    for (let s = 0; s < 5; s++) {
      const p = generatePuzzle({ difficulty, seed: s });
      expect(p.difficulty).toBe(difficulty);
      expect(hasUniqueSolution(p.puzzle)).toBe(true);
      expect(isValidSolution(p.puzzle, p.solution)).toBe(true);
      expect(p.clues).toBe(countClues(p.puzzle));
      expect(p.clues).toBeGreaterThanOrEqual(MIN_CLUES[difficulty]);

      // Clues are removed in 180° pairs.
      for (let i = 0; i < 81; i++) expect(p.puzzle[i] === 0).toBe(p.puzzle[80 - i] === 0);

      const r = grade(p.puzzle);
      expect(r.difficulty).toBe(difficulty);
      expect(r.score).toBe(p.score);
      // The tier really is earned: at least one step needs a technique of that tier.
      expect(r.steps.some((st) => TECHNIQUE_TIER[st.technique] === difficulty)).toBe(true);
    }
  });

  it('falls back to the hardest puzzle found when attempts run out', () => {
    const p = generatePuzzle({ difficulty: 'expert', seed: 3, maxAttempts: 1 });
    expect(hasUniqueSolution(p.puzzle)).toBe(true);
    expect(DIFFICULTIES).toContain(p.difficulty);
  });
});
