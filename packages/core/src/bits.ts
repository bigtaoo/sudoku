// Candidate sets are 9-bit masks where bit d (1..9) means digit d is possible.

import type { Digit } from './types';

export const ALL_DIGITS = 0b11_1111_1110;

export function bit(d: number): number {
  return 1 << d;
}

export function popcount(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

export function digitsOf(mask: number): Digit[] {
  const out: Digit[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d as Digit);
  return out;
}

/** The digit of a single-bit mask. */
export function onlyDigit(mask: number): Digit {
  return (31 - Math.clz32(mask)) as Digit;
}
