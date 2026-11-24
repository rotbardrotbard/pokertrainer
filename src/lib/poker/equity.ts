// Monte Carlo расчёт эквити.
import { Card, fullDeck, cardToCode } from './cards'
import { evaluate7 } from './evaluator'

export interface EquityResult {
  win: number
  tie: number
  lose: number
  iterations: number
  heroCats: number[] // счётчик финальных категорий руки героя (0..8)
}

/** Быстрое частичное перемешивание: первые need элементов deck — случайная выборка */
function sampleFrom(deck: Card[], need: number, rand: () => number, out: Card[]): void {
  const len = deck.length
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rand() * (len - i))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
    out[i] = deck[i]
  }
}

export interface SimOptions {
  hero: Card[]
  board: Card[]
  opponents: number
  iterations: number
  /** фиксированные карты оппонента (для калькулятора) — только на 1 оппонента */
  villainCards?: Card[] | null
  /** фильтр допустимых рук оппонента (для диапазонов); только 1 оппонент */
  villainFilter?: (h: Card[]) => boolean
  rand?: () => number
}

/**
 * Синхронная симуляция. deck мутирует (частичное перемешивание) — каждый вызов строит новый deck.
 * Ограничение: villainFilter/villainCards применяются только при opponents === 1.
 */
export function simulateEquity(opts: SimOptions): EquityResult {
  const { hero, board, opponents, iterations } = opts
  const rand = opts.rand ?? Math.random
  const useFixed = !!opts.villainCards && opponents === 1
  const useFilter = !!opts.villainFilter && opponents === 1 && !useFixed

  const known = new Set<string>()
  for (const c of [...hero, ...board]) known.add(cardToCode(c))
  if (useFixed) for (const c of opts.villainCards!) known.add(cardToCode(c))

  const deck = fullDeck().filter((c) => !known.has(cardToCode(c)))
  const needBoard = 5 - board.length
  const need = needBoard + (useFixed || useFilter ? 0 : opponents * 2)

  const sample: Card[] = new Array(need)
  const boardFull: Card[] = new Array(5)
  for (let i = 0; i < board.length; i++) boardFull[i] = board[i]

  let win = 0
  let tie = 0
  let lose = 0
  const heroCats = new Array(9).fill(0)
  const oppScores: number[] = new Array(opponents)

  for (let it = 0; it < iterations; it++) {
    sampleFrom(deck, need, rand, sample)
    for (let i = 0; i < needBoard; i++) boardFull[board.length + i] = sample[i]

    const b0 = boardFull[0]
    const b1 = boardFull[1]
    const b2 = boardFull[2]
    const b3 = boardFull[3]
    const b4 = boardFull[4]

    const heroRes = evaluate7([hero[0], hero[1], b0, b1, b2, b3, b4])
    heroCats[heroRes.cat]++

    let bestOpp = -1
    for (let o = 0; o < opponents; o++) {
      let v1: Card, v2: Card
      if (useFixed) {
        v1 = opts.villainCards![0]
        v2 = opts.villainCards![1]
      } else if (useFilter) {
        // случайная рука из диапазона, без повторов с картами борда этой итерации
        let ok = false
        for (let att = 0; att < 60 && !ok; att++) {
          const j1 = Math.floor(rand() * deck.length)
          const j2 = Math.floor(rand() * deck.length)
          if (j1 === j2) continue
          if (sample.indexOf(deck[j1]) >= 0 || sample.indexOf(deck[j2]) >= 0) continue
          const h = [deck[j1], deck[j2]]
          if (opts.villainFilter!(h)) {
            v1 = h[0]
            v2 = h[1]
            ok = true
          }
        }
        if (!ok) {
          // редкий fallback: две случайные карты вне выборки борда
          const pool = deck.length - need
          const j1 = need + Math.floor(rand() * pool)
          let j2 = need + Math.floor(rand() * pool)
          if (j2 === j1) j2 = (j2 + 1 - need) % pool + need
          v1 = deck[j1]
          v2 = deck[j2]
        }
      } else {
        const vi = needBoard + o * 2
        v1 = sample[vi]
        v2 = sample[vi + 1]
      }
      oppScores[o] = evaluate7([v1!, v2!, b0, b1, b2, b3, b4]).score
      if (oppScores[o] > bestOpp) bestOpp = oppScores[o]
    }

    if (heroRes.score > bestOpp) win++
    else if (heroRes.score === bestOpp) tie++
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
