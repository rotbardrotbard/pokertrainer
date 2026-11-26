// Диапазоны префлоп 6-max (упрощённые GTO-чарты) и утилиты для рук.
import { Card } from './cards'

export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB'

export const POSITION_ORDER: Position[] = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']
export const POSITION_NAMES_RU: Record<Position, string> = {
  UTG: 'UTG (ранняя)',
  MP: 'MP (средняя)',
  CO: 'CO (кат-офф)',
  BTN: 'BTN (баттон)',
  SB: 'SB (малый блайнд)',
  BB: 'BB (большой блайнд)',
}

/** Класс руки: 'AA', 'AKs', 'AKo' и т.п. */
export function handClass(c1: Card, c2: Card): string {
  const hi = Math.max(c1.r, c2.r)
  const lo = Math.min(c1.r, c2.r)
  if (hi === lo) return rankChar(hi) + rankChar(hi)
  const suited = c1.s === c2.s
  return rankChar(hi) + rankChar(lo) + (suited ? 's' : 'o')
}

function rankChar(r: number): string {
  return ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'][r - 2]
}

function classToCards(cls: string): [Card, Card][] {
  const chars = cls.split('')
  const ri = (ch: string) => ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].indexOf(ch) + 2
  const r1 = ri(chars[0])
  const r2 = ri(chars[1])
  const out: [Card, Card][] = []
  if (r1 === r2) {
    for (let s = 0; s < 4; s++)
      for (let t = s + 1; t < 4; t++) out.push([{ r: r1, s }, { r: r2, s: t }])
  } else if (chars[2] === 's') {
    for (let s = 0; s < 4; s++) out.push([{ r: r1, s }, { r: r2, s }])
  } else {
    for (let s = 0; s < 4; s++)
      for (let t = 0; t < 4; t++)
        if (s !== t) out.push([{ r: r1, s }, { r: r2, s: t }])
  }
  return out
}

/** Все 169 классов рук */
export function allHandClasses(): string[] {
  const out: string[] = []
  const chars = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
  for (let i = 0; i < 13; i++) {
    out.push(chars[i] + chars[i])
    for (let j = i + 1; j < 13; j++) {
      out.push(chars[i] + chars[j] + 's')
      out.push(chars[i] + chars[j] + 'o')
    }
  }
  return out
}

/** Формула Чена — числовая оценка стартовой руки (для сортировки по силе). */
export function chenScore(cls: string): number {
  const ri = (ch: string) => ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].indexOf(ch) + 2
  const r1 = ri(cls[0])
  const r2 = ri(cls[1])
  const suited = cls[2] === 's'
  const isPair = r1 === r2
  const hi = Math.max(r1, r2)
  const lo = Math.min(r1, r2)
  let pts: number
  if (isPair) {
    pts = Math.max(5, 2 * chenRankPts(hi))
  } else {
    pts = chenRankPts(hi)
    if (suited) pts += 2
    const gap = hi - lo - 1
    if (gap === 1) pts -= 1
    else if (gap === 2) pts -= 2
    else if (gap === 3) pts -= 4
    else if (gap >= 4) pts -= 5
    // бонус на стрит-потенциал (0/1/2 гэп)
    if (gap <= 1 && hi < 12) pts += 1
    if (gap === 0 && hi < 12) pts += 1
  }
  return Math.round(pts * 2) / 2
}

function chenRankPts(r: number): number {
  switch (r) {
    case 14: return 10
    case 13: return 8
    case 12: return 7
    case 11: return 6
    default: return r / 2
  }
}

/** Все 169 классов, упорядоченные по силе (Чен) — для «топ N%» */
export function orderedClasses(): string[] {
  return allHandClasses().sort((a, b) => chenScore(b) - chenScore(a))
}

export function classCombos(cls: string): number {
  if (cls.length === 2) return 6
  return cls[2] === 's' ? 4 : 12
}

export function classesToCombos(classes: Set<string>): [Card, Card][] {
  const out: [Card, Card][] = []
  for (const cls of classes) out.push(...classToCards(cls))
  return out
}

// ---------- Правила открытия рейза (упрощённые GTO-чарты, 6-max, 100bb) ----------

interface RangeRule {
  minPair: number // 0 = не открывать пары
  allSuitedAces: boolean
  minSuitedK: number
  minSuitedQ: number
  minSuitedJ: number
  minSuitedT: number
  minSuitedBelowT: number // минимум младшего ранга для одномастных ниже T (напр. 98s+)
  suitedConnectorsDown: string[] // дополнительные коннекторы/гапперы ниже T
  minOffAce: number // 0 = нет оффсьют-тузов
  offBroadways: string[] // оффсьют-бродвеи, напр. 'KQo','KJo','QJo'
  extraOff: string[] // прочие оффсьют ('JTo','T9o','98o' и т.п.)
}

const OPEN_RULES: Record<Position, RangeRule> = {
  UTG: {
    minPair: 5, allSuitedAces: true, minSuitedK: 9, minSuitedQ: 9, minSuitedJ: 9,
    minSuitedT: 8, minSuitedBelowT: 8, suitedConnectorsDown: ['98s', '87s', '76s'],
    minOffAce: 10, offBroadways: ['KQo'], extraOff: [],
  },
  MP: {
    minPair: 2, allSuitedAces: true, minSuitedK: 8, minSuitedQ: 8, minSuitedJ: 8,
    minSuitedT: 7, minSuitedBelowT: 7, suitedConnectorsDown: ['98s', '87s', '76s', '65s', '54s'],
    minOffAce: 10, offBroadways: ['KQo'], extraOff: [],
  },
  CO: {
    minPair: 2, allSuitedAces: true, minSuitedK: 6, minSuitedQ: 6, minSuitedJ: 6,
    minSuitedT: 6, minSuitedBelowT: 6, suitedConnectorsDown: ['96s', '86s', '75s', '65s', '54s'],
    minOffAce: 10, offBroadways: ['KQo', 'KJo', 'QJo'], extraOff: [],
  },
  BTN: {
    minPair: 2, allSuitedAces: true, minSuitedK: 2, minSuitedQ: 2, minSuitedJ: 2,
    minSuitedT: 2, minSuitedBelowT: 2,
    suitedConnectorsDown: [], // все одномастные кроме мусора (исключения ниже)
    minOffAce: 2, offBroadways: ['KQo', 'KJo', 'QJo'], extraOff: ['JTo', 'T9o'],
  },
  SB: {
    minPair: 2, allSuitedAces: true, minSuitedK: 5, minSuitedQ: 5, minSuitedJ: 5,
    minSuitedT: 6, minSuitedBelowT: 6, suitedConnectorsDown: ['96s', '86s', '75s', '65s', '54s'],
    minOffAce: 2, offBroadways: ['KQo', 'KJo'], extraOff: ['Q9o', 'J9o', 'T9o', '98o'],
  },
  BB: {
    // BB как «рейзер» почти не бывает; используем широкий диапазон защиты
    minPair: 2, allSuitedAces: true, minSuitedK: 2, minSuitedQ: 4, minSuitedJ: 6,
    minSuitedT: 7, minSuitedBelowT: 7, suitedConnectorsDown: ['96s', '86s', '75s', '65s', '54s'],
    minOffAce: 9, offBroadways: ['KQo', 'KJo', 'QJo'], extraOff: ['JTo', 'T9o', '98o'],
  },
}

// Исключения BTN/SB: совсем мусорные одномастные
const SUITED_TRASH = new Set(['32s', '42s', '43s'])

export function openRangeClasses(pos: Position): Set<string> {
  const rule = OPEN_RULES[pos]
  const set = new Set<string>()
  for (const cls of allHandClasses()) {
    const isPair = cls.length === 2
    const r1 = rankVal(cls[0])
    const r2 = rankVal(cls[1])
    if (isPair) {
      if (r1 >= rule.minPair) set.add(cls)
      continue
    }
    const suited = cls[2] === 's'
    const hi = Math.max(r1, r2)
    const lo = Math.min(r1, r2)
    if (suited) {
      if (rule.allSuitedAces && hi === 14) { set.add(cls); continue }
      if (hi === 13 && lo >= rule.minSuitedK) { set.add(cls); continue }
      if (hi === 12 && lo >= rule.minSuitedQ) { set.add(cls); continue }
      if (hi === 11 && lo >= rule.minSuitedJ) { set.add(cls); continue }
      if (hi === 10 && lo >= rule.minSuitedT) { set.add(cls); continue }
      if (hi < 10 && lo >= rule.minSuitedBelowT && !SUITED_TRASH.has(cls)) { set.add(cls); continue }
      if (rule.suitedConnectorsDown.includes(cls)) set.add(cls)
    } else {
      if (hi === 14 && lo >= rule.minOffAce) set.add(cls)
      else if (rule.offBroadways.includes(cls)) set.add(cls)
      else if (rule.extraOff.includes(cls)) set.add(cls)
    }
  }
  return set
}

function rankVal(ch: string): number {
  return ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].indexOf(ch) + 2
}

/** Процент комбинаций диапазона от 1326 */
export function rangePercent(classes: Set<string>): number {
  let combos = 0
  for (const cls of classes) combos += classCombos(cls)
  return (combos / 1326) * 100
}

/** Классы «топ N%» по Чену — генерический диапазон (для постфлоп-сценариев) */
export function topPercentClasses(percent: number): Set<string> {
  const ordered = orderedClasses()
  const set = new Set<string>()
  let combos = 0
  const target = (percent / 100) * 1326
  for (const cls of ordered) {
    if (combos >= target) break
    set.add(cls)
    combos += classCombos(cls)
  }
  return set
}

/** Классы 3бета и колла против рейза (упрощённо): премиум → 3бет, играбельное → колл */
export function vsRaiseClasses(pos: Position): { threeBet: Set<string>; call: Set<string> } {
  const c = vsRaiseCharts(pos, 'CO') ?? { threeBet: new Set<string>(), call: new Set<string>() }
  return { threeBet: c.threeBet, call: c.call }
}

// ---------- Компактная нотация чартов ----------

function pairClass(r: number): string {
  const c = rankChar(r)
  return c + c
}

/** Разбор компактной записи диапазона: 'AA-TT,A5s-A2s,T9s-76s,K9s+,AQs+,KQo'. */
export function parseClasses(spec: string): Set<string> {
  const out = new Set<string>()
  for (const raw of spec.split(',')) {
    const tok = raw.trim()
    if (!tok) continue
    if (tok.includes('-')) {
      const parts = tok.split('-')
      if (parts.length === 2) expandDash(parts[0], parts[1], out)
    } else if (tok.endsWith('+')) {
      expandPlus(tok.slice(0, -1), out)
    } else {
      out.add(tok)
    }
  }
  return out
}

/** '77-22' (пары), 'A5s-A2s' (одинаковая старшая), 'T9s-76s' (коннекторы). */
function expandDash(a: string, b: string, out: Set<string>) {
  if (a.length === 2 && b.length === 2) {
    let r = rankVal(a[0])
    const end = rankVal(b[0])
    const step = r <= end ? 1 : -1
    for (;;) {
      out.add(pairClass(r))
      if (r === end) break
      r += step
    }
    return
  }
  const hiA = rankVal(a[0]), loA = rankVal(a[1]), hiB = rankVal(b[0]), loB = rankVal(b[1]), suit = a[2]
  if (hiA === hiB) {
    const step = loA <= loB ? 1 : -1
    for (let lo = loA;; lo += step) {
      out.add(a[0] + rankChar(lo) + suit)
      if (lo === loB) break
    }
  } else if (hiA - loA === hiB - loB) {
    const step = hiA <= hiB ? 1 : -1
    for (let hi = hiA;; hi += step) {
      out.add(rankChar(hi) + rankChar(hi - 1) + suit)
      if (hi === hiB) break
    }
  }
}

/** 'TT+' → TT..AA; 'K9s+' → K9s..KQs; 'AQs+' → AQs, AKs. */
function expandPlus(base: string, out: Set<string>) {
  if (base.length === 2) {
    const r = rankVal(base[0])
    for (let i = r; i <= 14; i++) out.add(pairClass(i))
    return
  }
  const hi = rankVal(base[0])
  for (let lo = rankVal(base[1]); lo < hi; lo++) out.add(base[0] + rankChar(lo) + base[2])
}

const parseCache = new Map<string, Set<string>>()

function parseCached(spec: string): Set<string> {
  const hit = parseCache.get(spec)
  if (hit) return hit
  const set = parseClasses(spec)
  parseCache.set(spec, set)
  return set
}

// ---------- Защита против рейза: позиция рейзера имеет значение ----------

/**
 * Ширина колла защиты (% комбинаций) по паре «защитник × позиция рейзера».
 * BB против BTN/SB открывшегося защищается в 1,5–2,5 раза шире, чем против UTG.
 */
const CALL_PCT: Partial<Record<Position, Partial<Record<Position, number>>>> = {
  UTG: { UTG: 6.5 }, // UTG против открытия UTG1/UTG2 (9-max)
  MP: { UTG: 7.5 },
  CO: { UTG: 8.5, MP: 10 },
  BTN: { UTG: 9.5, MP: 11.5, CO: 13.5 },
  SB: { UTG: 7, MP: 8.5, CO: 10.5, BTN: 13 },
  BB: { UTG: 16, MP: 19, CO: 24, BTN: 31, SB: 40 },
}

/** Спецификация 3бета по той же паре: против поздних рейзеров диапазон шире и поляризованнее. */
const THREEBET_SPECS: Partial<Record<Position, Partial<Record<Position, string>>>> = {
  UTG: { UTG: 'QQ+,AKs,AKo' },
  MP: { UTG: 'QQ+,AKs,AKo' },
  CO: { UTG: 'QQ+,AKs,AKo,A5s,A4s', MP: 'JJ+,AQs+,AKo,A5s,A4s' },
  BTN: { UTG: 'JJ+,AQs+,AKo,A5s,A4s', MP: 'JJ+,AQs+,AKo,A5s-A2s,KQs', CO: 'TT+,AJs+,AKo,A5s-A2s,KQs' },
  SB: { UTG: 'QQ+,AQs+,AKo,A5s-A4s', MP: 'JJ+,AQs+,AKo,A5s-A2s,KQs', CO: 'JJ+,AQs+,AKo,A5s-A2s,KQs,KJs', BTN: 'TT+,AJs+,AKo,A5s-A2s,KQs,KJs,QJs' },
  BB: { UTG: 'QQ+,AKs,AKo', MP: 'QQ+,AQs+,AKo,A5s,A4s', CO: 'JJ+,AQs+,AKo,A5s-A2s,KQs', BTN: 'TT+,AJs+,AKo,A5s-A2s,KQs,KJs,QTs', SB: '99+,AJs+,AKo,A5s-A2s,KQs,KJs,QJs,JTs' },
}

/** Отдельные множители ширины защиты под размер стола (не формула). */
export const SIZE_DEF_FACTOR: Record<number, number> = {
  2: 1.5, 3: 1.35, 4: 1.2, 5: 1.1, 6: 1.0, 7: 0.94, 8: 0.88, 9: 0.82,
}

// порядок добора рук в колл: пары (старшие вперёд) → все одномастные тузы
// (включая AQs/ATs/AJs — без них сильные руки выпадали в фолд) → suited бродвей/коннекторы
const CALL_CORE: string[] = [
  'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AQs', 'ATs', 'AJs', 'A5s', 'A4s', 'A3s', 'A2s', 'A9s', 'A8s', 'A7s', 'A6s',
  'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'T9s', '98s', '87s', '76s', '65s', '54s',
]
const CALL_OFF_IP: string[] = ['AQo', 'AJo', 'KQo', 'ATo', 'KJo', 'QJo', 'JTo', 'KTo', 'QTo', 'K9o', 'A9o']
const CALL_OFF_WIDE: string[] = ['Q9o', 'J9o', 'T9o', '98o', 'A8o', 'K8o', 'A7o', 'Q8o', 'J8o', 'T8o', '97o', '96o', '87o', '76o', '65o', 'A6o', 'K7o', 'Q7o', 'J7o', 'T7o']
// дополнительный пул для коротких столов (HU/3-max): BB защищается очень широко
const CALL_OFF_HU: string[] = ['A5o', 'A4o', 'K6o', 'K5o', 'Q6o', 'J6o', 'T6o', '54o', 'A3o', 'A2o', 'K4o', 'K3o', 'K2o', 'Q5o', 'J5o', 'T5o', '95o']

const callSetCache = new Map<string, Set<string>>()

/** Колл-чарт защитника заданной ширины: IP — с оффсьют-бродвеями, SB — только suited/пары, BB — всё. */
function buildCallSet(defender: Position, targetPct: number): Set<string> {
  const pct = Math.max(4, Math.min(70, targetPct))
  const key = `${defender}:${pct.toFixed(1)}`
  const hit = callSetCache.get(key)
  if (hit) return hit
  const order = defender === 'BB'
    ? [...CALL_CORE, ...CALL_OFF_IP, ...CALL_OFF_WIDE, ...CALL_OFF_HU]
    : defender === 'SB'
      ? CALL_CORE
      : [...CALL_CORE, ...CALL_OFF_IP]
  const target = (pct / 100) * 1326
  const set = new Set<string>()
  let combos = 0
  for (const cls of order) {
    if (combos >= target) break
    set.add(cls)
    combos += classCombos(cls)
  }
  callSetCache.set(key, set)
  return set
}

export interface VsRaiseChart {
  threeBet: Set<string>
  call: Set<string>
  threeBetPct: number
  callPct: number
}

const vsCache = new Map<string, VsRaiseChart | null>()

/**
 * Чарт защиты против рейза: зависит и от защитника, и от позиции рейзера.
 * Возвращает null для невозможных сочетаний (рейзер действует после защитника).
 */
export function vsRaiseCharts(defender: Position, raiser: Position, players = 6, callerFactor = 1): VsRaiseChart | null {
  const key = `${defender}|${raiser}|${players}|${callerFactor.toFixed(2)}`
  const hit = vsCache.get(key)
  if (hit !== undefined) return hit
  const tbSpec = THREEBET_SPECS[defender]?.[raiser]
  const callBase = CALL_PCT[defender]?.[raiser]
  let chart: VsRaiseChart | null = null
  if (tbSpec && callBase != null) {
    let spec = tbSpec
    if (players <= 3) spec += ',QJs,JTs,KTs,QTs' // короткие столы: 3бет шире
    const threeBet = parseCached(spec)
    const cap = players <= 3 ? 68 : 62
    const callPct = Math.min(cap, Math.max(4, callBase * (SIZE_DEF_FACTOR[players] ?? 1) * callerFactor))
    const call = buildCallSet(defender, callPct)
    chart = { threeBet, call, threeBetPct: rangePercent(threeBet), callPct: rangePercent(call) }
  }
  vsCache.set(key, chart)
  return chart
}

/** Позиция рейзера по умолчанию для защитника (ближайшая ранняя позиция). */
export const DEFAULT_RAISER: Record<Position, Position> = {
  UTG: 'UTG', MP: 'UTG', CO: 'MP', BTN: 'CO', SB: 'BTN', BB: 'CO',
}

/** Позиции рейзера, против которых защитник действует валидно. */
export function validRaisersFor(defender: Position): Position[] {
  if (defender === 'UTG') return ['UTG'] // против UTG1/UTG2 (9-max) — та же базовая позиция
  const order: Position[] = ['UTG', 'MP', 'CO', 'BTN', 'SB']
  if (defender === 'BB') return order // BB защищается против любых рейзеров
  return order.slice(0, order.indexOf(defender))
}

// ---------- Отдельные чарты открытия под каждый размер стола ----------

/**
 * Целевая ширина открытия (% комбинаций от 1326) для КАЖДОГО размера стола 2–9-max.
 * Чарт каждой позиции/размера строится из правил OPEN_RULES подгонкой под эту ширину.
 */
export const OPEN_PCT_SIZE: Partial<Record<number, Partial<Record<Position, number>>>> = {
  2: { UTG: 28, MP: 34, CO: 44, BTN: 72, SB: 56 },
  3: { UTG: 25, MP: 30, CO: 38, BTN: 61, SB: 50 },
  4: { UTG: 22, MP: 27, CO: 35, BTN: 55, SB: 45 },
  5: { UTG: 19, MP: 24, CO: 31, BTN: 52, SB: 41 },
  6: { UTG: 16, MP: 20, CO: 26, BTN: 46, SB: 36 },
  7: { UTG: 14, MP: 17, CO: 23, BTN: 36, SB: 29 },
  8: { UTG: 13, MP: 16, CO: 21, BTN: 31, SB: 27 },
  9: { UTG: 12, MP: 15, CO: 19, BTN: 28, SB: 25 },
}

const fitCache = new Map<string, Set<string>>()

/** Диапазон открытия с позиции за столом players: отдельный чарт под каждый размер стола. */
export function openRangeClassesFor(pos: Position, players: number): Set<string> {
  if (pos === 'BB') return openRangeClasses(pos)
  const target = OPEN_PCT_SIZE[players]?.[pos]
  if (target == null) return openRangeClasses(pos)
  const key = `${pos}:${players}`
  const hit = fitCache.get(key)
  if (hit) return hit
  const set = fitClassesToPct(openRangeClasses(pos), target)
  fitCache.set(key, set)
  return set
}

/** Подгонка набора классов под целевую ширину: добавляем сильнейшие недостающие или убираем слабейшие. */
function fitClassesToPct(base: Set<string>, targetPct: number): Set<string> {
  const target = (targetPct / 100) * 1326
  const combos = (set: Set<string>) => {
    let c = 0
    for (const cls of set) c += classCombos(cls)
    return c
  }
  const out = new Set(base)
  const ordered = orderedClasses()
  if (combos(out) < target) {
    for (const cls of ordered) {
      if (combos(out) >= target) break
      if (!out.has(cls)) out.add(cls)
    }
  } else {
    for (const cls of [...ordered].reverse()) {
      if (combos(out) <= target) break
      if (out.has(cls) && combos(out) - classCombos(cls) >= 6) out.delete(cls)
    }
  }
  return out
}

/** Ширина открытия (% комбинаций) для позиции и размера стола — для подписей UI. */
export function openPercentFor(pos: Position, players: number): number {
  return rangePercent(openRangeClassesFor(pos, players))
}

/** Проверка руки по классу с учётом диапазона */
export function handInSet(c1: Card, c2: Card, set: Set<string>): boolean {
  return set.has(handClass(c1, c2))
}

export const RANGE_LABELS: Record<Position, string> = {
  UTG: 'Открытие рейза с UTG',
  MP: 'Открытие рейза с MP',
  CO: 'Открытие рейза с CO',
  BTN: 'Открытие рейза с BTN',
  SB: 'Открытие рейза с SB',
  BB: 'Защита BB против рейза',
}
