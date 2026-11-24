// Точный расчёт эквити перебором всех turn+river комбинаций
import { parseCard, fullDeck, cardToCode } from '../src/lib/poker/cards'
import { evaluate7 } from '../src/lib/poker/evaluator'

const hero = [parseCard('Qs')!, parseCard('Js')!]
const villain = [parseCard('Ac')!, parseCard('Ad')!]
const board = [parseCard('Ks')!, parseCard('7s')!, parseCard('2d')!]

const known = new Set([...hero, ...villain, ...board].map(cardToCode))
const deck = fullDeck().filter((c) => !known.has(cardToCode(c)))

let win = 0, tie = 0, lose = 0, total = 0
for (let i = 0; i < deck.length; i++) {
  for (let j = i + 1; j < deck.length; j++) {
    const b7h = [...hero, board[0], board[1], board[2], deck[i], deck[j]]
    const b7v = [...villain, board[0], board[1], board[2], deck[i], deck[j]]
    const hs = evaluate7(b7h).score
    const vs = evaluate7(b7v).score
    if (hs > vs) win++
    else if (hs === vs) tie++
    else lose++
    total++
  }
}
console.log(`Exact: win=${((win / total) * 100).toFixed(2)}% tie=${((tie / total) * 100).toFixed(2)}% lose=${((lose / total) * 100).toFixed(2)}% total=${total}`)
