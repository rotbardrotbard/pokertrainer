// Отладка состава диапазона Омахи
import { parseCard, Card, RANK_CHARS } from '../src/lib/poker/cards'
import { ploRangeScore, omahaRangeThreshold, sampleRangeHands } from '../src/lib/poker/handRanges'

const th = omahaRangeThreshold('omaha4', 20)
console.log(`порог топ-20% omaha4: ${th.toFixed(1)}`)

// конкретные руки
const cases: Array<[string, string[]]> = [
  ['AAKQ ds', ['Ah', 'Ad', 'Kh', 'Qd']],
  ['AA72 rainbow', ['Ah', 'Ad', '7s', '2c']],
  ['TJQK ds', ['Th', 'Jh', 'Qd', 'Kd']],
  ['AKQJ rainbow', ['Ah', 'Ks', 'Qd', 'Jc']],
  ['AKQ2 ds', ['Ah', 'Kh', 'Qd', '2d']],
  ['KQJ9 ds', ['Kh', 'Qh', 'Jd', '9d']],
  ['5432 ds', ['5h', '4h', '3d', '2d']],
  ['KKQJ ds', ['Kh', 'Kd', 'Qh', 'Jd']],
  ['KQJ9 rainbow', ['Kh', 'Qs', 'Jd', '9c']],
  ['9876 ds', ['9h', '8h', '7d', '6d']],
  ['AKQ2 rainbow', ['Ah', 'Ks', 'Qd', '2c']],
  ['QQJT ds', ['Qh', 'Qd', 'Jh', 'Td']],
  ['AAKJ ds', ['Ah', 'Ad', 'Kh', 'Jd']],
  ['8876 ds', ['8h', '8d', '7h', '6d']],
  ['AJT8 mono', ['Ah', 'Jh', 'Th', '8d']],
  ['A345 ds', ['Ah', '3h', '4d', '5d']],
]
for (const [name, cs] of cases) {
  const hand = cs.map((c) => parseCard(c) as Card)
  console.log(`${name.padEnd(14)} = ${ploRangeScore(hand).toFixed(1)}`)
}

// примеры из диапазона
console.log('\nПримеры из топ-20%:')
for (const h of sampleRangeHands('omaha4', 20, 12, 123)) {
  console.log('  ' + h.map((c) => RANK_CHARS[c.r - 2] + 'shdc'[c.s]).join(' ') + ` = ${ploRangeScore(h).toFixed(0)}`)
}
