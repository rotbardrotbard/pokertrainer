// Генераторы вопросов для Омахи: классическая (1 доска) и двойной борд (2 доски).
import { Card, fullDeck, shuffle } from './cards'
import { handName } from './evaluator'
import { bestOmahaHand, playsBoardOnly } from './omaha'

const ri = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: T[]): T => arr[ri(arr.length)]

// ============ Классическая Омаха: кто победил ============

export interface OmahaWinnerQuestion {
  hero: Card[] // 4 карты
  villain: Card[] // 4 карты
  board: Card[] // 3..5 карт
  correct: 'hero' | 'villain' | 'tie'
  heroHandName: string
  villainHandName: string
  heroBest: Card[]
  villainBest: Card[]
  heroUsesHole: boolean
  villainUsesHole: boolean
}

function buildOmahaWinner(deck: Card[]): OmahaWinnerQuestion {
  const hero = deck.slice(0, 4)
  const villain = deck.slice(4, 8)
  const boardN = pick([3, 4, 5, 5, 5])
  const board = deck.slice(8, 8 + boardN)
  const heroRes = bestOmahaHand(hero, board)
  const vilRes = bestOmahaHand(villain, board)
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
    heroUsesHole: !playsBoardOnly(hero, board),
    villainUsesHole: !playsBoardOnly(villain, board),
  }
}

export function genOmahaWinnerQuestion(): OmahaWinnerQuestion {
  // выбираем самую «интересную» из нескольких раздач: предпочтение рукам,
  // где карты руки действительно участвуют в комбинации
  let best: OmahaWinnerQuestion | null = null
  let bestScore = -1
  for (let t = 0; t < 12; t++) {
    const q = buildOmahaWinner(shuffle(fullDeck()))
    const diff = q.correct !== 'tie' ? 1.5 : 0
    const interest =
      (q.heroUsesHole ? 2 : 0) + (q.villainUsesHole ? 2 : 0) + diff + Math.random() * 2.5
    if (interest > bestScore) {
      bestScore = interest
      best = q
    }
  }
  return best!
}

// ============ Омаха с двумя досками (4-card / 5-card) ============

export type OmahaVariant = 'classic' | 'double4' | 'double5'

export interface OmahaDoubleQuestion {
  holeCount: 4 | 5
  hero: Card[]
  villain: Card[]
  boards: [Card[], Card[]]
  /** строгое сравнение по каждой доске: true = игрок 1 выигрывает доску (ничья — не выигрыш) */
  heroWins: [boolean, boolean]
  ties: [boolean, boolean]
  correct: 'both' | 'b1' | 'b2' | 'none'
  heroNames: [string, string]
  villainNames: [string, string]
  heroBest: [Card[], Card[]]
  villainBest: [Card[], Card[]]
  heroUsesHole: [boolean, boolean]
  villainUsesHole: [boolean, boolean]
}

function buildOmahaDouble(holeCount: 4 | 5, deck: Card[]): OmahaDoubleQuestion {
  const hero = deck.slice(0, holeCount)
  const villain = deck.slice(holeCount, holeCount * 2)
  const n1 = pick([3, 4, 5, 5, 5])
  const n2 = pick([3, 4, 5, 5, 5])
  const b1 = deck.slice(holeCount * 2, holeCount * 2 + n1)
  const b2 = deck.slice(holeCount * 2 + n1, holeCount * 2 + n1 + n2)
  const h1 = bestOmahaHand(hero, b1)
  const h2 = bestOmahaHand(hero, b2)
  const v1 = bestOmahaHand(villain, b1)
  const v2 = bestOmahaHand(villain, b2)
  const heroWins: [boolean, boolean] = [h1.score > v1.score, h2.score > v2.score]
  const ties: [boolean, boolean] = [h1.score === v1.score, h2.score === v2.score]
  const correct = heroWins[0] && heroWins[1] ? 'both' : heroWins[0] ? 'b1' : heroWins[1] ? 'b2' : 'none'
  return {
    holeCount,
    hero,
    villain,
    boards: [b1, b2],
    heroWins,
    ties,
    correct,
    heroNames: [handName(h1), handName(h2)],
    villainNames: [handName(v1), handName(v2)],
    heroBest: [h1.best, h2.best],
    villainBest: [v1.best, v2.best],
    heroUsesHole: [!playsBoardOnly(hero, b1), !playsBoardOnly(hero, b2)],
    villainUsesHole: [!playsBoardOnly(villain, b1), !playsBoardOnly(villain, b2)],
  }
}

export function genOmahaDoubleQuestion(holeCount: 4 | 5): OmahaDoubleQuestion {
  let best: OmahaDoubleQuestion | null = null
  let bestScore = -1
  for (let t = 0; t < 12; t++) {
    const q = buildOmahaDouble(holeCount, shuffle(fullDeck()))
    const decided = (q.heroWins[0] || q.ties[0] ? 0 : 1) + (q.heroWins[1] || q.ties[1] ? 0 : 1)
    const interest =
      decided * 2 +
      (q.heroUsesHole[0] ? 1 : 0) +
      (q.heroUsesHole[1] ? 1 : 0) +
      (q.correct === 'both' || q.correct === 'none' ? 1 : 0) +
      Math.random() * 2.5
    if (interest > bestScore) {
      bestScore = interest
      best = q
    }
  }
  return best!
}

/** Подпись улицы по количеству карт доски */
export function boardStreetLabel(n: number): string {
  return n === 3 ? 'Флоп' : n === 4 ? 'Терн' : 'Ривер'
}
