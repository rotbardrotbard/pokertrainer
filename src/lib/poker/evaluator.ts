// Оценщик покерных комбинаций (Texas Hold'em).
// Возвращает числовой score: category*15^5 + tiebreak-ранги (base 15).
// Чем больше score, тем сильнее рука.
import { Card, RANK_LABELS } from './cards'

export const HAND_CATEGORY_NAMES_RU = [
  'Старшая карта',
  'Пара',
  'Две пары',
  'Сет (трипс)',
  'Стрит',
  'Флеш',
  'Фулл-хаус',
  'Каре',
  'Стрит-флеш',
] as const

export interface HandResult {
  score: number
  cat: number // 0..8
  best: Card[] // ровно 5 карт, составляющих лучшую руку
}

// ---------- Быстрый 7-карточный оценщик ----------

/** Возвращает старший стрит из битовой маски рангов, 0 если нет. Учитывает колесо A2345. */
function straightHighFromMask(mask: number): number {
  for (let hi = 14; hi >= 6; hi--) {
    const window = 0b11111 << (hi - 4)
    if ((mask & window) === window) return hi
  }
  // колесо: A,2,3,4,5
  const wheel = (1 << 14) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)
  if ((mask & wheel) === wheel) return 5
  return 0
}

function packScore(cat: number, tie: number[]): number {
  // всегда 5 tie-рангов (дополняем нулями) — чтобы сравнение между категориями работало
  const t = tie.slice(0, 5)
  while (t.length < 5) t.push(0)
  let s = cat
  for (let i = 0; i < 5; i++) s = s * 15 + t[i]
  return s
}

export function evaluate7(cards: Card[]): HandResult {
  const cnt = new Array<number>(15).fill(0)
  const suitCnt = [0, 0, 0, 0]
  const suitMask = [0, 0, 0, 0]
  let rankMask = 0
  const byRank = new Map<number, Card[]>()

  for (const c of cards) {
    cnt[c.r]++
    suitCnt[c.s]++
    suitMask[c.s] |= 1 << c.r
    rankMask |= 1 << c.r
    let arr = byRank.get(c.r)
    if (!arr) {
      arr = []
      byRank.set(c.r, arr)
    }
    arr.push(c)
  }

  let flushSuit = -1
  for (let s = 0; s < 4; s++) if (suitCnt[s] >= 5) flushSuit = s

  const ranksDesc: number[] = []
  for (let r = 14; r >= 2; r--) if (cnt[r] > 0) ranksDesc.push(r)

  // Стрит-флеш / флеш
  if (flushSuit >= 0) {
    const sfHigh = straightHighFromMask(suitMask[flushSuit])
    if (sfHigh > 0) {
      // 5 карт стрит-флеша
      const best = pickStraight(cards, sfHigh, flushSuit)
      return { score: packScore(8, [sfHigh]), cat: 8, best }
    }
    const flushRanks: number[] = []
    for (let r = 14; r >= 2 && flushRanks.length < 5; r--) {
      if (suitMask[flushSuit] & (1 << r)) flushRanks.push(r)
    }
    const best = pickFlush(cards, flushSuit, flushRanks)
    return { score: packScore(5, flushRanks), cat: 5, best }
  }

  // Группировки по количеству
  let quads = 0
  const trips: number[] = []
  const pairs: number[] = []
  for (let r = 14; r >= 2; r--) {
    if (cnt[r] === 4) quads = r
    else if (cnt[r] === 3) trips.push(r)
    else if (cnt[r] === 2) pairs.push(r)
  }

  if (quads > 0) {
    const kicker = ranksDesc.find((r) => r !== quads) as number
    const best = [...byRank.get(quads)!, ...byRank.get(kicker)!.slice(0, 1)]
    return { score: packScore(7, [quads, kicker]), cat: 7, best }
  }

  if (trips.length >= 2) {
    const [t1, t2] = trips // уже по убыванию
    const best = [...byRank.get(t1)!, ...byRank.get(t2)!.slice(0, 2)]
    return { score: packScore(6, [t1, t2]), cat: 6, best }
  }
  if (trips.length === 1 && pairs.length >= 1) {
    const t = trips[0]
    const p = pairs[0]
    const best = [...byRank.get(t)!, ...byRank.get(p)!.slice(0, 2)]
    return { score: packScore(6, [t, p]), cat: 6, best }
  }

  const stHigh = straightHighFromMask(rankMask)
  if (stHigh > 0) {
    const best = pickStraight(cards, stHigh, -1)
    return { score: packScore(4, [stHigh]), cat: 4, best }
  }

  if (trips.length === 1) {
    const t = trips[0]
    const kickers = ranksDesc.filter((r) => r !== t).slice(0, 2)
    const best = [...byRank.get(t)!, ...kickers.map((k) => byRank.get(k)![0])]
    return { score: packScore(3, [t, ...kickers]), cat: 3, best }
  }

  if (pairs.length >= 2) {
    const [p1, p2] = pairs
    const kicker = ranksDesc.find((r) => r !== p1 && r !== p2) as number
    const best = [
      ...byRank.get(p1)!.slice(0, 2),
      ...byRank.get(p2)!.slice(0, 2),
      byRank.get(kicker)![0],
    ]
    return { score: packScore(2, [p1, p2, kicker]), cat: 2, best }
  }

  if (pairs.length === 1) {
    const p = pairs[0]
    const kickers = ranksDesc.filter((r) => r !== p).slice(0, 3)
    const best = [...byRank.get(p)!.slice(0, 2), ...kickers.map((k) => byRank.get(k)![0])]
    return { score: packScore(1, [p, ...kickers]), cat: 1, best }
  }

  const top5 = ranksDesc.slice(0, 5)
  const best = top5.map((r) => byRank.get(r)![0])
  return { score: packScore(0, top5), cat: 0, best }
}

function pickStraight(cards: Card[], high: number, suit: number): Card[] {
  const needed = new Set<number>()
  if (high === 5) {
    for (const r of [14, 2, 3, 4, 5]) needed.add(r)
  } else {
    for (let r = high - 4; r <= high; r++) needed.add(r)
  }
  const out: Card[] = []
  const used = new Set<string>()
  for (let r = 14; r >= 2 && needed.size > 0; r--) {
    if (!needed.has(r)) continue
    const c = cards.find((x) => x.r === r && (suit < 0 || x.s === suit) && !used.has(x.r + '-' + x.s))
    if (c) {
      out.push(c)
      used.add(c.r + '-' + c.s)
      needed.delete(r)
    }
  }
  return out
}

function pickFlush(cards: Card[], suit: number, ranks: number[]): Card[] {
  const out: Card[] = []
  for (const r of ranks) {
    const c = cards.find((x) => x.r === r && x.s === suit)
    if (c) out.push(c)
  }
  return out.slice(0, 5)
}

// ---------- Оценщик 5 карт (для валидации и простых задач) ----------

export function evaluate5(cards: Card[]): number {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a)
  const flush = cards.every((c) => c.s === cards[0].s)
  const uniq = [...new Set(ranks)]
  let straightHigh = 0
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0]
    else if (uniq[0] === 14 && uniq[1] === 5) straightHigh = 5
  }
  const cnt = new Map<number, number>()
  for (const r of ranks) cnt.set(r, (cnt.get(r) || 0) + 1)
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])

  if (straightHigh > 0 && flush) return packScore(8, [straightHigh])
  if (groups[0][1] === 4) return packScore(7, [groups[0][0], groups[1][0]])
  if (groups[0][1] === 3 && groups[1][1] === 2) return packScore(6, [groups[0][0], groups[1][0]])
  if (flush) return packScore(5, ranks)
  if (straightHigh > 0) return packScore(4, [straightHigh])
  if (groups[0][1] === 3) return packScore(3, [groups[0][0], groups[1][0], groups[2][0]])
  if (groups[0][1] === 2 && groups[1][1] === 2)
    return packScore(2, [groups[0][0], groups[1][0], groups[2][0]])
  if (groups[0][1] === 2)
    return packScore(1, [groups[0][0], groups[1][0], groups[2][0], groups[3][0]])
  return packScore(0, ranks)
}

/** Комбинации из 7 по 5 — 21 вариант (индексы) */
const C75: number[][] = (() => {
  const out: number[][] = []
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e])
  return out
})()

export function evaluate7BruteForce(cards: Card[]): number {
  let best = -1
  for (const combo of C75) {
    const s = evaluate5([cards[combo[0]], cards[combo[1]], cards[combo[2]], cards[combo[3]], cards[combo[4]]])
    if (s > best) best = s
  }
  return best
}

// ---------- Русские названия ----------

export function handCategoryName(cat: number): string {
  return HAND_CATEGORY_NAMES_RU[cat]
}

/** Короткое название комбинации для результата: "Каре тузов", "Фулл-хаус (K и 9)" и т.п. */
export function handName(result: HandResult): string {
  const { cat, best } = result
  const ranks = best.map((c) => c.r).sort((a, b) => b - a)
  const uniq = [...new Set(ranks)]
  const cnt = new Map<number, number>()
  for (const r of ranks) cnt.set(r, (cnt.get(r) || 0) + 1)
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const nom = (r: number) => (r === 14 ? 'туз' : r === 13 ? 'король' : r === 12 ? 'дама' : r === 11 ? 'валет' : RANK_LABELS[r - 2])
  // родительный падеж единственного числа («до короля», «до дамы»)
  const genSg = (r: number) => {
    switch (r) {
      case 14: return 'туза'
      case 13: return 'короля'
      case 12: return 'дамы'
      case 11: return 'валета'
      case 10: return 'десятки'
      case 9: return 'девятки'
      case 8: return 'восьмёрки'
      case 7: return 'семёрки'
      case 6: return 'шестёрки'
      case 5: return 'пятёрки'
      case 4: return 'четвёрки'
      case 3: return 'тройки'
      default: return 'двойки'
    }
  }
  const genPl = (r: number) => {
    switch (r) {
      case 14: return 'тузов'
      case 13: return 'королей'
      case 12: return 'дам'
      case 11: return 'валетов'
      case 10: return 'десяток'
      case 9: return 'девяток'
      case 8: return 'восьмёрок'
      case 7: return 'семёрок'
      case 6: return 'шестёрок'
      case 5: return 'пятёрок'
      case 4: return 'четвёрок'
      case 3: return 'троек'
      default: return 'двоек'
    }
  }
  switch (cat) {
    case 8: {
      // старшая карта стрита: floor(score / 15^4) % 15
      const high = Math.floor(result.score / 15 ** 4) % 15
      if (high === 14) return 'Флеш-рояль'
      return `Стрит-флеш до ${genSg(high)}`
    }
    case 7: return `Каре ${genPl(groups[0][0])}`
    case 6: return `Фулл-хаус: ${genPl(groups[0][0])} и ${genPl(groups[1][0])}`
    case 5: {
      const high = ranks[0]
      return high === 14 ? 'Флеш (туз старший)' : `Флеш до ${genSg(high)}`
    }
    case 4: {
      const high = Math.floor(result.score / 15 ** 4) % 15
      return high === 14 ? 'Стрит до туза (Бродвей)' : high === 5 ? 'Колесо (5-4-3-2-A)' : `Стрит до ${genSg(high)}`
    }
    case 3: return `Сет ${genPl(groups[0][0])}`
    case 2: return `Две пары: ${genPl(groups[0][0])} и ${genPl(groups[1][0])}`
    case 1: return `Пара ${genPl(groups[0][0])}`
    default: return `Старшая карта — ${nom(ranks[0])}`
  }
}

/** Валидация: score → категория */
export function scoreCategory(score: number): number {
  return Math.floor(score / 15 ** 5)
}
