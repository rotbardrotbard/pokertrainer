// Отладка: AA vs фиксированный KQs
import { parseCard, Card, fullDeck, cardToCode } from '../src/lib/poker/cards'
import { simulateEquity } from '../src/lib/poker/equity'
import { evaluate7 } from '../src/lib/poker/evaluator'

const pc = (s: string) => parseCard(s) as Card
const hero = [pc('As'), pc('Ad')]
const vil = [pc('Kh'), pc('Qh')]

// Точная оценка полным перебором (169 выбрать... C(48,5)=1712304 — долго; сделаем MC 200k)
let win = 0, tie = 0, n = 0
const known = new Set([...hero, ...vil].map(cardToCode))
const deck = fullDeck().filter((c) => !known.has(cardToCode(c)))
for (let it = 0; it < 100000; it++) {
  // наивная перетасовка
  for (let i = 0; i < 5; i++) {
    const j = i + Math.floor(Math.random() * (deck.length - i))
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t
  }
  const b = [deck[0], deck[1], deck[2], deck[3], deck[4]]
  const h = evaluate7([...hero, ...b]).score
  const v = evaluate7([...vil, ...b]).score
  if (h > v) win++
  else if (h === v) tie++
  n++
}
console.log(`наивная MC AA vs KQh: ${(100 * (win + tie / 2) / n).toFixed(2)}%`)

const r = simulateEquity({ game: 'holdem', hero, board: [], opponents: 1, iterations: 100000, villainCards: vil })
console.log(`simulateEquity AA vs KQh: ${(100 * (r.win + r.tie / 2)).toFixed(2)}% (win ${(r.win * 100).toFixed(2)}, tie ${(r.tie * 100).toFixed(2)})`)
