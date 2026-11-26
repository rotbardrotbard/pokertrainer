// GTO-чарты: что играть и что сбрасывать в зависимости от стола, позиции,
// количества соперников и раунда. Упрощённые ориентиры для обучения.
//
// Префлоп: отдельные чарты под каждый размер стола 2–9-max и позиционные
// чарты защиты против рейза (ширина защиты зависит от позиции рейзера).
// Постфлоп: план с размерами ставок, смешанными частотами, учётом текстуры
// доски и границами колл/фолд против конкретных размеров ставок.
import { openRangeClassesFor, vsRaiseCharts, DEFAULT_RAISER, openPercentFor, SIZE_DEF_FACTOR, rangePercent, holdemActionFrequencies, freqAggregate, mixExamples, freqLabel } from './ranges'
import type { Position, ActionFreq } from './ranges'
import { omahaRangeThreshold, omahaHandPercentile, handInRange, HOLE_COUNT } from './handRanges'
import type { GameKind } from './handRanges'
import type { Card } from './cards'

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export const STREET_NAMES_RU: Record<Street, string> = {
  preflop: 'Префлоп',
  flop: 'Флоп',
  turn: 'Терн',
  river: 'Ривер',
}

// ---------- Стол и позиции ----------

/** Позиции за столом на N игроков (порядок действия на префлопе). */
export function seatsForTable(players: number): string[] {
  if (players === 2) return ['BTN', 'BB'] // хедз-ап: BTN — он же SB
  const early = players - 3
  const seats: string[] = []
  const earlyNames: Record<number, string[]> = {
    1: ['CO'],
    2: ['MP', 'CO'],
    3: ['UTG', 'MP', 'CO'],
    4: ['UTG', 'MP', 'MP2', 'CO'],
    5: ['UTG', 'MP', 'MP2', 'HJ', 'CO'],
    6: ['UTG', 'UTG1', 'MP', 'MP2', 'HJ', 'CO'],
  }
  seats.push(...(earlyNames[early] ?? []))
  seats.push('BTN', 'SB', 'BB')
  return seats
}

/** Базовая позиция для чартов (MP2/HJ → MP и т.п.). */
export function basePos(seat: string): Position {
  if (seat.startsWith('UTG')) return 'UTG'
  if (seat.startsWith('MP') || seat === 'HJ') return 'MP'
  if (seat === 'CO') return 'CO'
  if (seat.startsWith('BTN')) return 'BTN'
  if (seat.startsWith('SB')) return 'SB'
  return 'BB'
}

export const SEAT_NAMES_RU: Record<string, string> = {
  UTG: 'UTG — под пушкой',
  UTG1: 'UTG1',
  MP: 'MP — средняя',
  MP2: 'MP2',
  HJ: 'HJ — хайджек',
  CO: 'CO — кат-офф',
  BTN: 'BTN — баттон',
  SB: 'SB — малый блайнд',
  BB: 'BB — большой блайнд',
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// ---------- Префлоп: Холдем ----------

export interface HoldemPreflop {
  raise: Set<string> // открытие: рейз; vs рейза: 3бет
  call: Set<string> // vs рейза: колл (пусто для открытия)
  raisePct: number
  callPct: number
  mode: 'open' | 'vsraise'
  freq: Map<string, ActionFreq> // смешанные частоты действий по классам (пусто для открытия)
}

/**
 * Чарт префлопа для позиции, размера стола и ситуации.
 * В ситуации «против рейза» ширина защиты зависит от позиции рейзера:
 * BB против BTN/SB защищается в 1,5–2 раза шире, чем против UTG.
 * Дополнительно возвращает смешанные частоты действий (как в GTO-солвере).
 */
export function holdemPreflop(pos: Position, players: number, situation: 'open' | 'vsraise', callers: number, raiser?: Position): HoldemPreflop {
  if (situation === 'open') {
    const set = openRangeClassesFor(pos, players)
    return { raise: set, call: new Set(), raisePct: rangePercent(set), callPct: 0, mode: 'open', freq: new Map() }
  }
  const rp = raiser && raiser !== pos ? raiser : DEFAULT_RAISER[pos] ?? 'CO'
  const multiFactor = Math.max(0.45, 1 - 0.1 * callers)
  const chart = vsRaiseCharts(pos, rp, players, multiFactor)
  if (!chart) {
    return { raise: new Set(), call: new Set(), raisePct: 0, callPct: 0, mode: 'vsraise', freq: new Map() }
  }
  return {
    raise: chart.threeBet,
    call: chart.call,
    raisePct: chart.threeBetPct,
    callPct: chart.callPct,
    mode: 'vsraise',
    freq: holdemActionFrequencies(pos, rp, players, multiFactor) ?? new Map(),
  }
}

export function holdemAction(cls: string, chart: HoldemPreflop): 'raise' | 'call' | 'fold' {
  if (chart.raise.has(cls)) return 'raise'
  if (chart.call.has(cls)) return 'call'
  return 'fold'
}

// ---------- Префлоп: Омаха ----------

/** Отдельные чарты открытия для каждого размера стола (% стартовых рук). */
const PLO_OPEN_SIZE: Record<'omaha4' | 'omaha5', Record<number, Record<Position, number>>> = {
  omaha4: {
    2: { UTG: 28, MP: 36, CO: 48, BTN: 65, SB: 56, BB: 44 },
    3: { UTG: 24, MP: 33, CO: 44, BTN: 60, SB: 52, BB: 40 },
    4: { UTG: 22, MP: 30, CO: 40, BTN: 55, SB: 47, BB: 36 },
    5: { UTG: 20, MP: 27, CO: 36, BTN: 50, SB: 43, BB: 33 },
    6: { UTG: 18, MP: 25, CO: 33, BTN: 46, SB: 40, BB: 30 },
    7: { UTG: 14, MP: 19, CO: 27, BTN: 38, SB: 32, BB: 24 },
    8: { UTG: 13, MP: 17, CO: 24, BTN: 35, SB: 30, BB: 22 },
    9: { UTG: 12, MP: 16, CO: 22, BTN: 32, SB: 27, BB: 20 },
  },
  omaha5: {
    2: { UTG: 36, MP: 45, CO: 56, BTN: 72, SB: 63, BB: 52 },
    3: { UTG: 32, MP: 41, CO: 52, BTN: 67, SB: 58, BB: 48 },
    4: { UTG: 30, MP: 38, CO: 48, BTN: 62, SB: 54, BB: 44 },
    5: { UTG: 28, MP: 35, CO: 44, BTN: 58, SB: 50, BB: 41 },
    6: { UTG: 26, MP: 33, CO: 42, BTN: 55, SB: 48, BB: 38 },
    7: { UTG: 23, MP: 29, CO: 36, BTN: 50, SB: 43, BB: 34 },
    8: { UTG: 22, MP: 27, CO: 34, BTN: 47, SB: 40, BB: 32 },
    9: { UTG: 20, MP: 25, CO: 32, BTN: 44, SB: 38, BB: 30 },
  },
}

/** Базовые ширины защиты против рейза по позиции защитника. */
const PLO_VSRAISE_POS: Record<'omaha4' | 'omaha5', Record<Position, { threeBet: number; call: number }>> = {
  omaha4: {
    UTG: { threeBet: 4, call: 12 },
    MP: { threeBet: 5, call: 14 },
    CO: { threeBet: 6, call: 16 },
    BTN: { threeBet: 8, call: 20 },
    SB: { threeBet: 10, call: 12 },
    BB: { threeBet: 7, call: 28 },
  },
  omaha5: {
    UTG: { threeBet: 6, call: 18 },
    MP: { threeBet: 8, call: 20 },
    CO: { threeBet: 9, call: 23 },
    BTN: { threeBet: 11, call: 27 },
    SB: { threeBet: 13, call: 16 },
    BB: { threeBet: 9, call: 36 },
  },
}

/** Множитель ширины защиты от позиции рейзера: против поздних открытий защищаются шире. */
const RAISER_FACTOR: Record<Position, number> = { UTG: 0.8, MP: 0.9, CO: 1.0, BTN: 1.25, SB: 1.35, BB: 1.0 }

export interface OmahaPreflop {
  mode: 'open' | 'vsraise'
  openPercent: number // для открытия: ширина диапазона рейза
  threeBetPercent: number // для vs-рейза
  callPercent: number
  openThreshold: number
  threeBetThreshold: number
  callThreshold: number
}

export function omahaPreflop(game: 'omaha4' | 'omaha5', pos: Position, players: number, situation: 'open' | 'vsraise', callers: number, raiser?: Position): OmahaPreflop {
  const sizeFactor = SIZE_DEF_FACTOR[players] ?? 1
  if (situation === 'open') {
    const percent = clamp(PLO_OPEN_SIZE[game][players]?.[pos] ?? PLO_OPEN_SIZE[game][6][pos], 5, 90)
    return {
      mode: 'open',
      openPercent: percent,
      threeBetPercent: 0,
      callPercent: 0,
      openThreshold: omahaRangeThreshold(game, percent),
      threeBetThreshold: 0,
      callThreshold: 0,
    }
  }
  const rp = raiser && raiser !== pos ? raiser : DEFAULT_RAISER[pos] ?? 'CO'
  const rf = RAISER_FACTOR[rp]
  const multiFactor = Math.max(0.45, 1 - 0.1 * callers)
  const bbBonus = pos === 'BB' ? 1.5 : 1
  const base = PLO_VSRAISE_POS[game][pos]
  const threeBetPercent = clamp(base.threeBet * (1 + (rf - 1) / 2) * sizeFactor, 3, 18)
  const callPercent = clamp(base.call * rf * sizeFactor * multiFactor * bbBonus, 5, 62)
  return {
    mode: 'vsraise',
    openPercent: 0,
    threeBetPercent,
    callPercent,
    openThreshold: 0,
    threeBetThreshold: omahaRangeThreshold(game, threeBetPercent),
    callThreshold: omahaRangeThreshold(game, callPercent),
  }
}

export function omahaAction(game: 'omaha4' | 'omaha5', hand: Card[], chart: OmahaPreflop, situation: 'open' | 'vsraise'): 'raise' | 'call' | 'fold' {
  if (situation === 'open') {
    return handInRange(game, hand, chart.openPercent) ? 'raise' : 'fold'
  }
  if (handInRange(game, hand, chart.threeBetPercent)) return 'raise'
  if (handInRange(game, hand, chart.callPercent)) return 'call'
  return 'fold'
}

// ---------- Префлоп: Омаха, частотные смеси ----------

/** Полуширина зоны смешения у границ диапазона, % стартовых рук. */
const OMAHA_MIX_BAND = 3

/**
 * Плавное смешение у границы «топ N%»: 100% внутри, линейный спад до 0 в зоне ±band.
 * Возвращает частоту первого действия (рейз или колл) у соответствующей границы.
 */
function omahaBlend(boundary: number, p: number): number {
  if (p <= boundary - OMAHA_MIX_BAND) return 100
  if (p >= boundary + OMAHA_MIX_BAND) return 0
  const t = (boundary + OMAHA_MIX_BAND - p) / (2 * OMAHA_MIX_BAND)
  return Math.round(100 * t)
}

/**
 * Частоты действий для конкретной руки Омахи (как в GTO-солвере):
 * у границы 3бета частота плавно переходит от рейза к коллу, у границы колла — от колла к фолду.
 * p — место руки («топ X%»): чем меньше, тем сильнее рука.
 */
export function omahaActionFreqs(game: 'omaha4' | 'omaha5', hand: Card[], chart: OmahaPreflop, situation: 'open' | 'vsraise'): ActionFreq {
  const p = omahaHandPercentile(game, hand)
  if (situation === 'open') {
    const raise = omahaBlend(chart.openPercent, p)
    return { raise, call: 0, fold: 100 - raise }
  }
  const raise = omahaBlend(chart.threeBetPercent, p)
  const rest = 100 - raise
  const callShare = omahaBlend(chart.callPercent, p) // 100 внутри колл-зоны, 0 за её пределами
  const call = Math.round((rest * callShare) / 100)
  return { raise, call, fold: 100 - raise - call }
}

// ---------- Постфлоп: текстура доски ----------

export interface BoardTexture {
  label: string
  note: string
  paired: boolean
  trips: boolean
  monotone: boolean
  twoTone: boolean
  rainbow: boolean
  connected: boolean
  straightPossible: boolean
  high: boolean
  empty: boolean
}

/** Анализ текстуры доски: масть, спаренность, связанность, высота. */
export function analyzeBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3) {
    return {
      label: 'Текстура не задана', note: 'Выберите предустановку доски, чтобы учесть текстуру.',
      paired: false, trips: false, monotone: false, twoTone: false, rainbow: true,
      connected: false, straightPossible: false, high: false, empty: true,
    }
  }
  const rankCnt = new Map<number, number>()
  const suitCnt = [0, 0, 0, 0]
  for (const c of board) {
    rankCnt.set(c.r, (rankCnt.get(c.r) || 0) + 1)
    suitCnt[c.s]++
  }
  const counts = [...rankCnt.values()]
  const paired = counts.some((v) => v >= 2)
  const trips = counts.some((v) => v >= 3)
  const monotone = board.every((c) => c.s === board[0].s)
  const distinctSuits = suitCnt.filter((n) => n > 0).length
  const twoTone = !monotone && distinctSuits === 2
  const rainbow = !monotone && !twoTone
  const distinct = [...rankCnt.keys()].sort((a, b) => a - b)
  const extended = [...distinct]
  if (rankCnt.has(14)) extended.push(1)
  const seq = [...new Set(extended)].sort((a, b) => a - b)
  let straightPossible = false
  for (let i = 0; i + 2 < seq.length; i++) {
    if (seq[i + 2] - seq[i] === 2) straightPossible = true
  }
  const span = distinct[distinct.length - 1] - distinct[0]
  const connected = distinct.length >= 3 && span <= 5 && !paired
  const high = Math.max(...distinct) >= 12

  const parts: string[] = []
  if (monotone) parts.push('моно-масть')
  else if (twoTone) parts.push('двухмастная')
  else parts.push('радуга')
  if (paired) parts.push(trips ? 'спаренная' : 'спаренная')
  if (straightPossible) parts.push('стрит-возможен')
  const label = parts.join(' · ')

  const notes: string[] = []
  if (monotone) notes.push('одна масть на доске: блефам нечего усиливать, играют только натс-флеши и руки с тузом масти')
  else if (twoTone) notes.push('масть на доске: флеш-дро живы, полу-блефы сохраняют эквити')
  else notes.push('без масти: блефы работают лучше, слабые готовые руки коллируют реже')
  if (paired) notes.push('пара на доске: у оппонентов меньше комбинаций, ставки можно делать дешевле')
  if (straightPossible) notes.push('доска связана: сильные руки защищают банк от стрит-дро')
  if (!straightPossible && !paired && rainbow) notes.push('сухая доска: чаще блеф и мелкие банки, границы коллов ниже')

  return {
    label,
    note: notes.join('; '),
    paired, trips, monotone, twoTone, rainbow, connected, straightPossible, high, empty: false,
  }
}

// ---------- Постфлоп: план по тирам силы ----------

export type TierAction = 'bet' | 'call' | 'fold'
export type PlanAction = 'bet' | 'check' | 'call' | 'fold' | 'raise'

export interface MixItem {
  action: PlanAction
  freq: number // 0..100
  label: string
}

export interface FacingVerdict {
  verdict: 'call' | 'fold' | 'raise' | 'mix'
  note: string
}

export interface TierPlan {
  tier: string
  examples: string
  action: TierAction
  line: string // текст нашей линии на инициативе
  mix: MixItem[] // смешанные частоты
  sizeNote: string
  vsBetNote: string
  verdict: FacingVerdict | null // против выбранного размера ставки (null — ставка не выбрана)
  textureNote: string
}

export interface PostflopPlan {
  intro: string
  gameNote: string
  positionNote: string
  multiwayNote: string
  textureLabel: string
  textureNote: string
  facingLabel: string | null
  tiers: TierPlan[]
}

/** Устаревший плоский вид тира — для связи симулятора с GTO-разделом. */
export interface PostflopTier {
  tier: string
  examples: string
  aggressive: string
  facingBet: string
  action: TierAction
}

interface PlanTierBase {
  tier: string
  examples: string
  action: TierAction
  betFreq: number // доля ставок на инициативе, %
  size: number // базовый размер ставки, % банка
  callUpTo: number // колл против ставки до X% банка
  foldAbove: number // фолд против ставки выше Y% банка (999 — не фолдим никогда)
  bluffTier?: boolean // тир содержит полу-блефы/воздух
  aggrText: string
  faceText: string
}

// --- Холдем: флоп ---
const HOLDEM_FLOP: PlanTierBase[] = [
  {
    tier: 'Сет и сильнее',
    examples: 'сеты, две пары, готовые стрит и флеш',
    action: 'bet',
    betFreq: 90, size: 66, callUpTo: 200, foldAbove: 999,
    aggrText: 'Бет и рейз почти всегда: набирайте банк и защищайте руку',
    faceText: 'Рейз для вэлью; с абсолютными натсами изредка колл (slowplay)',
  },
  {
    tier: 'Сильные дро',
    examples: 'флеш-дро, двусторонний стрит-дро (8+ аутсов)',
    action: 'call',
    betFreq: 60, size: 50, callUpTo: 60, foldAbove: 110, bluffTier: true,
    aggrText: 'Полу-блеф бет: фолд-эквити плюс потенциал улучшения',
    faceText: 'Колл по пот-оддсам; в позиции можно колл с агрессивным планом',
  },
  {
    tier: 'Топ-пара и оверпары',
    examples: 'топ-пара с хорошим кикером, пары выше доски',
    action: 'call',
    betFreq: 75, size: 50, callUpTo: 66, foldAbove: 130,
    aggrText: 'Бет для вэлью; против 1 оппонента — тонкий вэлью-бет',
    faceText: 'Колл против 1–2 оппонентов; крейзу без кикера предпочитайте фолд',
  },
  {
    tier: 'Средние руки',
    examples: 'вторая/третья пара, гатшот, бэкдор-дро',
    action: 'call',
    betFreq: 25, size: 33, callUpTo: 33, foldAbove: 55,
    aggrText: 'Чек-колл против малых ставок, чек-фолд против больших',
    faceText: 'Дешёвый колл только против 1 оппонента; в мультпотах — фолд',
  },
  {
    tier: 'Воздух',
    examples: 'нет пары и дро',
    action: 'fold',
    betFreq: 20, size: 50, callUpTo: 25, foldAbove: 35, bluffTier: true,
    aggrText: 'Чек-фолд; изредка блеф в позиции против 1 оппонента',
    faceText: 'Фолд',
  },
]

// --- Холдем: терн ---
const HOLDEM_TURN: PlanTierBase[] = [
  {
    tier: 'Натсы и сильные готовые',
    examples: 'сеты, две пары, стрит, флеш',
    action: 'bet',
    betFreq: 85, size: 66, callUpTo: 200, foldAbove: 999,
    aggrText: 'Бет крупно: на терне банк растёт быстрее всего',
    faceText: 'Колл или рейз; пассивность с натсами теряет вэлью',
  },
  {
    tier: 'Дро и комбо-дро',
    examples: 'флеш-дро, стрит-дро, их сочетания',
    action: 'call',
    betFreq: 55, size: 50, callUpTo: 50, foldAbove: 80, bluffTier: true,
    aggrText: 'Бет-полу-блеф или колл по имплайд-оддсам',
    faceText: 'Колл, если пот-оддсы с учётом аутсов сходятся; иначе фолд',
  },
  {
    tier: 'Средние готовые',
    examples: 'топ-пара слабый кикер, вторая пара',
    action: 'call',
    betFreq: 40, size: 33, callUpTo: 40, foldAbove: 66,
    aggrText: 'Чек-колл одной ставки; против повторной агрессии — фолд',
    faceText: 'Колл одной ставки; в мультпотах чаще фолд',
  },
  {
    tier: 'Слабые руки',
    examples: 'третья пара и ниже, погибшие дро',
    action: 'fold',
    betFreq: 10, size: 33, callUpTo: 20, foldAbove: 35, bluffTier: true,
    aggrText: 'Чек-фолд',
    faceText: 'Фолд; крупный рейз-блеф только против 1 оппонента',
  },
]

// --- Холдем: ривер ---
const HOLDEM_RIVER: PlanTierBase[] = [
  {
    tier: 'Натсы',
    examples: 'стрит и сильнее, топ-пары с сильным кикером',
    action: 'bet',
    betFreq: 85, size: 75, callUpTo: 200, foldAbove: 999,
    aggrText: 'Бет для вэлью максимального размера',
    faceText: 'Рейз или колл — зависимость от линии оппонента',
  },
  {
    tier: 'Готовые руки средней силы',
    examples: 'средние пары, две слабые пары',
    action: 'call',
    betFreq: 35, size: 33, callUpTo: 33, foldAbove: 66,
    aggrText: 'Чек для контроля банка или тонкий вэлью-бет против 1',
    faceText: 'Колл против 1 оппонента; в мультпотах — фолд',
  },
  {
    tier: 'Блеф-кетчеры',
    examples: 'вторые пары, низкие пары',
    action: 'fold',
    betFreq: 5, size: 33, callUpTo: 25, foldAbove: 50,
    aggrText: 'Чек-фолд к ставке; чек и надежда на чек-даун',
    faceText: 'Фолд против крупной ставки; колл только против пассивных оппонентов',
  },
  {
    tier: 'Воздух',
    examples: 'ничего не попало',
    action: 'fold',
    betFreq: 30, size: 66, callUpTo: 15, foldAbove: 25, bluffTier: true,
    aggrText: 'Против 1 оппонента — блеф-ставка в подходящей линии; иначе чек-фолд',
    faceText: 'Фолд',
  },
]

// --- Омаха: флоп ---
const OMAHA_FLOP: PlanTierBase[] = [
  {
    tier: 'Натсы и близкие к ним',
    examples: 'топ-сет с редро, натсовый стрит/флеш + дро',
    action: 'bet',
    betFreq: 90, size: 66, callUpTo: 250, foldAbove: 999,
    aggrText: 'Бет и рейз без ограничений — в Омахе нужны лучшие руки',
    faceText: 'Рейз для вэлью; защитите банк от дро',
  },
  {
    tier: 'Сильные дро и сильные готовые',
    examples: 'комбо-дро 20+ аутсов, сеты без редро, старшие дро',
    action: 'call',
    betFreq: 70, size: 50, callUpTo: 75, foldAbove: 130, bluffTier: true,
    aggrText: 'Бет: много эквити и фолд-эквити',
    faceText: 'Колл или рейз по имплайд-оддсам',
  },
  {
    tier: 'Средние готовые',
    examples: 'низкие сеты, вторые флеш-дро, средние стриты',
    action: 'call',
    betFreq: 30, size: 33, callUpTo: 40, foldAbove: 66,
    aggrText: 'Чек-колл; берегитесь доминирования более старших рук',
    faceText: 'Колл одной ставки в позиции; иначе осторожно',
  },
  {
    tier: 'Топ-пара и слабые руки',
    examples: 'топ-пара, низкие пары, гатшоты',
    action: 'fold',
    betFreq: 10, size: 33, callUpTo: 25, foldAbove: 40, bluffTier: true,
    aggrText: 'Чек-фолд: в Омахе топ-пара редко выигрывает банк',
    faceText: 'Фолд против ставки; колл только минимальный',
  },
]

// --- Омаха: терн ---
const OMAHA_TURN: PlanTierBase[] = [
  {
    tier: 'Натсы',
    examples: 'старший сет, натс-стрит, натс-флеш, их сочетания',
    action: 'bet',
    betFreq: 85, size: 75, callUpTo: 250, foldAbove: 999,
    aggrText: 'Бет крупно, рейз против агрессии',
    faceText: 'Рейз или колл — терн решает банк в Омахе',
  },
  {
    tier: 'Сильные дро',
    examples: 'комбо-дро, 16+ аутсов к натсам',
    action: 'call',
    betFreq: 65, size: 50, callUpTo: 66, foldAbove: 110, bluffTier: true,
    aggrText: 'Полу-блеф бет или колл по оддсам',
    faceText: 'Колл, если аутсы чистые и оддсы сходятся',
  },
  {
    tier: 'Вторые руки',
    examples: 'второй сет, второй флеш, средний стрит',
    action: 'call',
    betFreq: 25, size: 33, callUpTo: 33, foldAbove: 50,
    aggrText: 'Чек-колл одной ставки, не раздувайте банк',
    faceText: 'Колл одной ставки; против рейза — фолд',
  },
  {
    tier: 'Слабые и погибшие руки',
    examples: 'топ-пара, низкие дро, воздух',
    action: 'fold',
    betFreq: 8, size: 33, callUpTo: 15, foldAbove: 25, bluffTier: true,
    aggrText: 'Чек-фолд',
    faceText: 'Фолд',
  },
]

// --- Омаха: ривер ---
const OMAHA_RIVER: PlanTierBase[] = [
  {
    tier: 'Натсы',
    examples: 'натс-фулл, старший стрит/флеш, каре',
    action: 'bet',
    betFreq: 85, size: 90, callUpTo: 250, foldAbove: 999,
    aggrText: 'Бет максимального размера для вэлью',
    faceText: 'Колл или рейз',
  },
  {
    tier: 'Близкие к натсам',
    examples: 'второй натс, младшие фулл-хаусы',
    action: 'call',
    betFreq: 40, size: 50, callUpTo: 50, foldAbove: 100,
    aggrText: 'Чек-колл или тонкий вэлью-бет против 1',
    faceText: 'Колл против 1 оппонента; в мультпотах осторожно',
  },
  {
    tier: 'Вторые руки',
    examples: 'второй стрит, низкие фуллы, блеф-кетчеры',
    action: 'call',
    betFreq: 15, size: 33, callUpTo: 33, foldAbove: 50,
    aggrText: 'Чек-колл одной ставки; не иницируйте крупные банки',
    faceText: 'Колл против 1 пассивного оппонента; против агрессии — фолд',
  },
  {
    tier: 'Слабые руки и воздух',
    examples: 'пары ниже доски, ничто не попало',
    action: 'fold',
    betFreq: 8, size: 75, callUpTo: 15, foldAbove: 25, bluffTier: true,
    aggrText: 'Чек-фолд; блеф — только против 1 оппонента в подходящей линии',
    faceText: 'Фолд',
  },
]

const GUIDES: Record<string, PlanTierBase[]> = {
  'holdem:flop': HOLDEM_FLOP,
  'holdem:turn': HOLDEM_TURN,
  'holdem:river': HOLDEM_RIVER,
  'omaha4:flop': OMAHA_FLOP,
  'omaha4:turn': OMAHA_TURN,
  'omaha4:river': OMAHA_RIVER,
  'omaha5:flop': OMAHA_FLOP,
  'omaha5:turn': OMAHA_TURN,
  'omaha5:river': OMAHA_RIVER,
}

function positionNote(seat: string): string {
  const p = basePos(seat)
  if (p === 'BTN' || p === 'CO') return 'Вы в позиции на блайндах: можно играть шире, брать банки дешёвыми ставками и блефовать чаще.'
  if (p === 'SB' || p === 'BB') return 'Вы без позиции: играйте пассивнее и тайтовее, выбирайте руки, которые хорошо попадают в доску.'
  return 'Средняя позиция: умеренный стиль — вэлью с сильных рук, быстрые фолды маргинальных.'
}

export function multiwayNote(opponents: number): string {
  if (opponents >= 5) {
    return `Мультпот против ${opponents} оппонентов: играют только натсы. Блефы почти не работают, вторые руки и топ-пары проигрывают.`
  }
  if (opponents >= 3) {
    return `Против ${opponents} оппонентов: нужны руки с натс-потенциалом. Топ-пары и слабые дро теряют ценность, блефы работают хуже.`
  }
  if (opponents === 2) {
    return '2 оппонента: средние руки играбельны, но без позиции — осторожно; блефы умеренно эффективны.'
  }
  return 'Против одного оппонента можно блефовать, тонко вэльюбетить и играть шире.'
}

function tierTextureNote(t: PlanTierBase, texture: BoardTexture, opponents: number): string {
  if (texture.empty) return ''
  const parts: string[] = []
  if (texture.monotone) {
    parts.push(t.bluffTier
      ? 'на монотонной доске у блефов нет флеш-дро — блефуйте заметно реже'
      : 'на монотонной доске ставки мельче: рейзы может позволить только натс-флеш')
  }
  if (texture.twoTone && t.bluffTier) parts.push('у полу-блефов есть флеш-дро — бет или колл сохраняют эквити')
  if (texture.paired) parts.push('спаренная доска — ставки дешевле, границы коллов ниже')
  if (texture.straightPossible && !t.bluffTier) parts.push('связанная доска — размер ставки чуть больше для защиты от дро')
  if (texture.rainbow && !texture.paired && !texture.straightPossible && t.bluffTier) {
    parts.push(opponents <= 1 ? 'сухая доска — блеф с хорошим фолд-эквити' : 'сухая доска в мультпоте — блефы почти не работают')
  }
  if (texture.high && t.action === 'fold') parts.push('старшие карты на доске бьют вторые пары — не цепляйтесь')
  return parts.join('; ')
}

function planOneTier(t: PlanTierBase, texture: BoardTexture, opponents: number, facingPct: number | null): TierPlan {
  let betFreq = t.betFreq
  let size = t.size
  const isNut = t.foldAbove >= 999

  // текстура доски
  if (texture.monotone) {
    size = Math.min(size, 50)
    if (t.bluffTier) betFreq *= 0.6
    else if (!isNut) betFreq *= 0.85
  }
  if (texture.paired) size = Math.min(size, 40)
  if (texture.straightPossible && !t.bluffTier && !isNut) size = Math.min(90, size + 10)
  if (texture.rainbow && !texture.paired && !texture.straightPossible && t.bluffTier) betFreq = Math.min(80, betFreq * 1.3)

  // мультпот
  if (opponents >= 3) {
    if (isNut) betFreq = Math.max(betFreq, 85)
    if (t.bluffTier) betFreq *= 0.4
    size = Math.min(size, 66)
  }
  if (opponents >= 5 && t.bluffTier) betFreq = 0
  betFreq = Math.round(clamp(betFreq, 0, 95))
  size = Math.round(size)

  // смешанные частоты на инициативе
  const mix: MixItem[] = []
  if (betFreq <= 0) {
    mix.push({ action: 'check', freq: 100, label: 'чек 100%' })
  } else {
    mix.push({ action: 'bet', freq: betFreq, label: `бет ${size}% банка — ${betFreq}%` })
    if (betFreq < 100) mix.push({ action: 'check', freq: 100 - betFreq, label: `чек ${100 - betFreq}%` })
  }
  const line = betFreq >= 85
    ? `бет ${size}% банка (изредка чек)`
    : betFreq <= 0
      ? 'чек (блефы почти не работают)'
      : `микс: бет ${size}% банка в ${betFreq}% случаев / чек в ${100 - betFreq}%`

  const sizeParts: string[] = []
  if (texture.monotone) sizeParts.push('на монотонной доске не крупнее 50% банка')
  if (texture.paired) sizeParts.push('спаренная доска — размер поменьше')
  if (texture.straightPossible && !t.bluffTier && !isNut) sizeParts.push('связанная доска — размер побольше для защиты')
  const sizeNote = sizeParts.length > 0 ? `Размер: ${size}% банка (${sizeParts.join('; ')}).` : `Размер: ${size}% банка.`

  // границы колл/фолд против выбранного размера ставки
  const multiFactor = opponents >= 4 ? 0.7 : opponents === 3 ? 0.85 : 1
  const callUpTo = Math.round(t.callUpTo * multiFactor)
  let verdict: FacingVerdict | null = null
  if (facingPct != null) {
    if (isNut) {
      verdict = { verdict: 'raise', note: `${t.faceText} — рейз при любой ставке оппонента` }
    } else if (facingPct <= callUpTo && facingPct <= t.foldAbove) {
      verdict = { verdict: 'call', note: `колл: ставка ${facingPct}% банка в пределах границы ~${callUpTo}% сходится по оддсам` }
    } else if (facingPct > t.foldAbove) {
      verdict = { verdict: 'fold', note: `фолд: ставка ${facingPct}% банка выше границы ~${t.foldAbove > 900 ? 'любой' : `${t.foldAbove}%`} — не сходится` }
    } else {
      verdict = { verdict: 'mix', note: `пограничная ставка: микс колл/фолд${opponents >= 2 ? ', в мультпоте чаще фолд' : ''}` }
    }
  }
  const vsBetNote = `колл до ~${callUpTo}% банка${t.foldAbove < 999 ? `, против ~${t.foldAbove}%+ — фолд` : ', вместо фолда — рейз'}`

  return {
    tier: t.tier,
    examples: t.examples,
    action: t.action,
    line,
    mix,
    sizeNote,
    vsBetNote,
    verdict,
    textureNote: tierTextureNote(t, texture, opponents),
  }
}

/**
 * Постфлоп-план: тиры силы с размерами ставок, смешанными частотами,
 * учётом текстуры доски и границами колл/фолд против ставки заданного размера.
 */
export function postflopPlan(
  game: GameKind,
  street: Exclude<Street, 'preflop'>,
  board: Card[],
  opponents: number,
  seat: string,
  facingPct: number | null,
): PostflopPlan {
  const texture = analyzeBoardTexture(board)
  const tiers = GUIDES[`${game}:${street}`] ?? HOLDEM_FLOP
  const omahaNote = game !== 'holdem'
    ? 'Особенность Омахи: сильные готовые руки появляются у многих игроков, поэтому играют только натсы, а «почти натсы» играют пассивно.'
    : 'Особенность Холдема: одна пара часто достаточна против 1 оппонента, но слаба в мультпотах.'
  return {
    intro: `${STREET_NAMES_RU[street]}, ${opponents} ${opponents === 1 ? 'оппонент' : 'оппонентов'} в банке. Ориентир по силе руки:`,
    gameNote: omahaNote,
    positionNote: positionNote(seat),
    multiwayNote: multiwayNote(opponents),
    textureLabel: texture.empty ? texture.label : `Доска: ${texture.label}`,
    textureNote: texture.note,
    facingLabel: facingPct != null ? `Оппонент поставил ${facingPct}% банка` : null,
    tiers: tiers.map((t) => planOneTier(t, texture, opponents, facingPct)),
  }
}

/**
 * Ориентир из GTO-чарта для Омахи по вердикту решения:
 * raise → верхний тир (натсы), call → средний, fold → нижний.
 * Используется симулятором раздач для связи с разделом GTO.
 */
export function omahaEquityTier(game: 'omaha4' | 'omaha5', street: Exclude<Street, 'preflop'>, verdict: 'raise' | 'call' | 'fold'): PostflopTier {
  const tiers = GUIDES[`${game}:${street}`] ?? OMAHA_FLOP
  const pick = verdict === 'raise' ? tiers[0] : verdict === 'call' ? tiers[1] : tiers[tiers.length - 1]
  return { tier: pick.tier, examples: pick.examples, aggressive: pick.aggrText, facingBet: pick.faceText, action: pick.action }
}

// ---------- Префлоп: текстовые принципы ----------

export function preflopNotes(game: GameKind, pos: Position, situation: 'open' | 'vsraise', callers: number, raiser?: Position, players = 6): string[] {
  const notes: string[] = []
  if (game === 'holdem') {
    if (situation === 'open') {
      notes.push(`Стол ${players}-max: открытие с ${pos} — топ ~${openPercentFor(pos, players).toFixed(0)}% рук; отдельный чарт для каждого размера стола.`)
      notes.push('Открытие рейзом 2–3bb: чем раньше позиция, тем тайтовее диапазон.')
      if (pos === 'BTN') notes.push('С баттона открывается самый широкий диапазон — вы играете в позиции на всех блайндах.')
      if (pos === 'UTG') notes.push('С UTG после вас действует много игроков: нужна сила руки, а не потенциал.')
      if (pos === 'SB') notes.push('С SB против одного BB можно открывать шире, но без позиции постфлоп сложнее.')
    } else {
      const rp = raiser && raiser !== pos ? raiser : DEFAULT_RAISER[pos] ?? 'CO'
      const chart = holdemPreflop(pos, players, 'vsraise', callers, rp)
      const freq = holdemActionFrequencies(pos, rp, players, Math.max(0.45, 1 - 0.1 * callers))
      if (freq && freq.size > 0) {
        const agg = freqAggregate(freq)
        notes.push(`Против открытия с ${rp} за столом ${players}-max: соотношение действий по частотам — 3бет ${agg.raise.toFixed(0)}% / колл ${agg.call.toFixed(0)}% / фолд ${agg.fold.toFixed(0)}% всех рук.`)
        const ex = mixExamples(freq, 2)
        if (ex.length > 0) {
          notes.push(`Пограничные руки играются смешанно: ${ex.map((e) => `${e.cls} — ${freqLabel(e.f)}`).join(' · ')}.`)
        }
      } else {
        notes.push(`Против открытия с ${rp} за столом ${players}-max: 3бет ≈ топ ${chart.raisePct.toFixed(0)}% рук, колл ≈ топ ${chart.callPct.toFixed(0)}%.`)
      }
      notes.push('Ширина защиты зависит от позиции рейзера: BB против BTN/SB коллирует примерно в 1,5–2 раза больше рук, чем против UTG.')
      notes.push('Против рейза: премиум — 3бет, играбельные — колл, пограничные — микс, слабые — фолд.')
      if (callers > 0) notes.push(`Рейз уже поддержали ${callers} ${callers === 1 ? 'игрок' : 'игрока'}: коллы требуют более сильных рук, мультпот — для натс-потенциала.`)
      if (pos === 'BB') notes.push('BB защищается шире всех — колл со скидкой блайнда.')
      if (pos === 'BTN') notes.push('С баттона против рейза много коллов в позиции и 3беты с премиумом.')
    }
  } else {
    if (situation === 'open') {
      const pct = omahaPreflop(game as 'omaha4' | 'omaha5', pos, players, 'open', 0).openPercent
      notes.push(`Стол ${players}-max: открытие с ${pos} — топ ~${pct.toFixed(0)}% рук; отдельный чарт для каждого размера стола.`)
      notes.push('В Омахе открывайте координированные руки: тузы, мастевость и связки вместе сильнее, чем по отдельности.')
      if (pos === 'UTG') notes.push('С UTG — тайтово: двойномастные тузы, бродвей-связки, высокие пары.')
      if (pos === 'BTN') notes.push('С баттона — самый широкий диапазон: все двойномастные, связки, пары и A-хай руки.')
      if (pos === 'SB') notes.push('С SB открывайте чуть тайтовее BTN: без позиции играется сложнее.')
    } else {
      const rp = raiser && raiser !== pos ? raiser : DEFAULT_RAISER[pos] ?? 'CO'
      const chart = omahaPreflop(game as 'omaha4' | 'omaha5', pos, players, 'vsraise', callers, rp)
      notes.push(`Против открытия с ${rp} за столом ${players}-max: 3бет ≈ топ ${chart.threeBetPercent.toFixed(0)}%, колл ≈ топ ${chart.callPercent.toFixed(0)}%.`)
      notes.push('Ширина защиты зависит от позиции рейзера: против поздних открытий (BTN/SB) коллы в 1,5–1,7 раза шире, чем против UTG.')
      notes.push('Против рейза в Омахе: 3бет — только премиум (AAxx, AKQJ ds, высокие связки), играбельное — колл, слабое — фолд.')
      notes.push('У границ 3бет/колл и колл/фолд частоты плавно смешаны (зона ±3% диапазона): пограничная рука — например «3бет 50% / колл 50%».')
      if (callers > 0) notes.push(`В банке уже ${callers + 1} ${callers + 1 === 1 ? 'игрок' : 'игроков'}: коллируйте руки с натс-потенциалом, маргинальные — фолд.`)
      if (pos === 'BB') notes.push('BB защищается шире всех: скидка блайнда делает колл прибыльным.')
      notes.push('Изолированные тузы (AAxx без мастей/связок) в Омахе — рука «на один постфлоп»: не переоценивайте их.')
    }
  }
  return notes
}
