import type { Messages } from './en';

const zh: Messages = {
  app: { title: '数独' },
  language: { label: '语言' },
  difficulty: { easy: '简单', medium: '中等', hard: '困难', expert: '专家' },
  status: { mistakes: '错误', hints: '提示', time: '用时' },
  toolbar: {
    undo: '撤销',
    erase: '擦除',
    notes: '笔记',
    notesOn: '开',
    notesOff: '关',
    autoNotes: '自动笔记',
    hint: '提示',
  },
  newGame: {
    button: '新游戏',
    title: '新游戏',
    pick: '选择难度',
    cancel: '取消',
    generating: '正在生成题目…',
    failed: '题目生成失败，请重试。',
  },
  win: {
    title: '完成！',
    body: '你完成了一道{{difficulty}}难度的数独。',
    again: '再来一局',
  },
  pad: { remaining: '剩 {{count}} 个' },
  cell: {
    label: '第 {{row}} 行第 {{col}} 列',
    given: '题目数字 {{digit}}',
    value: '{{digit}}',
    empty: '空',
    notes: '笔记 {{digits}}',
  },
  unit: { row: '第 {{n}} 行', col: '第 {{n}} 列', box: '第 {{n}} 宫' },
  cellRef: 'R{{row}}C{{col}}',
  hint: {
    apply: '应用',
    close: '关闭',
    none: '当前局面没有可用的提示。',
    mistakes_one: '有 {{count}} 个数字填错了（已标出），点“应用”清除。',
    mistakes_other: '有 {{count}} 个数字填错了（已标出），点“应用”清除。',
    technique: {
      fullHouse: '唯一空格',
      hiddenSingle: '隐性唯一',
      nakedSingle: '显性唯一',
      lockedCandidates: '区块摒除',
      nakedPair: '显性数对',
      hiddenPair: '隐性数对',
      nakedTriple: '显性三数组',
      hiddenTriple: '隐性三数组',
      xWing: 'X-Wing',
      xyWing: 'XY-Wing',
      swordfish: '剑鱼',
    },
    explain: {
      fullHouse: '{{unit}}只剩一个空格，所以 {{cell}} 必须是 {{digit}}。',
      hiddenSingle: '在{{unit}}中，{{digit}} 只能放在 {{cell}}。',
      nakedSingle: '{{cell}} 只剩一个可能的数字：{{digit}}。',
      lockedCandidates:
        '在{{unit}}中，{{digit}} 只能出现在高亮的格子里，而这些格子同属另一个区域，所以该区域的其他格子可以排除 {{digit}}。',
      nakedSubset: '{{cells}} 只能填 {{digits}}，所以{{unit}}的其他格子可以排除这些数字。',
      hiddenSubset: '在{{unit}}中，{{digits}} 只能放在 {{cells}}，所以这些格子可以排除其他候选数。',
      fish: '{{digit}} 被限制在高亮的格子里，它们排成相同的行和列，所以这些行（列）的其他格子可以排除 {{digit}}。',
      xyWing:
        '无论枢纽格 {{pivot}} 填哪个数，两翼中总有一格是 {{digit}}，所以同时能看到两翼的格子不能是 {{digit}}。',
    },
    eliminationNote: '应用后会更新你的笔记。',
  },
};

export default zh;
