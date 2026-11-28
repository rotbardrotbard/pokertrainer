// Диапазоны стартовых рук оппонентов: Холдем (классы рук) и Омаха (эвристическая оценка).
// Используется калькулятором эквити и GTO-чартами.
// «Топ N%» — доля комбинаций от всех возможных стартовых рук.
import { Card, RANK_LABELS } from './cards'
import { handClass, topPercentClasses } from './ranges'

export type GameKind = 'holdem' | 'omaha4' | 'omaha5'

export const GAME_NAMES_RU: Record<GameKind, string> = {
  holdem: 'Холдем',
  omaha4: 'Омаха 4 карты',
  omaha5: 'Омаха 5 карт',
}

export const HOLE_COUNT: Record<GameKind, number> = { holdem: 2, omaha4: 4, omaha5: 5 }

// ---------- Пресеты диапазонов ----------

export interface RangePreset {
  id: string
  label: string
  percent: number // верхняя граница «топ N%» (100 — любые карты)
  desc: string
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'random', label: 'Случайные', percent: 100, desc: 'любые карты' },
  { id: 'premium', label: 'Премиум', percent: 5, desc: 'топ ~5% рук' },
  { id: 'tight', label: 'Тайт', percent: 15, desc: 'топ ~15% рук' },
  { id: 'medium', label: 'Средний', percent: 30, desc: 'топ ~30% рук' },
  { id: 'wide', label: 'Широкий', percent: 50, desc: 'топ ~50% рук' },
  { id: 'loose', label: 'Лузовый', percent: 75, desc: 'топ ~75% рук' },
]

export function presetById(id: string): RangePreset {
  return RANGE_PRESETS.find((p) => p.id === id) ?? RANGE_PRESETS[0]
}

// ---------- Омаха: эвристическая оценка стартовой руки ----------

/**
 * Оценка стартовой руки Омахи (4 или 5 карт), 0..100.
 * Учитывает пары, мастевость, связки и высокие карты.
 * Пороги «топ N%» калибруются по распределению случайных рук.
 */
export function ploRangeScore(cards: Card[]): number {
  const n = cards.length
  const rankCnt = new Map<number, number>()
  const suitCnt = [0, 0, 0, 0]
  const suitTop = [0, 0, 0, 0]
  for (const c of cards) {
    rankCnt.set(c.r, (rankCnt.get(c.r) || 0) + 1)
    suitCnt[c.s]++
    if (c.r > suitTop[c.s]) suitTop[c.s] = c.r
  }

  let raw = 0

  // пары: старшая (r-1)*4 (AA 52, KK 48…), вторая пара заметно слабее; низкие двойные пары переоценены не будут
  const pairRanks: number[] = []
  for (const [r, cnt] of rankCnt) {
    if (cnt === 2) pairRanks.push(r)
    else if (cnt >= 3) raw -= 16
  }
  pairRanks.sort((a, b) => b - a)
  if (pairRanks.length >= 1) raw += (pairRanks[0] - 1) * 4
  if (pairRanks.length >= 2) {
    raw += (pairRanks[1] - 1) * 1.5
    if (pairRanks[0] >= 10) raw += 6 // двойная пара высоких рангов
  }

  // мастевость: масть из 2/3/4 карт даёт 13/24/36 — двойномастность ценится выше моно
  for (let s = 0; s < 4; s++) {
    if (suitCnt[s] >= 2) {
      raw += Math.min(suitCnt[s], n) === 2 ? 13 : Math.min(suitCnt[s], n) === 3 ? 24 : 36
      if (suitTop[s] === 14) raw += 6
    }
  }

  // связки: длина максимальной последовательной связки (A считается и как 1)
  const distinct = [...rankCnt.keys()].sort((a, b) => b - a)
  const extended = [...distinct]
  if (rankCnt.has(14)) extended.push(1)
  const sorted = [...new Set(extended)].sort((a, b) => a - b)
  let runLen = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) cur++
    else cur = 1
    if (cur > runLen) runLen = cur
  }
  if (runLen >= 3) raw += runLen === 3 ? 10 : runLen === 4 ? 24 : 34
  if (runLen >= 4 && runTop(sorted) >= 10) raw += 8 // бродвей-связка
  // дополнительно: сколько «окон» из 3 последовательных рангов (JT97 — двойной потенциал стрита)
  let windows3 = 0
  for (const r of sorted) {
    if (r <= 14 && sorted.includes(r + 1) && sorted.includes(r + 2)) windows3++
  }
  raw += Math.min(windows3, 2) * 5

  // высокие карты
  for (const r of distinct) {
    if (r >= 10) raw += 3
    if (r === 14) raw += 4
  }

  // связность: много различных рангов в узком окне
  if (distinct.length >= 4) {
    const maxR = distinct[0]
    const minR = distinct[distinct.length - 1]
    if (maxR - minR <= 6) raw += 6
    else if (rankCnt.has(14) && maxR - minR <= 10 && minR >= 6) raw += 4 // туза «закрывают» через колесо
  }

  return Math.max(0, Math.min(100, raw))
}

function runTop(sorted: number[]): number {
  // верхний ранг самой длинной связки (грубая оценка: максимальный ранг руки)
  return sorted[sorted.length - 1]
}

// распределение оценок случайных стартовых рук (кэшируется, детерминированная выборка)
const omahaDistCache = new Map<'omaha4' | 'omaha5', Float64Array>()

/** Отсортированное по возрастанию распределение оценок 40000 случайных стартовых рук. */
export function omahaScoreDistribution(game: 'omaha4' | 'omaha5'): Float64Array {
  const hit = omahaDistCache.get(game)
  if (hit) return hit

  const hc = game === 'omaha4' ? 4 : 5
  const N = 40000
  const scores = new Float64Array(N)
  let seed = 987654321
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const buf: number[] = new Array(hc)
  for (let i = 0; i < N; i++) {
    // hc различных случайных карт
    let got = 0
    while (got < hc) {
      const idx = Math.floor(rnd() * 52)
      if (buf.indexOf(idx) < 0) buf[got++] = idx
    }
    const hand: Card[] = []
    for (let k = 0; k < hc; k++) hand.push({ r: (buf[k] % 13) + 2, s: Math.floor(buf[k] / 13) })
    scores[i] = ploRangeScore(hand)
  }
  scores.sort()
  omahaDistCache.set(game, scores)
  return scores
}

const omahaThresholdCache = new Map<string, number>()

export function omahaRangeThreshold(game: 'omaha4' | 'omaha5', percent: number): number {
  if (percent >= 100) return -1
  const pct = Math.max(1, Math.min(99, percent))
  const key = `${game}:${pct}`
  const hit = omahaThresholdCache.get(key)
  if (hit !== undefined) return hit

  const scores = omahaScoreDistribution(game)
  const N = scores.length
  // среди уникальных значений выбираем порог с минимальным отклонением доли от целевой
  const target = pct / 100
  let best = scores[0]
  let bestErr = Infinity
  let i = 0
  while (i < N) {
    const v = scores[i]
    let j = i
    while (j < N && scores[j] === v) j++
    const frac = (N - i) / N // доля рук с score >= v
    const err = Math.abs(frac - target)
    if (err < bestErr) {
      bestErr = err
      best = v
    }
    i = j
  }
  omahaThresholdCache.set(key, best)
  return best
}

/**
 * Место руки среди всех стартовых рук Омахи: «топ X%» (1 — сильнейшая).
 * Считается как доля рук с оценкой не ниже этой по распределению omahaScoreDistribution.
 */
export function omahaHandPercentile(game: 'omaha4' | 'omaha5', hand: Card[]): number {
  const dist = omahaScoreDistribution(game)
  const s = ploRangeScore(hand)
  let lo = 0
  let hi = dist.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (dist[mid] < s) lo = mid + 1
    else hi = mid
  }
  const frac = (dist.length - lo) / dist.length
  return Math.max(1, Math.round(frac * 100))
}

// ---------- Холдем: классы «топ N%» ----------

const holdemClassCache = new Map<number, Set<string>>()

export function holdemRangeClasses(percent: number): Set<string> {
  const pct = Math.max(1, Math.min(100, percent))
  const hit = holdemClassCache.get(pct)
  if (hit) return hit
  const set = pct >= 100 ? new Set<string>() : topPercentClasses(pct)
  holdemClassCache.set(pct, set)
  return set
}

// ---------- Проверка принадлежности диапазону ----------

export function handInRange(game: GameKind, hand: Card[], percent: number): boolean {
  if (percent >= 100) return true
  if (game === 'holdem') return holdemRangeClasses(percent).has(handClass(hand[0], hand[1]))
  return ploRangeScore(hand) >= omahaRangeThreshold(game, percent)
}

const filterCache = new Map<string, (h: Card[]) => boolean>()

export function rangeFilter(game: GameKind, percent: number): (h: Card[]) => boolean {
  const key = `${game}:${percent}`
  const hit = filterCache.get(key)
  if (hit) return hit
  const fn = (h: Card[]) => handInRange(game, h, percent)
  filterCache.set(key, fn)
  return fn
}

// ---------- Сэмплирование рук из диапазона (для GTO-примеров и состава) ----------

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Случайные руки из диапазона (равномерно по комбинациям). */
export function sampleRangeHands(game: GameKind, percent: number, count: number, seed = 42): Card[][] {
  const rnd = mulberry(seed)
  const hc = HOLE_COUNT[game]
  const out: Card[][] = []
  let guard = 0
  while (out.length < count && guard < count * 3000) {
    guard++
    const idx: number[] = []
    while (idx.length < hc) {
      const v = Math.floor(rnd() * 52)
      if (idx.indexOf(v) < 0) idx.push(v)
    }
    const hand = idx.map((v) => ({ r: (v % 13) + 2, s: Math.floor(v / 13) }))
    if (handInRange(game, hand, percent)) out.push(hand)
  }
  return out
}

export interface RangeStatItem {
  label: string
  pct: number
}

/** Состав диапазона Омахи: доли рук по типам (по сэмплу из диапазона). */
export function omahaRangeComposition(game: 'omaha4' | 'omaha5', percent: number, sample = 3000, seed = 7): RangeStatItem[] {
  const hands = sampleRangeHands(game, percent, sample, seed)
  let aces = 0
  let pairs = 0
  let doubleSuited = 0
  let mono = 0
  let suitedAny = 0
  let run4 = 0
  let run3 = 0
  let rainbow = 0
  for (const h of hands) {
    const rankCnt = new Map<number, number>()
    const suitCnt = [0, 0, 0, 0]
    for (const c of h) {
      rankCnt.set(c.r, (rankCnt.get(c.r) || 0) + 1)
      suitCnt[c.s]++
    }
    if ((rankCnt.get(14) || 0) >= 1) aces++
    let hasPair = false
    for (const cnt of rankCnt.values()) if (cnt === 2) hasPair = true
    if (hasPair) pairs++
    const suits2 = suitCnt.filter((n) => n >= 2).length
    if (suits2 >= 2) doubleSuited++
    if (suitCnt.some((n) => n >= 3)) mono++
    if (suits2 >= 1) suitedAny++
    if (suitCnt.every((n) => n <= 1)) rainbow++

    const distinct = [...rankCnt.keys()].sort((a, b) => b - a)
    const extended = [...distinct]
    if (rankCnt.has(14)) extended.push(1)
    const sorted = [...new Set(extended)].sort((a, b) => a - b)
    let runLen = 1
    let cur = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) cur++
      else cur = 1
      if (cur > runLen) runLen = cur
    }
    if (runLen >= 4) run4++
    else if (runLen === 3) run3++
  }
  const N = hands.length || 1
  const pct = (x: number) => Math.round((x / N) * 100)
  return [
    { label: 'с тузом', pct: pct(aces) },
    { label: 'двойномастные', pct: pct(doubleSuited) },
    { label: 'моно-масть (3+ одной масти)', pct: pct(mono) },
    { label: 'связка 4+ карт', pct: pct(run4) },
    { label: 'связка 3 карты', pct: pct(run3) },
    { label: 'с карманной парой', pct: pct(pairs) },
    { label: 'одномастные', pct: pct(suitedAny) },
    { label: 'радуга', pct: pct(rainbow) },
  ]
}

/** Текст руки «A♠K♥Q♦J♣» (для примеров). */
export function handToSymbols(hand: Card[]): string {
  return hand
    .slice()
    .sort((a, b) => b.r - a.r)
    .map((c) => RANK_LABELS[c.r - 2] + ['♠', '♥', '♦', '♣'][c.s])
    .join(' ')
}
