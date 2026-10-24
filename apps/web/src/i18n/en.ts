// Source locale: zh.ts and de.ts must provide the same keys (enforced by the Messages type).

const en = {
  app: { title: 'Sudoku' },
  language: { label: 'Language' },
  difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' },
  status: { mistakes: 'Mistakes', hints: 'Hints', time: 'Time' },
  toolbar: {
    undo: 'Undo',
    erase: 'Erase',
    notes: 'Notes',
    notesOn: 'On',
    notesOff: 'Off',
    autoNotes: 'Auto notes',
    hint: 'Hint',
  },
  newGame: {
    button: 'New game',
    title: 'New game',
    pick: 'Choose a difficulty',
    cancel: 'Cancel',
    generating: 'Creating puzzle…',
    failed: 'Could not create a puzzle. Please try again.',
  },
  win: {
    title: 'Solved!',
    body: 'You finished a {{difficulty}} puzzle.',
    again: 'Play again',
  },
  mode: { label: 'Mode', classic: 'Classic', daily: 'Daily' },
  daily: {
    loading: 'Loading today’s puzzle…',
    error: 'Could not load the daily puzzle. Check your connection.',
    offline: 'You are offline. The daily puzzle needs a connection; classic mode works offline.',
    retry: 'Try again',
    title: 'Daily puzzle · {{date}}',
    submitting: 'Submitting your time…',
    submitError: 'Could not submit your time.',
    rank: 'Rank {{rank}} of {{total}}',
    score: 'Score {{score}}',
    done: 'You already solved today’s puzzle. Come back tomorrow!',
    playClassic: 'Play classic',
  },
  leaderboard: {
    button: 'Leaderboard',
    title: 'Leaderboard · {{date}}',
    loading: 'Loading…',
    error: 'Could not load the leaderboard.',
    empty: 'No one has solved today’s puzzle yet.',
    you: 'you',
    players_one: '{{count}} player',
    players_other: '{{count}} players',
    name: 'Name',
    time: 'Time',
    score: 'Score',
    penalty: 'Score = time + 30 s per hint + 10 s per mistake.',
    nickname: 'Your nickname',
    save: 'Save',
    saveError: 'Could not save. Use 1–20 characters.',
    close: 'Close',
  },
  pwa: {
    offlineReady: 'Ready to play offline.',
    update: 'A new version is available.',
    reload: 'Update',
    later: 'Later',
  },
  pad: { remaining: '{{count}} left' },
  cell: {
    label: 'Row {{row}}, column {{col}}',
    given: 'given {{digit}}',
    value: '{{digit}}',
    empty: 'empty',
    notes: 'notes {{digits}}',
  },
  unit: { row: 'row {{n}}', col: 'column {{n}}', box: 'box {{n}}' },
  cellRef: 'r{{row}}c{{col}}',
  hint: {
    apply: 'Apply',
    close: 'Close',
    none: 'No hint available for this position.',
    mistakes_one: '{{count}} digit is wrong (highlighted). Apply to clear it.',
    mistakes_other: '{{count}} digits are wrong (highlighted). Apply to clear them.',
    technique: {
      fullHouse: 'Full house',
      hiddenSingle: 'Hidden single',
      nakedSingle: 'Naked single',
      lockedCandidates: 'Locked candidates',
      nakedPair: 'Naked pair',
      hiddenPair: 'Hidden pair',
      nakedTriple: 'Naked triple',
      hiddenTriple: 'Hidden triple',
      xWing: 'X-Wing',
      xyWing: 'XY-Wing',
      swordfish: 'Swordfish',
    },
    explain: {
      fullHouse: '{{unit}} has only one empty cell left, so {{cell}} must be {{digit}}.',
      hiddenSingle: 'In {{unit}}, {{digit}} can only go in {{cell}}.',
      nakedSingle: '{{cell}} has only one possible digit left: {{digit}}.',
      lockedCandidates:
        'In {{unit}}, {{digit}} can only go in the highlighted cells, which all share another house. {{digit}} can be removed from the rest of that house.',
      nakedSubset:
        '{{cells}} can only hold {{digits}} between them, so those digits can be removed from the other cells of {{unit}}.',
      hiddenSubset:
        'In {{unit}}, {{digits}} only fit in {{cells}}, so every other candidate can be removed from those cells.',
      fish: '{{digit}} is confined to the highlighted cells, which line up in matching rows and columns. {{digit}} can be removed from the rest of those lines.',
      xyWing:
        'Whichever digit the pivot {{pivot}} takes, one of the wings must be {{digit}}. Cells that see both wings cannot be {{digit}}.',
    },
    eliminationNote: 'Applying updates your notes.',
  },
};

export default en;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;
