// Оценщик Омахи: ровно 2 карты из руки + ровно 3 карты с доски.
// Поддерживает 4-card и 5-card Омаху (в 5-card руке C(5,2)=10 пар руки).
import { Card } from './cards'
import { evaluate5 } from './evaluator'
import { HandResult, scoreCategory } from './evaluator'

/** Лучшие 5 карт из произвольного набора (перебор сочетаний). Для проверки «играет ли игрок доской». */
export function bestHandFromCards(cards: Card[]): HandResult | null {
  if (cards.length < 5) return null
  const idx = [0, 1, 2, 3, 4]
  let best: HandResult | null = null
  const n = cards.length
  // перебор всех сочетаний 5 из n
  function rec(start: number, depth: number) {
    if (depth === 5) {
      const five = idx.map((i) => cards[i])
      const score = evaluate5(five)
      if (!best || score > best.score) best = { score, cat: scoreCategory(score), best: five }
      return
    }
    for (let i = start; i <= n - (5 - depth); i++) {
      idx[depth] = i
      rec(i + 1, depth + 1)
    }
  }
  rec(0, 0)
  return best
}

/**
 * Лучшая Омаха-комбинация: перебираем все пары карт руки × все тройки карт доски.
 * Правило Омахи: используется ровно 2 карты руки и ровно 3 с доски.
 */
export function bestOmahaHand(hole: Card[], board: Card[]): HandResult {
  if (hole.length < 2 || board.length < 3) throw new Error('Omaha needs ≥2 hole cards and ≥3 board cards')
  let best: HandResult | null = null
  const five: Card[] = new Array(5)
  for (let a = 0; a < hole.length - 1; a++) {
    for (let b = a + 1; b < hole.length; b++) {
      five[0] = hole[a]
      five[1] = hole[b]
      for (let c = 0; c < board.length - 2; c++) {
        for (let d = c + 1; d < board.length - 1; d++) {
          for (let e = d + 1; e < board.length; e++) {
            five[2] = board[c]
            five[3] = board[d]
            five[4] = board[e]
            const score = evaluate5([five[0], five[1], five[2], five[3], five[4]])
            if (!best || score > best.score) {
              best = { score, cat: scoreCategory(score), best: [five[0], five[1], five[2], five[3], five[4]] }
            }
          }
        }
      }
    }
  }
  return best!
}

/** Играет ли игрок только доской (рука не улучшает лучший 5-карточный набор). Только для доски из 5 карт. */
export function playsBoardOnly(hole: Card[], board: Card[]): boolean {
  if (board.length !== 5) return false
  const boardOnly = bestHandFromCards(board)
  if (!boardOnly) return false
  return bestOmahaHand(hole, board).score === boardOnly.score
}
