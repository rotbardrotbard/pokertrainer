// Генераторы тренировочных вопросов для всех тренажёров.
import {
  Card, fullDeck, shuffle, cardToString, SUIT_SYMBOLS, RANK_NAMES_RU, parseCard,
} from './cards'
import { evaluate7, handName, handCategoryName } from './evaluator'
import { simulateEquity, countOuts } from './equity'
import {
  Position, openRangeClassesFor, vsRaiseCharts, handClass, handInSet,
  rangePercent, topPercentClasses, POSITION_NAMES_RU, classesToCombos,
  holdemActionFrequencies, dominantAction, secondaryAction, freqAggregate, freqLabel,
} from './ranges'

const rand: () => number = Math.random
const ri = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: T[]): T => arr[ri(arr.length)]

function shuffledDeck(): Card[] {
  return shuffle(fullDeck(), rand)
}

// ============ 1. МАТЕМАТИКА: РАСШИРЕННЫЙ БАНК ЗАДАЧ ============

export type MathKind =
  | 'potOdds'
  | 'ratio'
  | 'rule24'
  | 'bluffBreakeven'
  | 'mdf'
  | 'bluffEv'
  | 'combos'
  | 'spr'

export interface MathQuestion {
  kind: MathKind
  prompt: string
  hint: string
  /** верный числовой ответ */
  answer: number
  /** единица измерения: '%', 'bb', 'шт' или '' */
  unit: '%' | 'bb' | 'шт' | ''
  /** допустимое отклонение ответа */
  tolerance: number
  /** правильный ответ с кратким выводом для фидбека */
  solutionText: string
}

export function checkMathAnswer(q: MathQuestion, answer: number): boolean {
  return Math.abs(answer - q.answer) <= q.tolerance
}

const POT_ODDS_BETS = [
  { label: 'половину банка', mult: 0.5 },
  { label: '2/3 банка', mult: 2 / 3 },
  { label: '3/4 банка', mult: 0.75 },
  { label: 'размер банка', mult: 1 },
  { label: 'двойной овербет', mult: 2 },
]

function fmtRatio(x: number): string {
  return x === Math.round(x) ? String(Math.round(x)) : String(Math.round(x * 10) / 10)
}

function r1(x: number): number {
  return Math.round(x * 10) / 10
}

/** Требуемое эквити для прибыльного колла по размеру ставки */
export function genMathQuestion(): MathQuestion {
  const pot = pick([40, 60, 80, 100, 120, 160, 200])
  const b = pick(POT_ODDS_BETS)
  const bet = Math.round((pot * b.mult) / 10) * 10
  const requiredPct = r1((bet / (pot + 2 * bet)) * 100)
  const ratio = (pot + bet) / bet
  return {
    kind: 'potOdds',
    prompt:
      `Банк — ${pot} bb. Оппонент ставит ${bet} bb (${b.label}). ` +
      `Сколько процентов эквити нужно для прибыльного колла?`,
    hint: `Формула: ставка / (банк + ставка + ваш колл) = ${bet} / (${pot} + ${bet} + ${bet})`,
    answer: requiredPct,
    unit: '%',
    tolerance: 1.5,
    solutionText: `требуемое эквити ≈ ${requiredPct}% (шансы банка ${fmtRatio(ratio)}:1)`,
  }
}

/** Шансы банка в формате a:1 → требуемое эквити */
export function genRatioQuestion(): MathQuestion {
  const ratioNum = pick([0.5, 1, 1.5, 2, 2.5, 3, 4])
  const required = r1((1 / (ratioNum + 1)) * 100)
  return {
    kind: 'ratio',
    prompt: `Шансы банка составляют ${fmtRatio(ratioNum)}:1. Какой процент эквити нужен для колла?`,
    hint: `Формула: 1 / (a + 1) × 100%, где a — шансы банка.`,
    answer: required,
    unit: '%',
    tolerance: 1.5,
    solutionText: `нужно ${required}% эквити (1 / (${fmtRatio(ratioNum)} + 1) × 100%)`,
  }
}

/** Правило 2 и 4: аутсы → примерный шанс улучшения */
const RULE24_OUTS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15]

export function genRule24Question(): MathQuestion {
  const outs = pick(RULE24_OUTS)
  const flop = Math.random() < 0.6
  const factor = flop ? 4 : 2
  const answer = outs * factor
  return {
    kind: 'rule24',
    prompt: flop
      ? `Вы на флопе и у вас ${outs} аутсов. Какой примерно шанс улучшиться до ривера по правилу 2 и 4?`
      : `Вы на терне и у вас ${outs} аутсов. Какой примерно шанс улучшиться на ривере по правилу 2 и 4?`,
    hint: flop ? `Правило 4: аутсы × 4 = ${outs} × 4` : `Правило 2: аутсы × 2 = ${outs} × 2`,
    answer,
    unit: '%',
    tolerance: 2,
    solutionText: flop ? `≈ ${outs} × 4 = ${answer}% (две улицы)` : `≈ ${outs} × 2 = ${answer}% (одна улица)`,
  }
}

const MATH_POTS = [40, 60, 80, 100, 120, 160]
const BET_FRACTIONS: Array<{ label: string; mult: number }> = [
  { label: 'треть банка', mult: 1 / 3 },
  { label: 'половину банка', mult: 0.5 },
  { label: '2/3 банка', mult: 2 / 3 },
  { label: '3/4 банка', mult: 0.75 },
  { label: 'размер банка', mult: 1 },
]

function betOf(pot: number, f: { mult: number }): number {
  return Math.max(10, Math.round((pot * f.mult) / 5) * 5)
}

/** Минимальное фолд-эквити безубыточного чистого блефа */
export function genBluffBreakevenQuestion(): MathQuestion {
  const pot = pick(MATH_POTS)
  const b = pick(BET_FRACTIONS)
  const bet = betOf(pot, b)
  const required = r1((bet / (pot + bet)) * 100)
  return {
    kind: 'bluffBreakeven',
    prompt: `Банк — ${pot} bb. Вы ставите ${bet} bb как чистый блеф (${b.label}). Какой процент фолдов соперника нужен, чтобы блеф окупался сразу?`,
    hint: `Формула: ставка / (банк + ставка) = ${bet} / (${pot} + ${bet})`,
    answer: required,
    unit: '%',
    tolerance: 1.5,
    solutionText: `нужны фолды ≥ ${required}% (${bet} / (${pot} + ${bet}))`,
  }
}

/** MDF — минимальная частота защиты против ставки */
export function genMdfQuestion(): MathQuestion {
  const pot = pick(MATH_POTS)
  const b = pick(BET_FRACTIONS)
  const bet = betOf(pot, b)
  const mdf = r1((pot / (pot + bet)) * 100)
  return {
    kind: 'mdf',
    prompt: `Банк — ${pot} bb. Оппонент ставит ${bet} bb (${b.label}). Какой минимальный процент рук нужно защищать (MDF), чтобы его блефы не были автоприбыльными?`,
    hint: `MDF = банк / (банк + ставка) = ${pot} / (${pot} + ${bet})`,
    answer: mdf,
    unit: '%',
    tolerance: 1.5,
    solutionText: `MDF ≈ ${mdf}% (${pot} / (${pot} + ${bet}))`,
  }
}

/** EV чистого блефа при заданном фолд-эквити */
const BLUFF_FOLD_PCTS = [30, 40, 50, 60, 70]

export function genBluffEvQuestion(): MathQuestion {
  const pot = pick([40, 60, 80, 100, 120])
  const betMult = pick([0.5, 0.75, 1])
  const bet = Math.round((pot * betMult) / 5) * 5
  const foldPct = pick(BLUFF_FOLD_PCTS)
  const f = foldPct / 100
  const ev = r1(f * pot - (1 - f) * bet)
  return {
    kind: 'bluffEv',
    prompt: `Банк — ${pot} bb. Вы блефуете на ${bet} bb, соперник сдаётся в ${foldPct}% случаев. Чему равен EV блефа?`,
    hint: `EV = фолд-эквити × банк − (1 − фолд-эквити) × ставка = ${f} × ${pot} − ${(1 - f).toFixed(2)} × ${bet}`,
    answer: ev,
    unit: 'bb',
    tolerance: 1,
    solutionText: `EV = ${f.toFixed(2)} × ${pot} − ${(1 - f).toFixed(2)} × ${bet} = ${ev > 0 ? '+' : ''}${ev} bb`,
  }
}

/** Число комбинаций стартовых рук на префлопе */
const COMBO_TASKS: Array<{ hand: string; answer: number; why: string }> = [
  { hand: 'AA', answer: 6, why: 'карманная пара: 4 × 3 / 2 = 6 комбинаций' },
  { hand: '77', answer: 6, why: 'карманная пара: 4 × 3 / 2 = 6 комбинаций' },
  { hand: 'QQ', answer: 6, why: 'карманная пара: 4 × 3 / 2 = 6 комбинаций' },
  { hand: 'AK', answer: 16, why: '4 аса × 4 короля = 16: 12 разномастных + 4 одномастные' },
  { hand: 'AKs', answer: 4, why: 'одномастные: по одной комбинации на каждую масть' },
  { hand: 'AKo', answer: 12, why: 'разномастные: 4 × 3 = 12' },
  { hand: 'T9s', answer: 4, why: 'одномастные: по одной комбинации на каждую масть' },
  { hand: 'A5o', answer: 12, why: 'разномастные: 4 × 3 = 12' },
]

export function genCombosQuestion(): MathQuestion {
  const t = pick(COMBO_TASKS)
  return {
    kind: 'combos',
    prompt: `Сколько комбинаций стартовых рук у ${t.hand} на префлопе (полная колода 52 карты)?`,
    hint: t.why,
    answer: t.answer,
    unit: 'шт',
    tolerance: 0.2,
    solutionText: `${t.hand} — ${t.answer} комбинаций (${t.why})`,
  }
}

/** SPR — соотношение эффективного стека к банку */
const SPR_POTS = [10, 15, 20, 25, 30, 40, 50]
const SPR_STACKS = [50, 75, 100, 150]

export function genSprQuestion(): MathQuestion {
  const pot = pick(SPR_POTS)
  const stacks = SPR_STACKS.filter((s) => s > pot * 1.2)
  const stack = pick(stacks)
  const spr = r1(stack / pot)
  return {
    kind: 'spr',
    prompt: `Эффективный стек — ${stack} bb, банк — ${pot} bb. Какой SPR (стек / банк)?`,
    hint: `SPR = эффективный стек / банк = ${stack} / ${pot}`,
    answer: spr,
    unit: '',
    tolerance: 0.2,
    solutionText: `SPR = ${stack} / ${pot} ≈ ${spr}`,
  }
}

// ============ 2. АУТСЫ: РАСШИРЕННЫЙ БАНК СЦЕНАРИЕВ ============

export interface OutsQuestion {
  hero: Card[]
  villain: Card[]
  board: Card[]
  outs: Card[]
  outsCount: number
  street: 'flop' | 'turn'
  heroHandName: string
  villainHandName: string
  heroAheadNow: boolean
  /** название типа сценария, например «Флеш-дро + гатшот» */
  scenario: string
  /** пояснение, показываемое после ответа */
  note?: string
}

interface OutsSpec {
  scenario: string
  note?: string
  hero: [string, string]
  villain: [string, string]
  board: [string, string, string]
}

/** Банк сценариев аутсов: рука оппонента подобрана так, что точный подсчёт
 *  (через evaluate7 + countOuts) совпадает с классическим правилом. */
export const OUTS_SCENARIOS: OutsSpec[] = [
  {
    scenario: 'Флеш-дро',
    hero: ['Qs', 'Js'],
    villain: ['Ac', 'Ad'],
    board: ['Ks', '7s', '2d'],
  },
  {
    scenario: 'Двусторонний стрит-дро (OESD)',
    hero: ['Jh', 'Th'],
    villain: ['9h', '9s'],
    board: ['8c', '9d', '2s'],
  },
  {
    scenario: 'Гатшот',
    hero: ['8h', '7h'],
    villain: ['Qd', 'Qc'],
    board: ['Td', 'Jc', '2s'],
  },
  {
    scenario: 'Стрит-дро + флеш-дро (комбо-дро)',
    note: '9 аутсов флеша + 8 аутсов стрита, но 6♠ и J♠ дают и то и другое — считаются один раз (итого 15).',
    hero: ['9s', '8s'],
    villain: ['Ac', 'Ad'],
    board: ['Ts', '7d', '2s'],
  },
  {
    scenario: 'Флеш-дро + гатшот',
    note: '9 аутсов флеша + 3 не-пиковые семёрки для стрита (7♠ уже учтён во флеше) — итого 12.',
    hero: ['Ts', '8s'],
    villain: ['Ac', 'Ad'],
    board: ['9s', '6s', '2d'],
  },
  {
    scenario: 'Флеш-дро + две оверкарты',
    note: '9 аутсов флеша + 3 аса + 3 короля (старшая пара бьёт карманных валетов) — итого 15.',
    hero: ['As', 'Ks'],
    villain: ['Jc', 'Jd'],
    board: ['Ts', '7s', '2d'],
  },
  {
    scenario: 'Двойной гатшот',
    note: 'Оставшиеся дамы и все семёрки достраивают стрит, который бьёт сет дам (2 + 4 = 6).',
    hero: ['Jh', '9h'],
    villain: ['Qc', 'Qd'],
    board: ['Th', '8d', '2c'],
  },
  {
    scenario: 'Две оверкарты',
    note: '3 аса + 3 короля дают старшую пару против карманных дам: 6 аутсов.',
    hero: ['Ah', 'Kh'],
    villain: ['Qc', 'Qd'],
    board: ['7c', '3d', '2h'],
  },
  {
    scenario: 'Одна оверкарта',
    note: 'Только 3 аса бьют пару валетов: ваш туз в руке, а десятка младше валетов.',
    hero: ['Ac', 'Td'],
    villain: ['Jh', 'Js'],
    board: ['7c', '3d', '2h'],
  },
  {
    scenario: 'Сет под готовым флешем',
    note: 'Пара на доске (шестёрка или двойка) даёт фулл-хаус, 9♣ — каре: 7 аутсов.',
    hero: ['9h', '9d'],
    villain: ['As', 'Ks'],
    board: ['9s', '6s', '2s'],
  },
  {
    scenario: 'Две пары под флешем',
    note: 'Только оставшиеся асы и короли превращают две пары в фулл-хаус; пара тройки на доске — нет (4 аутса).',
    hero: ['Ah', 'Kd'],
    villain: ['5c', '4c'],
    board: ['Ac', 'Kc', '3c'],
  },
  {
    scenario: 'Карманная пара → сет',
    note: 'Оставшиеся две восьмёрки дают сет против пары асов: 2 аутса. Пары на доске дают лишь две младшие пары.',
    hero: ['8h', '8d'],
    villain: ['Ah', 'Ad'],
    board: ['9s', '3c', '2d'],
  },
  {
    scenario: 'Флеш-дро против сета (отравленный аутс)',
    note: 'Из 9 пиковых аутсов один — 9♠ — даёт оппоненту каре и не считается: чистых аутсов 8.',
    hero: ['As', 'Js'],
    villain: ['9c', '9h'],
    board: ['Ks', '9d', '3s'],
  },
]

function parse(code: string): Card {
  const c = parseCard(code)
  if (!c) throw new Error('bad card ' + code)
  return c
}

export function genOutsQuestion(): OutsQuestion {
  const spec = pick(OUTS_SCENARIOS)
  const hero = spec.hero.map(parse)
  const villain = spec.villain.map(parse)
  const board = spec.board.map(parse)
  const { outs, heroAheadNow } = countOuts(hero, villain, board)
  const heroRes = evaluate7([...hero, ...board])
  const vilRes = evaluate7([...villain, ...board])
  return {
    hero,
    villain,
    board,
    outs,
    outsCount: outs.length,
    street: 'flop',
    heroHandName: handName(heroRes),
    villainHandName: handName(vilRes),
    heroAheadNow,
    scenario: spec.scenario,
    note: spec.note,
  }
}

/** Сгруппированное объяснение аутсов по рангам */
export function describeOuts(outs: Card[]): string {
  const byRank = new Map<number, Card[]>()
  for (const c of outs) {
    const arr = byRank.get(c.r) ?? []
    arr.push(c)
    byRank.set(c.r, arr)
  }
  const parts: string[] = []
  for (const [r, cards] of [...byRank.entries()].sort((a, b) => b[0] - a[0])) {
    const suits = cards.map((c) => SUIT_SYMBOLS[c.s]).join('')
    parts.push(`${RANK_NAMES_RU[r]} (${suits})`)
  }
  return parts.join(', ')
}

// ============ 3. EV ТРЕНАЖЁР: ВЫБОР ИЗ 5 ЗНАЧЕНИЙ ============

export interface EvQuestion {
  pot: number
  bet: number
  equityPct: number
  evCall: number
  correctAction: 'call' | 'fold'
  /** 5 значений EV для выбора, ровно одно верное */
  options: number[]
}

const EV_POTS = [45, 55, 70, 85, 95, 115, 135, 165]
const EV_BET_MULTS = [0.4, 0.5, 0.6, 0.75, 1]

export function genEvQuestion(): EvQuestion {
  const pot = pick(EV_POTS)
  const betMult = pick(EV_BET_MULTS)
  const bet = Math.max(10, Math.round(pot * betMult))
  const required = bet / (pot + 2 * bet)
  // генерируем эквити рядом с порогом, чтобы решение было нетривиальным
  const delta = Math.random() * 0.22 - 0.11
  const equity = Math.min(0.95, Math.max(0.05, required + delta))
  const equityPct = Math.round(equity * 1000) / 10
  const eq = equityPct / 100
  const evCall = r1(eq * (pot + bet) - (1 - eq) * bet)
  return {
    pot,
    bet,
    equityPct,
    evCall,
    correctAction: evCall > 0 ? 'call' : 'fold',
    options: buildEvOptions(evCall),
  }
}

/** 5 значений EV: верное + 4 правдоподобные ловушки (перепутанный знак,
 *  соседние значения, грубая оценка). */
function buildEvOptions(correct: number): number[] {
  const seen = new Set<string>([correct.toFixed(1)])
  const variants: number[] = [correct]
  let attempts = 0
  while (variants.length < 5 && attempts < 200) {
    attempts++
    const mode = attempts % 4
    let v: number
    if (mode === 1) v = correct + 2 + Math.random() * 6
    else if (mode === 2) v = correct - 2 - Math.random() * 6
    else if (mode === 3) v = -correct + (Math.random() * 8 - 4)
    else v = correct + (8 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1)
    const rounded = r1(v)
    const key = rounded.toFixed(1)
    if (!seen.has(key)) {
      seen.add(key)
      variants.push(rounded)
    }
  }
  // Фишер–Йетс
  for (let i = variants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[variants[i], variants[j]] = [variants[j], variants[i]]
  }
  return variants
}

export function evFormulaText(q: EvQuestion): string {
  const eq = q.equityPct / 100
  return (
    `EV(колл) = ${eq.toFixed(2)} × (${q.pot} + ${q.bet}) − ${(1 - eq).toFixed(2)} × ${q.bet} = ` +
    `${(eq * (q.pot + q.bet)).toFixed(1)} − ${((1 - eq) * q.bet).toFixed(1)} = ` +
    `${q.evCall > 0 ? '+' : ''}${q.evCall.toFixed(1)} bb`
  )
}

// ============ 4. КТО ПОБЕДИЛ ============

export interface WinnerQuestion {
  hero: Card[]
  villain: Card[]
  board: Card[]
  correct: 'hero' | 'villain' | 'tie'
  heroHandName: string
  villainHandName: string
  heroBest: Card[]
  villainBest: Card[]
}

export function genWinnerQuestion(): WinnerQuestion {
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const villain = [deck[2], deck[3]]
  const boardN = pick([3, 4, 5, 5, 5])
  const board = deck.slice(4, 4 + boardN)
  const heroRes = evaluate7([...hero, ...board])
  const vilRes = evaluate7([...villain, ...board])
  const correct = heroRes.score > vilRes.score ? 'hero' : heroRes.score < vilRes.score ? 'villain' : 'tie'
  return {
    hero,
    villain,
    board,
    correct,
    heroHandName: handName(heroRes),
    villainHandName: handName(vilRes),
    heroBest: heroRes.best,
    villainBest: vilRes.best,
  }
}

// ============ 5. КВИЗ «КАКАЯ КОМБИНАЦИЯ» ============

export interface ComboQuestion {
  hero: Card[]
  board: Card[]
  correctCat: number
  correctName: string
}

export const COMBO_CATEGORIES = 9

export function genComboQuestion(): ComboQuestion {
  for (let attempt = 0; attempt < 200; attempt++) {
    const deck = shuffledDeck()
    const hero = [deck[0], deck[1]]
    const boardN = pick([5, 5, 5, 4])
    const board = deck.slice(2, 2 + boardN)
    const res = evaluate7([...hero, ...board])
    // не даём слишком частых «старшая карта» и «пара»
    if (res.cat >= 1 || Math.random() < 0.25) {
      return { hero, board, correctCat: res.cat, correctName: handName(res) }
    }
  }
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const board = deck.slice(2, 7)
  const res = evaluate7([...hero, ...board])
  return { hero, board, correctCat: res.cat, correctName: handName(res) }
}

export function comboCategoryLabel(cat: number): string {
  return handCategoryName(cat)
}

// ============ 6. СИМУЛЯТОР РЕШАЮЩИХ ДЕЙСТВИЙ ============

export type SimAction = 'fold' | 'call' | 'raise'

export interface SimScenarioBase {
  kind: 'open' | 'vsRaise' | 'postflop'
  hero: Card[]
  board?: Card[]
  position: Position
  prompt: string
  actionLabels: { fold: string; call: string | null; raise: string }
  correctAction: SimAction
  altAction?: SimAction // второе действие смешанной стратегии (тоже засчитывается)
  altFreq?: number // частота второго действия, %
  explanation: string
  detail: string[]
  pot: number
  bet: number
  stack: number
}

/** Засчитывается ли ответ: основное действие или допустимый микс-альтернатива. */
export function isSimActionCorrect(
  sc: { correctAction: SimAction; altAction?: SimAction },
  a: SimAction | null,
): boolean {
  if (a === null) return false
  return a === sc.correctAction || (sc.altAction !== undefined && a === sc.altAction)
}

const SIM_ALT_LABEL: Record<SimAction, string> = { raise: '3бет', call: 'колл', fold: 'фолд' }

/** Префлоп: открытие из позиции */
export function genOpenScenario(): SimScenarioBase {
  const pos = pick<Position>(['UTG', 'MP', 'CO', 'BTN', 'SB'])
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const range = openRangeClassesFor(pos, 6)
  const inRange = handInSet(hero[0], hero[1], range)
  const pct = rangePercent(range).toFixed(0)
  const cls = handClass(hero[0], hero[1])
  return {
    kind: 'open',
    hero,
    position: pos,
    prompt: `${POSITION_NAMES_RU[pos]}. До вас все сбросили. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: null, raise: 'Рейз до 2.5bb' },
    correctAction: inRange ? 'raise' : 'fold',
    explanation: inRange
      ? `${cls} входит в диапазон открытия с ${pos} (≈${pct}% рук) — открывайте рейзом 2–3bb.`
      : `${cls} не входит в диапазон открытия с ${pos} (≈${pct}% рук) — сбрасывайте и ждите лучшей руки.`,
    detail: [
      `Диапазон открытия с ${pos} включает ≈${pct}% всех стартовых рук.`,
      'Открытие из ранней позиции требует самых сильных рук: после вас действует много игроков.',
    ],
    pot: 1.5,
    bet: 0,
    stack: 100,
  }
}

/** Префлоп: против рейза — чарт зависит и от позиции защитника, и от позиции рейзера; оценка по смешанным частотам GTO */
export function genVsRaiseScenario(): SimScenarioBase {
  const order: Position[] = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']
  const heroIdx = 1 + ri(5) // MP..BB
  const villainIdx = ri(Math.min(heroIdx, 4)) // рейзер — UTG..BTN, всегда раньше героя
  const villainPos = order[villainIdx]
  const heroPos = order[heroIdx]
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const chart = vsRaiseCharts(heroPos, villainPos, 6)
  const cls = handClass(hero[0], hero[1])
  const freqs = holdemActionFrequencies(heroPos, villainPos, 6)
  const f = freqs?.get(cls) ?? null
  const isThreeBet = chart ? chart.threeBet.has(cls) : false
  const isCall = chart ? !isThreeBet && chart.call.has(cls) : false
  const openSize = 2.5
  // основное действие — с наибольшей частотой; второе с частотой ≥ 25% тоже засчитывается
  let correctAction: SimAction
  let altAction: SimAction | undefined
  let altFreq: number | undefined
  if (f) {
    correctAction = dominantAction(f)
    const sec = secondaryAction(f, 25)
    if (sec) {
      altAction = sec.action
      altFreq = sec.freq
    }
  } else {
    correctAction = isThreeBet ? 'raise' : isCall ? 'call' : 'fold'
  }
  const raiseLabel = correctAction === 'raise'
    ? `3бет до ${openSize * 3}bb`
    : 'Рейз (3бет)'
  const mixNote = altAction !== undefined
    ? ` Смешанная стратегия: допустимо и «${SIM_ALT_LABEL[altAction]}» (~${altFreq}%).`
    : ''
  return {
    kind: 'vsRaise',
    hero,
    position: heroPos,
    prompt: `${villainPos} открывается рейзом до ${openSize}bb. Вы на ${heroPos}. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: `Колл ${openSize}bb`, raise: raiseLabel },
    correctAction,
    altAction,
    altFreq,
    explanation: correctAction === 'raise'
      ? `${cls} — премиум/микс-рука: чаще 3бет для вэлью и инициативы.${mixNote}`
      : correctAction === 'call'
        ? `${cls} — играбельная рука: колл против открытия с ${villainPos} (${heroPos === 'SB' || heroPos === 'BB' ? 'без позиции' : 'в позиции'}).${mixNote}`
        : `${cls} — слабее диапазона защиты ${heroPos} против открытия с ${villainPos}: сбрасывайте.`,
    detail: [
      f
        ? `Частоты GTO для ${cls}: ${freqLabel(f)}.`
        : chart
          ? `Защита ${heroPos} против ${villainPos}: 3бет ≈ топ ${chart.threeBetPct.toFixed(0)}%, колл ≈ топ ${chart.callPct.toFixed(0)}% рук.`
          : 'Чарт защиты недоступен для этой пары позиций.',
      freqs
        ? `Соотношение действий всего диапазона: 3бет ${freqAggregate(freqs).raise.toFixed(0)}% / колл ${freqAggregate(freqs).call.toFixed(0)}% / фолд ${freqAggregate(freqs).fold.toFixed(0)}%.`
        : 'Соотношение действий недоступно.',
      `Ширина защиты зависит от позиции рейзера: против поздних открытий (CO/BTN) коллы заметно шире, чем против UTG/MP.`,
      'Пограничные руки играются смешанно: у солвера часть комбинаций делает одно действие, часть — другое.',
    ],
    pot: 1.5 + openSize,
    bet: openSize,
    stack: 100,
  }
}

/** Постфлоп: решение против ставки по эквити и пот-оддсам */
export function genPostflopScenario(): SimScenarioBase {
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const boardN = Math.random() < 0.7 ? 3 : 4
  const board = deck.slice(2, 2 + boardN)
  const villainRange = topPercentClasses(30)
  const combos = classesToCombos(villainRange)

  const pot = pick([20, 30, 40, 60, 80])
  const betMult = pick([0.5, 0.75, 1])
  const bet = Math.round(pot * betMult)

  const sim = simulateEquity({
    hero,
    board,
    opponents: 1,
    iterations: 1200,
    villainFilter: (h) => {
      const c1 = handClass(h[0], h[1])
      return villainRange.has(c1)
    },
  })
  void combos
  const equity = sim.win + sim.tie / 2
  const required = bet / (pot + 2 * bet)
  const equityPct = Math.round(equity * 1000) / 10
  const requiredPct = Math.round(required * 1000) / 10

  let correctAction: SimAction
  if (equity >= required + 0.12) correctAction = 'raise'
  else if (equity >= required + 0.01) correctAction = 'call'
  else correctAction = 'fold'

  const streetLabel = boardN === 3 ? 'Флоп' : 'Терн'
  const street = boardN === 3 ? 'флоп' : 'терн'
  const betDesc = betMult === 0.5 ? 'половину банка' : betMult === 0.75 ? '3/4 банка' : 'размер банка'

  const explanation =
    correctAction === 'raise'
      ? `Эквити ${equityPct}% против диапазона оппонента (топ-30% рук) сильно выше требуемых ${requiredPct}% — рейз/ставка для вэлью.`
      : correctAction === 'call'
        ? `Эквити ${equityPct}% выше требуемых ${requiredPct}% — колл прибылен (плюс-ев).`
        : `Эквити ${equityPct}% ниже требуемых ${requiredPct}% — колл теряет деньги, фолд.`

  return {
    kind: 'postflop',
    hero,
    board,
    position: 'BB',
    prompt: `${streetLabel}. Оппонент ставит ${bet} bb (${betDesc}) в банк ${pot} bb. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: `Колл ${bet} bb`, raise: `Рейз до ${bet * 2.5} bb` },
    correctAction,
    explanation,
    detail: [
      `Требуемое эквити = ${bet} / (${pot} + ${bet} + ${bet}) = ${requiredPct}%.`,
      `Симуляция: 1200 раздач против случайной руки из диапазона топ-30%.`,
      `Победа ${Math.round(sim.win * 100)}%, ничья ${Math.round(sim.tie * 100)}%.`,
    ],
    pot,
    bet,
    stack: 100,
  }
}

export function genSimScenario(): SimScenarioBase {
  const r = Math.random()
  if (r < 0.3) return genOpenScenario()
  if (r < 0.55) return genVsRaiseScenario()
  return genPostflopScenario()
}

export function cardListText(cards: Card[]): string {
  return cards.map(cardToString).join(' ')
}

/** Позиция героя в постфлоп-сценарии — озвучим как BB vs оппонент */
export const POSITION_RU = POSITION_NAMES_RU
