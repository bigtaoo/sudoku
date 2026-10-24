import { COL_OF, ROW_OF, type Step } from '@sudoku/core';
import type { TFunction } from 'i18next';

export function cellRef(t: TFunction, cell: number): string {
  return t('cellRef', { row: ROW_OF[cell]! + 1, col: COL_OF[cell]! + 1 });
}

/** UNITS index → localized house name (rows 0-8, columns 9-17, boxes 18-26). */
export function unitName(t: TFunction, unit: number): string {
  if (unit < 9) return t('unit.row', { n: unit + 1 });
  if (unit < 18) return t('unit.col', { n: unit - 8 });
  return t('unit.box', { n: unit - 17 });
}

const list = (items: (string | number)[]) => items.join(', ');

export function explainStep(t: TFunction, step: Step): string {
  const unit = step.unit === undefined ? '' : unitName(t, step.unit);
  const digit = step.digits[0] ?? step.placements[0]?.digit ?? '';
  const target = step.placements[0]?.cell ?? step.pattern[0] ?? 0;
  const base = { unit, digit, cell: cellRef(t, target) };

  switch (step.technique) {
    case 'fullHouse':
    case 'hiddenSingle':
    case 'nakedSingle':
      return t(`hint.explain.${step.technique}`, base);
    case 'lockedCandidates':
      return t('hint.explain.lockedCandidates', base);
    case 'nakedPair':
    case 'nakedTriple':
    case 'hiddenPair':
    case 'hiddenTriple':
      return t(
        step.technique.startsWith('naked')
          ? 'hint.explain.nakedSubset'
          : 'hint.explain.hiddenSubset',
        {
          unit,
          cells: list(step.pattern.map((c) => cellRef(t, c))),
          digits: list(step.digits),
        },
      );
    case 'xWing':
    case 'swordfish':
      return t('hint.explain.fish', base);
    case 'xyWing':
      return t('hint.explain.xyWing', { digit, pivot: cellRef(t, step.pattern[0]!) });
  }
}
