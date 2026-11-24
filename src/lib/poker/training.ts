// Генераторы тренировочных вопросов для всех тренажёров.
import {
  Card, fullDeck, shuffle, cardToString, SUIT_SYMBOLS, RANK_NAMES_RU, parseCard,
} from './cards'
import { evaluate7, handName, handCategoryName } from './evaluator'
import { simulateEquity, countOuts } from './equity'
import {
  Position, openRangeClasses, vsRaiseClasses, handClass, handInSet,
  rangePercent, topPercentClasses, POSITION_NAMES_RU, classesToCombos,
} from './ranges'

const rand = () => Math.random
const ri = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: T[]): T => arr[ri(arr.length)]

function shuffledDeck(): Card[] {
  return shuffle(fullDeck(), rand)
}

// ============ 1. МАТЕМАТИКА: ПОТ-ОДДСЫ ============

export interface MathQuestion {
  pot: number
  bet: number
  requiredPct: number
  ratioText: string
  prompt: string
  hint: string
}

const POT_ODDS_BETS = [
  { label: 'половину банка', mult: 0.5 },
  { label: '2/3 банка', mult: 2 / 3 },
  { label: '3/4 банка', mult: 0.75 },
  { label: 'размер банка', mult: 1 },
  { label: 'двойной овербет', mult: 2 },
]

export function genMathQuestion(): MathQuestion {
  const pot = pick([40, 60, 80, 100, 120, 160, 200])
  const b = pick(POT_ODDS_BETS)
  const bet = Math.round((pot * b.mult) / 10) * 10
  const required = (bet / (pot + 2 * bet)) * 100
  const ratio = (pot + bet) / bet
  const ratioText = `${fmtRatio(ratio)}:1`
  const prompt =
    `Банк — ${pot} bb. Оппонент ставит ${bet} bb (${b.label}). ` +
    `Сколько процентов эквити нужно для прибыльного колла?`
  return {
    pot,
    bet,
    requiredPct: Math.round(required * 10) / 10,
    ratioText,
    prompt,
    hint: `Формула: ставка / (банк + ставка + ваш колл) = ${bet} / (${pot} + ${bet} + ${bet})`,
  }
}

export function genRatioQuestion(): MathQuestion {
  const ratioNum = pick([0.5, 1, 1.5, 2, 2.5, 3, 4])
  const required = (1 / (ratioNum + 1)) * 100
  return {
    pot: 0,
    bet: 0,
    requiredPct: Math.round(required * 10) / 10,
    ratioText: `${fmtRatio(ratioNum)}:1`,
    prompt: `Шансы банка составляют ${fmtRatio(ratioNum)}:1. Какой процент эквити нужен для колла?`,
    hint: `Формула: 1 / (a + 1) × 100%, где a — шансы банка.`,
  }
}

function fmtRatio(x: number): string {
  return x === Math.round(x) ? String(Math.round(x)) : String(Math.round(x * 10) / 10)
}

export function checkMathAnswer(q: MathQuestion, answer: number): boolean {
  return Math.abs(answer - q.requiredPct) <= 1.5
}

// ============ 2. АУТСЫ ============

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
}

/** Генерация «классических» сценариев аутсов: флеш-дро (9), двусторонний стрит-дро (8), гатшот (4).
 *  Рука оппонента подобрана так, что точный подсчёт совпадает с классическим. */
export function genOutsQuestion(): OutsQuestion {
  const type = pick(['flush', 'oesd', 'gutshot'] as const)

  if (type === 'flush') {
    // Герой: Qs Js; доска: Ks 7s 2d; оппонент: пара тузов (Ac Ad).
    // Аутсы = ровно 9 пик (флеш бьёт пару тузов/две пары), пары Q,J бьются о пару A.
    const hero = [parse('Qs'), parse('Js')]
    const board = [parse('Ks'), parse('7s'), parse('2d')]
    const villain = [parse('Ac'), parse('Ad')]
    return buildOuts(hero, villain, board, 'flop')
  }
  if (type === 'oesd') {
    // Герой: Jh Th; доска: 8c 9d 2s; оппонент: сет девяток (9h 9s).
    // Аутсы = ровно 8: четыре дамы + четыре семёрки (стрит бьёт сет), пары J,T бьются о сет.
    const hero = [parse('Jh'), parse('Th')]
    const board = [parse('8c'), parse('9d'), parse('2s')]
    const villain = [parse('9h'), parse('9s')]
    return buildOuts(hero, villain, board, 'flop')
  }
  // gutshot
  // Герой: 8h 7h; доска: Td Jc 2s; оппонент: пара дам (Qd Qc).
  // Аутсы = ровно 4 девятки (стрит 7-8-9-T-J), пары 8,7 бьются о пару Q.
  const hero = [parse('8h'), parse('7h')]
  const board = [parse('Td'), parse('Jc'), parse('2s')]
  const villain = [parse('Qd'), parse('Qc')]
  return buildOuts(hero, villain, board, 'flop')
}

function parse(code: string): Card {
  const c = parseCard(code)
  if (!c) throw new Error('bad card ' + code)
  return c
}

function buildOuts(hero: Card[], villain: Card[], board: Card[], street: 'flop' | 'turn'): OutsQuestion {
  const { outs, heroAheadNow } = countOuts(hero, villain, board)
  const heroRes = evaluate7([...hero, ...board])
  const vilRes = evaluate7([...villain, ...board])
  return {
    hero,
    villain,
    board,
    outs,
    outsCount: outs.length,
    street,
    heroHandName: handName(heroRes),
    villainHandName: handName(vilRes),
    heroAheadNow,
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

// ============ 3. EV ТРЕНАЖЁР ============

export interface EvQuestion {
  pot: number
  bet: number
  equityPct: number
  evCall: number
  correctAction: 'call' | 'fold'
}

export function genEvQuestion(): EvQuestion {
  const pot = pick([60, 80, 100, 120, 160, 200, 240])
  const betMult = pick([0.5, 0.75, 1])
  const bet = Math.round((pot * betMult) / 5) * 5
  const required = bet / (pot + 2 * bet)
  // генерируем эквити рядом с порогом, чтобы решение было нетривиальным
  const delta = (Math.random() * 0.22 - 0.11)
  const equity = Math.min(0.95, Math.max(0.05, required + delta))
  const equityPct = Math.round(equity * 1000) / 10
  const eq = equityPct / 100
  const evCall = eq * (pot + bet) - (1 - eq) * bet
  return {
    pot,
    bet,
    equityPct,
    evCall: Math.round(evCall * 10) / 10,
    correctAction: evCall > 0 ? 'call' : 'fold',
  }
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
  explanation: string
  detail: string[]
  pot: number
  bet: number
  stack: number
}

/** Префлоп: открытие из позиции */
export function genOpenScenario(): SimScenarioBase {
  const pos = pick<Position>(['UTG', 'MP', 'CO', 'BTN', 'SB'])
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const range = openRangeClasses(pos)
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

/** Префлоп: против рейза */
export function genVsRaiseScenario(): SimScenarioBase {
  const villainPos = pick<Position>(['UTG', 'MP', 'CO', 'BTN'])
  const heroPos = pick<Position>(['MP', 'CO', 'BTN', 'SB', 'BB'])
  const deck = shuffledDeck()
  const hero = [deck[0], deck[1]]
  const { threeBet, call } = vsRaiseClasses(heroPos)
  const cls = handClass(hero[0], hero[1])
  const isThreeBet = threeBet.has(cls)
  const isCall = !isThreeBet && call.has(cls)
  const openSize = 2.5
  const correctAction: SimAction = isThreeBet ? 'raise' : isCall ? 'call' : 'fold'
  const raiseLabel = isThreeBet
    ? `3бет до ${openSize * 3}bb`
    : 'Рейз (3бет)'
  return {
    kind: 'vsRaise',
    hero,
    position: heroPos,
    prompt: `${villainPos} открывается рейзом до ${openSize}bb. Вы на ${heroPos}. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: `Колл ${openSize}bb`, raise: raiseLabel },
    correctAction,
    explanation: isThreeBet
      ? `${cls} — премиум-рука: делайте 3бет для вэлью и инициативы.`
      : isCall
        ? `${cls} — играбельная рука: колл в позиции (спекулятивный потенциал).`
        : `${cls} — слабее диапазона защиты против рейза: сбрасывайте.`,
    detail: [
      'Против рейза защищайте руки с эквити и играбельностью (пары, одномастные, бродвеи).',
      'Премиум-руки 3бетят, спекулятивные — коллируют, мусор — фолд.',
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
