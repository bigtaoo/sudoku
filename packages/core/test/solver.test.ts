import { describe, expect, it } from 'vitest';
import {
  countSolutions,
  createRng,
  emptyGrid,
  findConflicts,
  hasUniqueSolution,
  isComplete,
  isValidSolution,
  randomSolvedGrid,
  solve,
} from '../src';
import { CLASSIC, CLASSIC_SOLUTION, INKALA } from './fixtures';

describe('solver', () => {
  it('solves a classic puzzle', () => {
    expect(solve(CLASSIC)).toEqual(CLASSIC_SOLUTION);
    expect(hasUniqueSolution(CLASSIC)).toBe(true);
  });

  it('solves a very hard puzzle uniquely', () => {
    const solution = solve(INKALA)!;
    expect(isValidSolution(INKALA, solution)).toBe(true);
    expect(countSolutions(INKALA)).toBe(1);
  });

  it('reports multiple solutions up to the limit', () => {
    expect(countSolutions(emptyGrid())).toBe(2);
    expect(countSolutions(emptyGrid(), 5)).toBe(5);
  });

  it('reports no solution for contradictory givens', () => {
    const bad = emptyGrid();
    bad[0] = 5;
    bad[8] = 5;
    expect(countSolutions(bad)).toBe(0);
    expect(solve(bad)).toBeNull();
  });

  it('builds valid random full grids, reproducibly', () => {
    const a = randomSolvedGrid(createRng(7));
    expect(isComplete(a)).toBe(true);
    expect(findConflicts(a)).toEqual([]);
    expect(randomSolvedGrid(createRng(7))).toEqual(a);
    expect(randomSolvedGrid(createRng(8))).not.toEqual(a);
  });

  it('does not mutate its input', () => {
    const copy = CLASSIC.slice();
    solve(CLASSIC);
    countSolutions(CLASSIC);
    expect(CLASSIC).toEqual(copy);
  });
});

describe('validation', () => {
  it('finds conflicting cells', () => {
    const g = emptyGrid();
    g[0] = 3;
    g[4] = 3; // same row
    g[10] = 3; // same box as cell 0
    g[80] = 3; // no conflict
    expect(findConflicts(g).sort((a, b) => a - b)).toEqual([0, 4, 10]);
  });

  it('accepts only complete, consistent answers that keep the givens', () => {
    expect(isValidSolution(CLASSIC, CLASSIC_SOLUTION)).toBe(true);

    const incomplete = CLASSIC_SOLUTION.slice();
    incomplete[2] = 0;
    expect(isValidSolution(CLASSIC, incomplete)).toBe(false);

    // Swapping two digits in a row keeps the row valid but breaks columns.
    const swapped = CLASSIC_SOLUTION.slice();
    [swapped[2], swapped[3]] = [swapped[3]!, swapped[2]!];
    expect(isValidSolution(CLASSIC, swapped)).toBe(false);

    expect(isValidSolution(CLASSIC, 'not a grid')).toBe(false);
  });
});
