// Monte Carlo расчёт эквити: Холдем и Омаха (4/5 карт), 1–8 оппонентов,
// с поддержкой диапазонов оппонентов (rejection sampling из свободного хвоста колоды).
import { Card, fullDeck, cardToCode } from './cards'
import { evaluate7 } from './evaluator'
import { bestOmahaScoreFast } from './omahaSim'
import type { GameKind } from './handRanges'

export interface EquityResult {
  win: number
  tie: number
  lose: number
  iterations: number
  heroCats: number[] // счётчик финальных категорий руки героя (0..8)
}

const CATS_BASE = 15 ** 5 // категории упакованы как cat*15^5 + tiebreak

/** Быстрое частичное перемешивание: первые need элементов deck — случайная выборка */
function sampleFrom(deck: Card[], need: number, rand: () => number): void {
  const len = deck.length
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rand() * (len - i))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
}

export interface SimOptions {
  game?: GameKind // по умолчанию 'holdem'
  hero: Card[]
  board: Card[]
  opponents: number // 1..8
  iterations: number
  /** фиксированные карты оппонента (для калькулятора) — только на 1 оппонента */
  villainCards?: Card[] | null
  /** фильтр допустимых рук оппонента (диапазон); применяется к каждому оппоненту */
  villainFilter?: (h: Card[]) => boolean
  /** индивидуальные фильтры по оппонентам (villainFilters[i] для i-го оппонента) */
  villainFilters?: ((h: Card[]) => boolean)[]
  rand?: () => number
}

/**
 * Синхронная симуляция. deck мутирует (частичное перемешивание) — каждый вызов строит новый deck.
 * Ограничение: villainCards применяется только при opponents === 1.
 * Диапазонный отбор: рука каждого оппонента набирается из свободного хвоста колоды;
 * кандидаты вне диапазона не «сгорают», а остаются в ротации — распределение остаётся равномерным.
 */
export function simulateEquity(opts: SimOptions): EquityResult {
  const game = opts.game ?? 'holdem'
  const hc = game === 'holdem' ? 2 : game === 'omaha4' ? 4 : 5
  const { hero, board, opponents, iterations } = opts
  const rand = opts.rand ?? Math.random
  const useFixed = !!opts.villainCards && opponents === 1
  const filters = opts.villainFilters
  const useFilter = (!!opts.villainFilter || !!filters) && !useFixed

  const known = new Set<string>()
  for (const c of [...hero, ...board]) known.add(cardToCode(c))
  if (useFixed) for (const c of opts.villainCards!) known.add(cardToCode(c))

  const deck = fullDeck().filter((c) => !known.has(cardToCode(c)))
  const needBoard = 5 - board.length
  const len = deck.length

  // без диапазона: выборка доски + сразу всех рук; с диапазоном: выборка только доски
  const noRange = !useFilter
  const baseNeed = needBoard + (noRange && !useFixed ? opponents * hc : 0)

  const boardFull: Card[] = new Array(5)
  for (let i = 0; i < board.length; i++) boardFull[i] = board[i]

  let win = 0
  let tie = 0
  let lose = 0
  const heroCats = new Array(9).fill(0)
  const oppScores: number[] = new Array(opponents)
  const vil: Card[] = new Array(hc)
  const MAX_ATTEMPTS = 200

  for (let it = 0; it < iterations; it++) {
    if (baseNeed > 0) sampleFrom(deck, baseNeed, rand)
    for (let i = 0; i < needBoard; i++) boardFull[board.length + i] = deck[i]

    const b0 = boardFull[0]
    const b1 = boardFull[1]
    const b2 = boardFull[2]
    const b3 = boardFull[3]
    const b4 = boardFull[4]

    const heroScore = game === 'holdem'
      ? evaluate7([hero[0], hero[1], b0, b1, b2, b3, b4]).score
      : bestOmahaScoreFast(hero, boardFull)
    heroCats[Math.floor(heroScore / CATS_BASE)]++

    let bestOpp = -1
    let tailPtr = baseNeed // consumed accepted hands within [baseNeed, len)
    for (let o = 0; o < opponents; o++) {
      if (useFixed) {
        for (let i = 0; i < hc; i++) vil[i] = opts.villainCards![i]
      } else if (noRange) {
        const vi = needBoard + o * hc
        for (let k = 0; k < hc; k++) vil[k] = deck[vi + k]
      } else {
        // рука из свободного хвоста с отбраковкой вне диапазона
        const freeAll = len - tailPtr
        let ok = false
        for (let att = 0; att < MAX_ATTEMPTS && !ok && freeAll >= hc; att++) {
          for (let i = 0; i < hc; i++) {
            const j = tailPtr + i + Math.floor(rand() * (freeAll - i))
            const tmp = deck[tailPtr + i]
            deck[tailPtr + i] = deck[j]
            deck[j] = tmp
          }
          for (let i = 0; i < hc; i++) vil[i] = deck[tailPtr + i]
          const f = filters && filters[o] ? filters[o] : opts.villainFilter!
          if (f(vil)) ok = true
        }
        // принятая рука «сгорает» из ротации; при неудаче после MAX_ATTEMPTS — как есть (крайне редко)
        if (freeAll >= hc) tailPtr += hc
      }
      const vScore = game === 'holdem'
        ? evaluate7([vil[0], vil[1], b0, b1, b2, b3, b4]).score
        : bestOmahaScoreFast(vil, boardFull)
      oppScores[o] = vScore
      if (vScore > bestOpp) bestOpp = vScore
    }

    if (heroScore > bestOpp) win++
    else if (heroScore === bestOpp) tie++
    else lose++
  }

  return {
    win: win / iterations,
    tie: tie / iterations,
    lose: lose / iterations,
    iterations,
    heroCats,
  }
}

/** Точный подсчёт аутсов: сколько карт из колоды дают герою победу против руки оппонента. */
export function countOuts(hero: Card[], villain: Card[], board: Card[]): { outs: Card[]; heroAheadNow: boolean } {
  const known = new Set<string>()
  for (const c of [...hero, ...villain, ...board]) known.add(cardToCode(c))
  const deck = fullDeck().filter((c) => !known.has(cardToCode(c)))

  const heroNow = evaluate7([...hero, ...board])
  const vilNow = evaluate7([...villain, ...board])
  const heroAheadNow = heroNow.score > vilNow.score

  const outs: Card[] = []
  for (const c of deck) {
    const h7 = [...hero, ...board, c]
    const v7 = [...villain, ...board, c]
    if (evaluate7(h7).score > evaluate7(v7).score) outs.push(c)
  }
  return { outs, heroAheadNow }
}

/** Рекомендуемое число итераций (баланс точности и скорости). */
export function recommendedIterations(game: GameKind, opponents: number): number {
  if (game === 'holdem') return 30000
  // Омаха: бюджет ~6 млн вызовов score5; на итерацию (1+opponents) оценок по 50–60 комбинаций
  const combosPerEval = game === 'omaha4' ? 60 : 50
  const budget = 6_000_000
  return Math.max(2000, Math.min(60000, Math.round(budget / ((1 + opponents) * combosPerEval))))
}
