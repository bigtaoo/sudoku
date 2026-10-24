import { describe, expect, it } from 'vitest';
import {
  BOXES,
  countClues,
  createRng,
  gridToString,
  hashSeed,
  isGridShape,
  parseGrid,
  PEERS,
  sees,
  shuffle,
  UNITS,
} from '../src';
import { CLASSIC } from './fixtures';

describe('grid geometry', () => {
  it('has 27 units of 9 distinct cells, each cell in exactly 3 units', () => {
    expect(UNITS).toHaveLength(27);
    const seen = new Array<number>(81).fill(0);
    for (const unit of UNITS) {
      expect(new Set(unit).size).toBe(9);
      for (const i of unit) seen[i]!++;
    }
    expect(seen.every((n) => n === 3)).toBe(true);
  });

  it('lays out boxes left to right, top to bottom', () => {
    expect(BOXES[0]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20]);
    expect(BOXES[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50]);
  });

  it('gives every cell 20 peers', () => {
    for (let i = 0; i < 81; i++) {
      expect(PEERS[i]).toHaveLength(20);
      expect(PEERS[i]).not.toContain(i);
    }
    expect(sees(0, 80)).toBe(false);
    expect(sees(0, 20)).toBe(true);
    expect(sees(5, 5)).toBe(false);
  });
});

describe('parse / serialise', () => {
  it('round-trips and accepts 0, dots and whitespace', () => {
    const text = gridToString(CLASSIC);
    expect(parseGrid(text)).toEqual(CLASSIC);
    expect(parseGrid(text.replaceAll('.', '0'))).toEqual(CLASSIC);
    expect(parseGrid(text.match(/.{9}/g)!.join('\n'))).toEqual(CLASSIC);
    expect(countClues(CLASSIC)).toBe(30);
  });

  it('rejects bad input', () => {
    expect(() => parseGrid('123')).toThrow(/81/);
    expect(() => parseGrid('x'.repeat(81))).toThrow(/Invalid/);
  });

  it('checks grid shape', () => {
    expect(isGridShape(CLASSIC)).toBe(true);
    expect(isGridShape(CLASSIC.slice(1))).toBe(false);
    expect(isGridShape([...CLASSIC.slice(1), 10])).toBe(false);
    expect(isGridShape('nope')).toBe(false);
  });
});

describe('rng', () => {
  it('is reproducible for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('hashes string seeds stably', () => {
    expect(hashSeed('2026-10-24')).toBe(hashSeed('2026-10-24'));
    expect(hashSeed('2026-10-24')).not.toBe(hashSeed('2026-10-25'));
  });

  it('shuffles into a permutation', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const out = shuffle(items.slice(), createRng(1));
    expect(out.slice().sort((x, y) => x - y)).toEqual(items);
    expect(out).not.toEqual(items);
  });
});
