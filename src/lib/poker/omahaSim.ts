// Симулятор раздач для Омахи с двумя досками (4-card / 5-card).
// Префлоп: решения по GTO-чартам позиции — те же диапазоны, что в разделе GTO
// (размер стола меняет ширину диапазона, рука оценивается как «топ X%»).
// Постфлоп: Monte-Carlo эквити на двух досках против случайной руки,
// решение по пот-оддсам (на каждой доске разыгрывается половина банка).
import { Card, fullDeck, RANK_CHARS } from './cards'
import { handName } from './evaluator'
import { bestOmahaHand } from './omaha'
import { Position, POSITION_NAMES_RU } from './ranges'
import { seatsForTable, basePos, omahaPreflop, omahaAction, omahaEquityTier } from './gto'
import type { OmahaPreflop } from './gto'
import { omahaHandPercentile } from './handRanges'

// ============ Быстрый оценщик 5 карт (без аллокаций) ============
// score в том же формате, что evaluate5 (packScore: cat*15^5 + tiebreak, base 15).
// Нужен для Monte-Carlo: тысячи вызовов на сценарий.

const _cnt = new Int32Array(15)
const _desc = new Int32Array(5) // distinct ranks по убыванию

function score5(
  r1: number, r2: number, r3: number, r4: number, r5: number,
  s1: number, s2: number, s3: number, s4: number, s5: number,
): number {
  const flush = s1 === s2 && s2 === s3 && s3 === s4 && s4 === s5
  _cnt[r1]++; _cnt[r2]++; _cnt[r3]++; _cnt[r4]++; _cnt[r5]++

  let quads = 0
  let trip = 0
  let p1 = 0
  let p2 = 0
  let pairN = 0
  let distinct = 0
  let minR = 15
  let maxR = 0
  let mask = 0
  let othersN = 0

  for (let r = 14; r >= 2; r--) {
    const c = _cnt[r]
    if (c === 0) continue
    mask |= 1 << r
    distinct++
    if (r < minR) minR = r
    if (r > maxR) maxR = r
    if (c === 4) quads = r
    else if (c === 3) trip = r
    else if (c === 2) {
      if (pairN === 0) p1 = r
      else p2 = r
      pairN++
    } else {
      if (othersN < 5) _desc[othersN++] = r
    }
  }

  let score: number
  let straightHigh = 0
  if (distinct === 5) {
    if (maxR - minR === 4) straightHigh = maxR
    else if (mask === 0x403c) straightHigh = 5 // A,2,3,4,5 (колесо): 16384+4+8+16+32
  }

  if (straightHigh > 0 && flush) score = 8 * 15 ** 5 + straightHigh * 15 ** 4
  else if (quads > 0) score = 7 * 15 ** 5 + quads * 15 ** 4 + _desc[0] * 15 ** 3
  else if (trip > 0 && pairN >= 1) score = 6 * 15 ** 5 + trip * 15 ** 4 + p1 * 15 ** 3
  else if (flush) score = 5 * 15 ** 5 + _desc[0] * 15 ** 4 + _desc[1] * 15 ** 3 + _desc[2] * 15 ** 2 + _desc[3] * 15 + _desc[4]
  else if (straightHigh > 0) score = 4 * 15 ** 5 + straightHigh * 15 ** 4
  else if (trip > 0) score = 3 * 15 ** 5 + trip * 15 ** 4 + _desc[0] * 15 ** 3 + _desc[1] * 15 ** 2
  else if (pairN >= 2) score = 2 * 15 ** 5 + p1 * 15 ** 4 + p2 * 15 ** 3 + _desc[0] * 15 ** 2
  else if (pairN === 1) score = 1 * 15 ** 5 + p1 * 15 ** 4 + _desc[0] * 15 ** 3 + _desc[1] * 15 ** 2 + _desc[2] * 15
  else score = _desc[0] * 15 ** 4 + _desc[1] * 15 ** 3 + _desc[2] * 15 ** 2 + _desc[3] * 15 + _desc[4]

  // сброс счётчиков (только затронутые ранги)
  _cnt[r1]--; _cnt[r2]--; _cnt[r3]--; _cnt[r4]--; _cnt[r5]--
  return score
}

// Сочетания: пары карт руки и тройки карт доски (индексы)
const HP4: number[][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
const HP5: number[][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
]
const BT5: number[][] = [
  [0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4],
  [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4],
]
const BT4: number[][] = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]
const BT3: number[][] = [[0, 1, 2]]

/** Лучшая Омаха-комбинация (score): ровно 2 карты руки + 3 с доски. Быстрая версия. */
export function bestOmahaScoreFast(hole: Card[], board: Card[]): number {
  const hp = hole.length === 5 ? HP5 : HP4
  const bt = board.length === 3 ? BT3 : board.length === 4 ? BT4 : BT5
  let best = -1
  for (let i = 0; i < hp.length; i++) {
    const c1 = hole[hp[i][0]]
    const c2 = hole[hp[i][1]]
    const r1 = c1.r
    const s1 = c1.s
    const r2 = c2.r
    const s2 = c2.s
    for (let j = 0; j < bt.length; j++) {
      const t = bt[j]
      const s = score5(
        r1, r2, board[t[0]].r, board[t[1]].r, board[t[2]].r,
        s1, s2, board[t[0]].s, board[t[1]].s, board[t[2]].s,
      )
      if (s > best) best = s
    }
  }
  return best
}

// ============ Monte-Carlo эквити на двух досках ============

export interface OmahaDoubleEquity {
  eq1: number // доля банка на доске 1 (win + tie/2), 0..1
  eq2: number // доля банка на доске 2, 0..1
  total: number // усреднённая доля банка: (eq1 + eq2) / 2
  iterations: number
}

interface SimDoubleOptions {
  hero: Card[]
  boards: [Card[], Card[]]
  holeCount: 4 | 5
  iterations?: number
  rand?: () => number
}

/** Частичная перетасовка: первые need элементов deck — случайная выборка. */
function sampleFrom(deck: Card[], need: number, rand: () => number): void {
  const len = deck.length
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rand() * (len - i))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
}

/**
 * Эквити героя на двух досках против одного оппонента со случайной рукой.
 * Каждая доска — половина банка, итоговое эквити — среднее по доскам.
 */
export function simulateOmahaDouble(opts: SimDoubleOptions): OmahaDoubleEquity {
  const { hero, boards, holeCount } = opts
  const rand = opts.rand ?? Math.random
  const iters = opts.iterations ?? 700
  const b1 = boards[0]
  const b2 = boards[1]

  const known = new Set<string>()
  for (const c of [...hero, ...b1, ...b2]) known.add(c.r + '-' + c.s)
  const deck = fullDeck().filter((c) => !known.has(c.r + '-' + c.s))

  const need1 = 5 - b1.length
  const need2 = 5 - b2.length
  const need = need1 + need2 + holeCount

  const b1f: Card[] = new Array(5)
  for (let i = 0; i < b1.length; i++) b1f[i] = b1[i]
  const b2f: Card[] = new Array(5)
  for (let i = 0; i < b2.length; i++) b2f[i] = b2[i]
  const vil: Card[] = new Array(holeCount)

  let w1 = 0
  let t1 = 0
  let w2 = 0
  let t2 = 0

  for (let it = 0; it < iters; it++) {
    sampleFrom(deck, need, rand)
    for (let i = 0; i < need1; i++) b1f[b1.length + i] = deck[i]
    for (let i = 0; i < need2; i++) b2f[b2.length + i] = deck[need1 + i]
    for (let i = 0; i < holeCount; i++) vil[i] = deck[need1 + need2 + i]

    const h1 = bestOmahaScoreFast(hero, b1f)
    const v1 = bestOmahaScoreFast(vil, b1f)
    const h2 = bestOmahaScoreFast(hero, b2f)
    const v2 = bestOmahaScoreFast(vil, b2f)

    if (h1 > v1) w1++
    else if (h1 === v1) t1++
    if (h2 > v2) w2++
    else if (h2 === v2) t2++
  }

  const eq1 = (w1 + t1 / 2) / iters
  const eq2 = (w2 + t2 / 2) / iters
  return { eq1, eq2, total: (eq1 + eq2) / 2, iterations: iters }
}

// ============ Профиль стартовой руки PLO4 / PLO5 ============

export interface PloProfile {
  score: number // 0..100, упрощённая оценка силы стартовой руки
  aces: number
  pairRank: number | null // карманная пара в руке (старшая)
  suitedLabel: string // «двойномастная (♠♠ ♥♥)» и т.п.
  suitedCount: number // 0..2 скользящих мастей (масти, где ≥2 карты)
  runLen: number // длина максимальной связки (последовательные ранги, A учитывается как 1 и 14)
  runText: string // «A-K-Q-J» или ''
  desc: string // краткое описание для пояснения
  features: string[] // пункты для разбора
}

export function analyzePloHand(cards: Card[]): PloProfile {
  const rankCnt = new Map<number, number>()
  const suitCnt = [0, 0, 0, 0]
  for (const c of cards) {
    rankCnt.set(c.r, (rankCnt.get(c.r) || 0) + 1)
    suitCnt[c.s]++
  }
  const aces = rankCnt.get(14) ?? 0
  let pairRank: number | null = null
  let tripInHand = false
  for (const [r, n] of rankCnt) {
    if (n === 2) pairRank = pairRank === null ? r : Math.max(pairRank, r)
    if (n >= 3) tripInHand = true
  }

  // мастевость
  const suitedSuits = [0, 1, 2, 3].filter((s) => suitCnt[s] >= 2).sort((a, b) => suitCnt[b] - suitCnt[a])
  const suitNames = ['♠', '♥', '♦', '♣']
  let suitedLabel = 'радуга (нет двух карт одной масти)'
  if (suitedSuits.length > 0) {
    const parts = suitedSuits.map((s) => `${suitCnt[s]}${suitNames[s]}`)
    if (suitCnt[suitedSuits[0]] >= 3) suitedLabel = `моно-масть (${parts.join(' ')})`
    else if (suitedSuits.length >= 2) suitedLabel = `двойномастная (${parts.join(' ')})`
    else suitedLabel = `одномастная (${parts.join(' ')})`
  }
  const suitedCount = suitedSuits.length >= 2 ? 2 : suitedSuits.length

  // связки: distinct-ранги, A учитывается и как 1
  const distinct = [...rankCnt.keys()].sort((a, b) => b - a)
  const extended = [...distinct]
  if (aces > 0) extended.push(1)
  const sorted = [...new Set(extended)].sort((a, b) => a - b)
  let runLen = 1
  let bestStart = sorted[0]
  let curLen = 1
  let curStart = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      curLen++
    } else {
      curLen = 1
      curStart = sorted[i]
    }
    if (curLen > runLen) {
      runLen = curLen
      bestStart = curStart
    }
  }
  // связка отображаем по убыванию, заменяя A=1 на A=14 для показа
  const runRanks: number[] = []
  for (let r = bestStart + runLen - 1; r >= bestStart; r--) runRanks.push(r === 1 ? 14 : r)
  const runText = runLen >= 3 ? runRanks.map((r) => RANK_CHARS[r - 2]).join('-') : ''

  // оценка (упрощённая, обучающая)
  let score = 0
  if (aces === 1) score += 20
  else if (aces >= 2) score += 42
  if (pairRank !== null) score += 6
  if (tripInHand) score -= 10
  // мастевость: каждая масть с n картами даёт (n-1)*6, максимум 16
  let suitPts = 0
  for (const s of suitedSuits) suitPts += (Math.min(suitCnt[s], 4) - 1) * 6
  score += Math.min(16, suitPts)
  // связки: (длина - 2) * 9, максимум 27
  score += Math.min(27, Math.max(0, runLen - 2) * 9)
  // высокие карты: +2 за каждый distinct T/J/Q/K
  for (const r of distinct) if (r >= 10) score += 2
  score = Math.max(0, Math.min(100, score))

  const features: string[] = []
  if (aces === 1) features.push('Туз — главная карта Омахи: больше шансов на топ-комбинации')
  if (aces >= 2) features.push('Два туза — премиальный старт в Омахе (не так силён, как пара тузов в Холдеме)')
  if (suitedCount >= 2) features.push('Двойномастность: два потенциала флеша')
  else if (suitedSuits.length === 1 && suitCnt[suitedSuits[0]] >= 3) features.push('3+ карты одной масти: сильный потенциал флеша')
  else if (suitedSuits.length === 1) features.push('Одномастная: один потенциал флеша')
  else features.push('Радуга — без мастевого потенциала')
  if (runLen >= 4) features.push(`Связка ${runText}: стрит-потенциал сразу с нескольких концов`)
  else if (runLen === 3) features.push(`Мини-связка ${runText}: средний стрит-потенциал`)
  else features.push('Нет связки — слабый стрит-потенциал')
  if (pairRank !== null) features.push(`Карманная пара ${RANK_CHARS[pairRank - 2]} в руке`)
  if (tripInHand) features.push('Три карты одного ранга в руке — мёртвый вес в Омахе')

  const parts: string[] = []
  if (aces > 0) parts.push(aces >= 2 ? 'два туза' : 'с тузом')
  if (suitedCount >= 2 || suitedSuits.length === 1) parts.push(suitedLabel.split(' (')[0])
  if (runLen >= 3) parts.push(`связка ${runText}`)
  if (pairRank !== null && aces < 2) parts.push(`пара ${RANK_CHARS[pairRank - 2]}`)
  const desc = parts.length > 0
    ? parts.join(', ').replace(/^./, (ch) => ch.toUpperCase())
    : 'Разномастная некоординированная рука'

  return { score, aces, pairRank, suitedLabel, suitedCount, runLen, runText, desc, features }
}

// ============ Сценарии симулятора ============

export type OmahaSimAction = 'fold' | 'call' | 'raise'
export type OmahaSimKind = 'open' | 'vsRaise' | 'postflop'

export interface OmahaSimScenario {
  holeCount: 4 | 5
  kind: OmahaSimKind
  hero: Card[]
  boards: [Card[], Card[]] | null // только postflop
  boardStreet: number // общая улица постфлопа: длина ОБЕИХ досок (3=флоп, 4=терн, 5=ривер); доски открываются синхронно
  position: Position
  players: number // размер стола (влияет на ширину диапазона)
  raiser?: Position // позиция рейзера (для сценария vsRaise)
  chart: OmahaPreflop | null // GTO-чарт позиции (префлоп)
  handPct: number | null // место руки: «топ X%» стартовых рук (префлоп)
  gtoHint: string | null // постфлоп: ориентир из GTO-чарта
  prompt: string
  actionLabels: { fold: string; call: string | null; raise: string }
  correctAction: OmahaSimAction
  pot: number
  bet: number
  stack: number
  profile: PloProfile
  sim: OmahaDoubleEquity | null // только postflop
  requiredPct: number | null // требуемые пот-оддсы, %
  heroHands: [string, string] | null // названия текущих комбинаций на досках
  heroBest: [Card[], Card[]] | null // 5 карт лучших комбинаций на досках
  explanation: string
  detail: string[]
}

const ri = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: readonly T[]): T => arr[ri(arr.length)]

// размеры стола в симуляторе: от хедз-апа до 9-max
const SIM_TABLES = [2, 3, 4, 5, 6, 9] as const

function gameOf(holeCount: 4 | 5): 'omaha4' | 'omaha5' {
  return holeCount === 4 ? 'omaha4' : 'omaha5'
}

/** Уникальные базовые позиции стола в порядке действия (без BB, если excludeBB). */
function tablePositions(players: number, excludeBB: boolean): Position[] {
  const seats = seatsForTable(players).map(basePos)
  const uniq = [...new Set(seats)]
  return excludeBB ? uniq.filter((p) => p !== 'BB') : uniq
}

function shuffled(): Card[] {
  return shuffleIn(fullDeck())
}

function shuffleIn(deck: Card[]): Card[] {
  const a = deck.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Префлоп: открытие из позиции (по GTO-чарту) ---

function genOpenScenario(holeCount: 4 | 5): OmahaSimScenario {
  const game = gameOf(holeCount)
  const players = pick(SIM_TABLES)
  const pos = pick(tablePositions(players, true)) // открытие — все позиции кроме BB
  const deck = shuffled()
  const hero = deck.slice(0, holeCount)
  const profile = analyzePloHand(hero)
  const chart = omahaPreflop(game, pos, players, 'open', 0)
  const correct: OmahaSimAction = omahaAction(game, hero, chart, 'open')
  const handPct = omahaHandPercentile(game, hero)
  const raisePct = Math.round(chart.openPercent)
  return {
    holeCount,
    kind: 'open',
    hero,
    boards: null,
    boardStreet: 0,
    position: pos,
    players,
    chart,
    handPct,
    gtoHint: null,
    prompt: `${POSITION_NAMES_RU[pos]} · стол ${players}-max. До вас все сбросили. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: null, raise: 'Рейз до 3bb' },
    correctAction: correct,
    pot: 1.5,
    bet: 0,
    stack: 100,
    profile,
    sim: null,
    requiredPct: null,
    heroHands: null,
    heroBest: null,
    explanation: correct === 'raise'
      ? `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — входит в диапазон открытия с ${POSITION_NAMES_RU[pos]} (топ ~${raisePct}%). Открывайте рейзом 3–4bb.`
      : `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — вне диапазона открытия с ${POSITION_NAMES_RU[pos]} (топ ~${raisePct}%). Сбрасывайте.`,
    detail: [
      ...profile.features,
      `GTO-чарт: открытие с ${POSITION_NAMES_RU[pos]} за столом ${players}-max — рейз с топ ~${raisePct}% рук (оценка структуры ≥ ${Math.round(chart.openThreshold)} из 100).`,
      `Ваша рука по той же шкале — топ ~${handPct}%: чем раньше позиция и больше стол, тем тайтовее диапазон.`,
    ],
  }
}

// --- Префлоп: против рейза (по GTO-чарту) ---

function genVsRaiseScenario(holeCount: 4 | 5): OmahaSimScenario {
  const game = gameOf(holeCount)
  const players = pick(SIM_TABLES)
  const seats = seatsForTable(players)
  const vi = ri(seats.length - 1) // рейзер — любой кроме BB, действует раньше героя
  const villainPos = basePos(seats[vi])
  const pos = basePos(pick(seats.slice(vi + 1)))
  const deck = shuffled()
  const hero = deck.slice(0, holeCount)
  const profile = analyzePloHand(hero)
  const openSize = 3
  // все сбросили до героя: только рейзер в банке (opponents = 1, callers = 0)
  const chart = omahaPreflop(game, pos, players, 'vsraise', 0, villainPos)
  const correct: OmahaSimAction = omahaAction(game, hero, chart, 'vsraise')
  const handPct = omahaHandPercentile(game, hero)
  const tbPct = Math.round(chart.threeBetPercent)
  const callPct = Math.round(chart.callPercent)
  return {
    holeCount,
    kind: 'vsRaise',
    hero,
    boards: null,
    boardStreet: 0,
    position: pos,
    players,
    raiser: villainPos,
    chart,
    handPct,
    gtoHint: null,
    prompt: `${villainPos} открывается рейзом до ${openSize}bb (стол ${players}-max). Вы на ${POSITION_NAMES_RU[pos]}. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: `Колл ${openSize}bb`, raise: '3бет до 12bb' },
    correctAction: correct,
    pot: 1.5 + openSize,
    bet: openSize,
    stack: 100,
    profile,
    sim: null,
    requiredPct: null,
    heroHands: null,
    heroBest: null,
    explanation: correct === 'raise'
      ? `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — в 3бет-диапазоне с ${POSITION_NAMES_RU[pos]} (топ ~${tbPct}%). 3бет для вэлью и инициативы.`
      : correct === 'call'
        ? `Рука — топ ~${handPct}% стартовых: вне 3бета (топ ~${tbPct}%), но в диапазоне колла с ${POSITION_NAMES_RU[pos]} (топ ~${callPct}%). Колл и игра постфлоп.`
        : `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — слабее диапазона защиты с ${POSITION_NAMES_RU[pos]} (колл — топ ~${callPct}%). Фолд.`,
    detail: [
      ...profile.features,
      `GTO-чарт: против рейза с ${POSITION_NAMES_RU[pos]} — 3бет с топ ~${tbPct}%, колл с топ ~${callPct}% рук (стол ${players}-max).`,
      'Диапазон зависит от размера стола: чем больше игроков, тем тайтовее защита.',
    ],
  }
}

// --- Постфлоп: решение против ставки на двух досках ---

function genPostflopScenario(holeCount: 4 | 5, forceStreet?: 3 | 4 | 5): OmahaSimScenario {
  const pot = pick([30, 40, 60, 80])
  const betMult = pick([0.5, 0.75, 1])
  const bet = Math.round(pot * betMult)
  const required = bet / (pot + 2 * bet)
  const requiredPct = Math.round(required * 1000) / 10

  // выбираем самую «интересную» из нескольких раздач: эквити ближе к границе решения
  let best: OmahaSimScenario | null = null
  let bestInterest = -Infinity
  for (let t = 0; t < 4; t++) {
    const deck = shuffled()
    const hero = deck.slice(0, holeCount)
    // Обе доски на одной улице: 2 флопа → 2 терна → 2 ривера (синхронно)
    // forceStreet — для режима экзамена (фиксированная улица вопроса)
    const n = forceStreet ?? pick([3, 3, 4, 5])
    const b1 = deck.slice(holeCount, holeCount + n)
    const b2 = deck.slice(holeCount + n, holeCount + 2 * n)
    const sim = simulateOmahaDouble({ hero, boards: [b1, b2], holeCount, iterations: 600 })
    const totalPct = sim.total * 100
    const street = n === 3 ? 'флоп' : n === 4 ? 'терн' : 'ривер'
    const heroHands: [string, string] = [
      handName(bestOmahaHand(hero, b1)),
      handName(bestOmahaHand(hero, b2)),
    ]
    const heroBest: [Card[], Card[]] = [
      bestOmahaHand(hero, b1).best,
      bestOmahaHand(hero, b2).best,
    ]
    let correct: OmahaSimAction
    if (sim.total >= required + 0.14) correct = 'raise'
    else if (sim.total >= required + 0.01) correct = 'call'
    else correct = 'fold'
    const verdict = correct === 'raise'
      ? 'рейз для вэлью — эквити сильно выше требуемого'
      : correct === 'call'
        ? 'колл прибылен — эквити выше требуемых пот-оддсов'
        : 'фолд — колл теряет деньги'
    const streetLabel = street
    // GTO-ориентир по общей улице
    const gtoStreet: 'flop' | 'turn' | 'river' = n === 3 ? 'flop' : n === 4 ? 'turn' : 'river'
    const tier = omahaEquityTier(gameOf(holeCount), gtoStreet, correct)
    const scenario: OmahaSimScenario = {
      holeCount,
      kind: 'postflop',
      hero,
      boards: [b1, b2],
      boardStreet: n,
      position: 'BB',
      players: 6,
      chart: null,
      handPct: null,
      gtoHint: `${tier.tier} — против ставки: ${tier.facingBet.toLowerCase()}`,
      prompt: `${streetLabel}. Оппонент ставит ${bet} bb в банк ${pot} bb на обе доски. Ваше действие?`,
      actionLabels: { fold: 'Фолд', call: `Колл ${bet} bb`, raise: `Рейз до ${Math.round(bet * 2.5)} bb` },
      correctAction: correct,
      pot,
      bet,
      stack: 100,
      profile: analyzePloHand(hero),
      sim,
      requiredPct,
      heroHands,
      heroBest,
      explanation:
        `Эквити по банку ${totalPct.toFixed(1)}% (Доска 1: ${(sim.eq1 * 100).toFixed(0)}%, Доска 2: ${(sim.eq2 * 100).toFixed(0)}%) ` +
        `против случайной руки при требуемых ${requiredPct}% — ${verdict}.`,
      detail: [
        'На каждой доске разыгрывается половина банка: итоговое эквити — среднее по двум доскам.',
        'Доски открываются синхронно: сначала два флопа, затем два терна и два ривера.',
        `Доска 1 (${street}) — ваша лучшая комбинация: ${heroHands[0]}.`,
        `Доска 2 (${street}) — ваша лучшая комбинация: ${heroHands[1]}.`,
        `Пот-оддсы: ${bet} / (${pot} + ${bet} + ${bet}) = ${requiredPct}%.`,
        `GTO-чарт (${street}): ${tier.tier} — против ставки: ${tier.facingBet.toLowerCase()}.`,
        'В Омахе комбинация — ровно 2 карты руки + 3 с доски, подсветка показывает их.',
      ],
    }
    // интерес: эквити близко к границе решения, разброс между досками добавляет обучательности
    const spread = Math.abs(sim.eq1 - sim.eq2)
    const interest = -Math.abs(sim.total - (required + 0.05)) + spread * 0.25 + Math.random() * 0.04
    if (interest > bestInterest) {
      bestInterest = interest
      best = scenario
    }
  }
  return best!
}

export function genOmahaSimScenario(holeCount: 4 | 5): OmahaSimScenario {
  const r = Math.random()
  if (r < 0.3) return genOpenScenario(holeCount)
  if (r < 0.55) return genVsRaiseScenario(holeCount)
  return genPostflopScenario(holeCount)
}

// ============ Режим экзамена ============

export type ExamLength = 5 | 10 | 20

/** Сценарий заданного типа (для экзамена). street — только для postflop (3=флоп, 4=терн, 5=ривер). */
export function genOmahaSimScenarioOf(
  holeCount: 4 | 5,
  kind: 'open' | 'vsRaise' | 'postflop',
  street?: 3 | 4 | 5,
): OmahaSimScenario {
  if (kind === 'open') return genOpenScenario(holeCount)
  if (kind === 'vsRaise') return genVsRaiseScenario(holeCount)
  return genPostflopScenario(holeCount, street)
}

/**
 * Экзамен: сбалансированный набор раздач фиксированной длины.
 * На каждые 5 вопросов — 1 открытие, 1 защита против рейза и по одному
 * постфлоп-решению на флопе, терне и ривере. Порядок вопросов перемешан.
 */
export function genOmahaSimExam(holeCount: 4 | 5, length: ExamLength): OmahaSimScenario[] {
  const per = length / 5
  const plan: Array<{ kind: 'open' | 'vsRaise' | 'postflop'; street?: 3 | 4 | 5 }> = []
  for (let i = 0; i < per; i++) {
    plan.push(
      { kind: 'open' },
      { kind: 'vsRaise' },
      { kind: 'postflop', street: 3 },
      { kind: 'postflop', street: 4 },
      { kind: 'postflop', street: 5 },
    )
  }
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }
  return plan.map((p) => genOmahaSimScenarioOf(holeCount, p.kind, p.street))
}
