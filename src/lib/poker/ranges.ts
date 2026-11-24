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
  // Диапазон защиты зависит от позиции рейзера; упрощаем: единый разумный чарт
  const threeBet = new Set([
    'AA', 'KK', 'QQ', 'JJ', 'AKs', 'AQs', 'AKo', 'AQo',
    '99', 'TT', 'AJs', 'KQs', 'A5s', 'A4s', 'KJs',
  ])
  const call = new Set<string>()
  const callList = [
    '77', '88', '66', '55', '44', '33', '22',
    'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A3s', 'A2s',
    'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
    'QJs', 'QTs', 'Q9s', 'Q8s', 'JTs', 'J9s', 'J8s',
    'T9s', 'T8s', '98s', '97s', '87s', '76s', '65s', '54s',
    'AJo', 'ATo', 'KQo', 'KJo',
  ]
  for (const c of callList) call.add(c)
  void pos
  return { threeBet, call }
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
