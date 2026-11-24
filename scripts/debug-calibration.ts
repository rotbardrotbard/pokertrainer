// Отладка калибровки порогов Омахи
import { ploRangeScore, omahaRangeThreshold } from '../src/lib/poker/handRanges'
import { Card } from '../src/lib/poker/cards'

for (const pct of [5, 15, 30, 50, 75]) {
  const th = omahaRangeThreshold('omaha4', pct)
  let pass = 0
  const N = 30000
  let seed = 555
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    idx.length = 0
    while (idx.length < 4) {
      const v = Math.floor(rnd() * 52)
      if (idx.indexOf(v) < 0) idx.push(v)
    }
    const hand: Card[] = idx.map((v) => ({ r: (v % 13) + 2, s: Math.floor(v / 13) }))
    if (ploRangeScore(hand) >= th) pass++
  }
  console.log(`порог ${pct}%: th=${th.toFixed(1)}, фактическая доля ${((pass / N) * 100).toFixed(1)}%`)
}
