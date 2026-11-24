// Тесты симулятора раздач Омахи (2 доски): быстрый оценщик, эквити, генераторы
import { parseCard, Card, fullDeck, shuffle } from '../src/lib/poker/cards'
import { evaluate5, handName } from '../src/lib/poker/evaluator'
import { bestOmahaHand } from '../src/lib/poker/omaha'
import {
  bestOmahaScoreFast, simulateOmahaDouble, analyzePloHand, genOmahaSimScenario,
} from '../src/lib/poker/omahaSim'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}
const pc = (s: string) => parseCard(s) as Card

// Независимая реализация лучшей Омаха-комбинации через evaluate5
function refOmahaScore(hole: Card[], board: Card[]): number {
  let best = -1
  for (let a = 0; a < hole.length - 1; a++) {
    for (let b = a + 1; b < hole.length; b++) {
      for (let c = 0; c < board.length - 2; c++) {
        for (let d = c + 1; d < board.length - 1; d++) {
          for (let e = d + 1; e < board.length; e++) {
            const s = evaluate5([hole[a], hole[b], board[c], board[d], board[e]])
            if (s > best) best = s
          }
        }
      }
    }
  }
  return best
}

// ---------- 1. Быстрый оценщик: известные руки ----------
{
  // Каре тузов: 2 туза руки + 2 туза доски
  const hole = [pc('As'), pc('Ad'), pc('2c'), pc('3c')]
  const board = [pc('Ah'), pc('Ac'), pc('Qd'), pc('Jc'), pc('4h')]
  assert(bestOmahaScoreFast(hole, board) === refOmahaScore(hole, board), 'fast: quad aces')

  // Фулл-хаус
  const h2 = [pc('As'), pc('Ad'), pc('2c'), pc('3c')]
  const b2 = [pc('Kh'), pc('Kd'), pc('Kc'), pc('2h'), pc('3d')]
  assert(bestOmahaScoreFast(h2, b2) === refOmahaScore(h2, b2), 'fast: full house')

  // Стрит до валета (ровно 2 карты руки)
  const h3 = [pc('8h'), pc('7h'), pc('2c'), pc('3c')]
  const b3 = [pc('9d'), pc('Tc'), pc('Jd'), pc('2s'), pc('3c')]
  assert(bestOmahaScoreFast(h3, b3) === refOmahaScore(h3, b3), 'fast: straight')

  // Флеш
  const h4 = [pc('As'), pc('Ks'), pc('2c'), pc('3c')]
  const b4 = [pc('2s'), pc('7s'), pc('Qs'), pc('9d'), pc('9c')]
  assert(bestOmahaScoreFast(h4, b4) === refOmahaScore(h4, b4), 'fast: flush')

  // Колесо-стрит A2345 (стрит через туза-ноль)
  const h5 = [pc('Ah'), pc('4d'), pc('Kc'), pc('Qc')]
  const b5 = [pc('2s'), pc('3s'), pc('5d'), pc('9d'), pc('9c')]
  assert(bestOmahaScoreFast(h5, b5) === refOmahaScore(h5, b5), 'fast: wheel straight')

  // Стрит-флеш
  const h6 = [pc('9h'), pc('8h'), pc('2c'), pc('3c')]
  const b6 = [pc('7h'), pc('6h'), pc('5h'), pc('9d'), pc('9c')]
  assert(bestOmahaScoreFast(h6, b6) === refOmahaScore(h6, b6), 'fast: straight flush')

  // 5-card рука
  const h7 = [pc('Ah'), pc('Kh'), pc('Qh'), pc('Jh'), pc('Th')]
  const b7 = [pc('2h'), pc('3h'), pc('9d'), pc('9s'), pc('9c')]
  assert(bestOmahaScoreFast(h7, b7) === refOmahaScore(h7, b7), 'fast: 5-card trips')

  // Стрит-флеш через колесо в 5-card
  const h8 = [pc('Ah'), pc('Kh'), pc('5s'), pc('4s'), pc('2c')]
  const b8 = [pc('3s'), pc('6d'), pc('9c'), pc('9d'), pc('Jc')]
  assert(bestOmahaScoreFast(h8, b8) === refOmahaScore(h8, b8), 'fast: 5-card wheel SF')
}

// ---------- 2. Случайные раздачи: быстрый == референс ----------
{
  for (let t = 0; t < 500; t++) {
    const deck = shuffle(fullDeck())
    const board = deck.slice(0, 5)
    const b4 = deck.slice(5, 9)
    const b5 = deck.slice(9, 14)
    assert(bestOmahaScoreFast(b4, board) === refOmahaScore(b4, board), `random 4-card #${t}`)
    assert(bestOmahaScoreFast(b5, board) === refOmahaScore(b5, board), `random 5-card #${t}`)
  }
  // доски из 3 и 4 карт
  for (let t = 0; t < 200; t++) {
    const deck = shuffle(fullDeck())
    const b3 = deck.slice(0, 3)
    const b4 = deck.slice(3, 7)
    const hole = deck.slice(7, 11)
    assert(bestOmahaScoreFast(hole, b3) === refOmahaScore(hole, b3), `flop 3 cards #${t}`)
    assert(bestOmahaScoreFast(hole, b4) === refOmahaScore(hole, b4), `turn 4 cards #${t}`)
  }
}

// ---------- 3. simulateOmahaDouble: детерминированные случаи ----------
{
  // Непобедимые руки: натсовые стрит-флеши на обоих бордах (As Ts и Ad Kd в руке,
  // вилл не может собрать выше — As/Ts и Ad/Kd блокированы героем)
  const hero = [pc('As'), pc('Ts'), pc('Ad'), pc('Kd')]
  const b1 = [pc('Ks'), pc('Qs'), pc('Js'), pc('2s'), pc('3d')]
  const b2 = [pc('Kd'), pc('Qd'), pc('Jd'), pc('2d'), pc('3c')]
  const eq = simulateOmahaDouble({ hero, boards: [b1, b2], holeCount: 4, iterations: 400 })
  assert(eq.eq1 === 1 && eq.eq2 === 1, `nut SF on both boards = 100%, got ${eq.eq1}/${eq.eq2}`)
  assert(eq.total === 1, 'total = 1')

  // Рука без совпадений с досками мусорная → низкое эквити
  const junk = [pc('2c'), pc('3d'), pc('7s'), pc('9h')]
  const bb1 = [pc('Ah'), pc('Ac'), pc('Qd'), pc('Jc'), pc('4h')]
  const bb2 = [pc('Kh'), pc('Kd'), pc('Kc'), pc('2h'), pc('3d')]
  const eq2 = simulateOmahaDouble({ hero: junk, boards: [bb1, bb2], holeCount: 4, iterations: 600 })
  assert(eq2.eq1 < 0.25 && eq2.eq2 < 0.25, `junk vs AA/KKK low equity, got ${eq2.eq1}/${eq2.eq2}`)

  // 5-card: сильная связка A-K-Q-J-T одной масти на монотонной доске
  const h5 = [pc('Ah'), pc('Kh'), pc('Qh'), pc('Jh'), pc('Th')]
  const c1 = [pc('2h'), pc('3h'), pc('9h'), pc('4d'), pc('4s')]
  const c2 = [pc('7d'), pc('7c'), pc('7s'), pc('9h'), pc('9d')]
  const eq3 = simulateOmahaDouble({ hero: h5, boards: [c1, c2], holeCount: 5, iterations: 500 })
  // Доска 1: флеш с 2h3h9h + 2 руки → очень часто выигрывает; Доска 2: сет семёрок доской
  assert(eq3.eq1 > 0.7, `nut flush draw board eq1 > 0.7, got ${eq3.eq1.toFixed(2)}`)
  assert(eq3.eq2 < 0.4, `second board (777) eq2 < 0.4, got ${eq3.eq2.toFixed(2)}`)
}

// ---------- 4. Профили стартовых рук ----------
{
  const aaDS = analyzePloHand([pc('Ah'), pc('Kh'), pc('As'), pc('Ks')])
  assert(aaDS.aces === 2, 'AA aces = 2')
  assert(aaDS.suitedCount === 2, 'AA double suited')
  assert(aaDS.score >= 60, `AA ds score high, got ${aaDS.score}`)

  const broadway = analyzePloHand([pc('Ah'), pc('Kc'), pc('Qd'), pc('Js')])
  assert(broadway.runLen === 4, `AKQJ runLen 4, got ${broadway.runLen}`)
  assert(broadway.runText === 'A-K-Q-J', `run text, got ${broadway.runText}`)

  const rundown = analyzePloHand([pc('9h'), pc('Td'), pc('Jc'), pc('8s')])
  assert(rundown.runLen === 4, `8-9-T-J runLen 4, got ${rundown.runLen}`)

  const wheelWrap = analyzePloHand([pc('Ah'), pc('2d'), pc('3c'), pc('Ks')])
  assert(wheelWrap.runLen === 3, `A23 runLen 3 (A as 1), got ${wheelWrap.runLen}`)

  const junk = analyzePloHand([pc('2h'), pc('7d'), pc('9c'), pc('Ks')])
  const junk5 = analyzePloHand([pc('2h'), pc('7d'), pc('9c'), pc('Ks'), pc('3d')])
  assert(junk.score < 45, `junk low score, got ${junk.score}`)
  assert(junk5.score < 55, '5-card junk lowish')

  const trips = analyzePloHand([pc('Ah'), pc('Ad'), pc('Ac'), pc('Ks')])
  assert(trips.pairRank === null && trips.features.some((f) => f.includes('мёртвый вес')), 'trips flagged')
  assert(trips.score < aaDS.score, 'trips weaker than AA ds')
}

// ---------- 5. Генераторы сценариев: целостность ----------
function hasDuplicates(cards: Card[]): boolean {
  const seen = new Set<string>()
  for (const c of cards) {
    const k = c.r + '-' + c.s
    if (seen.has(k)) return true
    seen.add(k)
  }
  return false
}

{
  for (let t = 0; t < 60; t++) {
    for (const hc of [4, 5] as const) {
      const s = genOmahaSimScenario(hc)
      assert(s.hero.length === hc, `hole count ${hc}`)
      if (s.kind === 'postflop') {
        assert(!hasDuplicates([...s.hero, ...s.boards![0], ...s.boards![1]]), `postflop dup #${t}`)
        assert(s.sim !== null && s.heroHands !== null && s.heroBest !== null, 'postflop fields')
        assert(s.boards![0].length >= 3 && s.boards![1].length >= 3, 'board sizes')
        // названия комбинаций пересчитываем независимо
        const n1 = handName(bestOmahaHand(s.hero, s.boards![0]))
        const n2 = handName(bestOmahaHand(s.hero, s.boards![1]))
        assert(s.heroHands![0] === n1 && s.heroHands![1] === n2, `heroHands match #${t}`)
        // эквити в разумных пределах
        assert(s.sim!.total > 0 && s.sim!.total < 1, 'equity range')
        // правильное действие согласовано с эквити и пот-оддсами
        const req = s.bet / (s.pot + 2 * s.bet)
        const expected: 'fold' | 'call' | 'raise' = s.sim!.total >= req + 0.14 ? 'raise' : s.sim!.total >= req + 0.01 ? 'call' : 'fold'
        assert(s.correctAction === expected, `postflop action match #${t}: ${s.correctAction} vs ${expected}`)
      } else {
        assert(s.boards === null && s.sim === null, 'preflop no boards')
        const p = s.profile
        if (s.kind === 'open') {
          const th = { UTG: 58, MP: 52, CO: 46, BTN: 40, SB: 46 }[s.position as string]!
          const expected = p.score >= th ? 'raise' : 'fold'
          assert(s.correctAction === expected, `open action #${t}`)
        } else {
          const expected = p.score >= 62 ? 'raise' : p.score >= 46 ? 'call' : 'fold'
          assert(s.correctAction === expected, `vsRaise action #${t}`)
        }
      }
      assert(!hasDuplicates(s.hero) || true, 'hero no dups')
      assert(!hasDuplicates(s.hero), 'hero cards unique')
    }
  }
}

// ---------- 6. Производительность ----------
{
  const t0 = Date.now()
  let ms = 0
  for (let i = 0; i < 5; i++) {
    const t1 = Date.now()
    genOmahaSimScenario(4)
    genOmahaSimScenario(5)
    const dt = Date.now() - t1
    ms = Math.max(ms, dt)
  }
  console.log(`Максимальное время генерации сценария: ${ms} мс`)
  assert(ms < 1500, 'scenario generation performance')
  const total = Date.now() - t0
  console.log(`10 сценариев за ${total} мс`)
}

// ---------- 7. Быстрый оценщик быстрее evaluate5-референса ----------
{
  const deck = shuffle(fullDeck())
  const hole = deck.slice(0, 4)
  const board = deck.slice(4, 9)
  const N = 20000
  const t0 = Date.now()
  for (let i = 0; i < N; i++) bestOmahaScoreFast(hole, board)
  const fast = Date.now() - t0
  const t1 = Date.now()
  for (let i = 0; i < N; i++) refOmahaScore(hole, board)
  const slow = Date.now() - t1
  console.log(`Оценщик: fast ${fast} мс vs ref ${slow} мс на ${N} вызовах (${(slow / fast).toFixed(0)}x)`)
  assert(fast < slow, 'fast version is faster')
}

if (failures === 0) {
  console.log('OK: все тесты симулятора Омахи пройдены')
} else {
  console.error(`Провалено проверок: ${failures}`)
  process.exit(1)
}
