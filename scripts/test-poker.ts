// Тесты покерного движка: evaluator, equity, outs, ranges
import { fullDeck, shuffle, parseCard, cardToString } from '../src/lib/poker/cards'
import { evaluate7, evaluate7BruteForce, evaluate5, handName, scoreCategory } from '../src/lib/poker/evaluator'
import { simulateEquity, countOuts } from '../src/lib/poker/equity'
import {
  openRangeClasses, rangePercent, topPercentClasses, handClass, vsRaiseClasses,
  allHandClasses, chenScore, orderedClasses,
} from '../src/lib/poker/ranges'
import {
  genMathQuestion, genRatioQuestion, genOutsQuestion, genEvQuestion,
  genWinnerQuestion, genComboQuestion, genOpenScenario, genVsRaiseScenario,
  genPostflopScenario, genSimScenario, checkMathAnswer,
} from '../src/lib/poker/training'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}

// ---------- 1. Парсер и форматирование ----------
{
  const c = parseCard('As')!
  assert(c.r === 14 && c.s === 0, 'parseCard As')
  const c2 = parseCard('Th')!
  assert(c2.r === 10 && c2.s === 1, 'parseCard Th')
  assert(cardToString(c) === 'A♠', 'cardToString A♠')
}

// ---------- 2. Оценщик: известные руки ----------
function evalScore(strs: string[]): number {
  return evaluate7(strs.map(parseCard!)).score
}
{
  // Роял-флеш
  const rf = ['As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d']
  assert(scoreCategory(evalScore(rf)) === 8, 'royal flush cat 8')
  // Стрит-флеш 5..9
  const sf = ['5s', '6s', '7s', '8s', '9s', '2h', '3d']
  assert(scoreCategory(evalScore(sf)) === 8, 'straight flush cat 8')
  // Каре
  const quads = ['As', 'Ah', 'Ad', 'Ac', 'Ks', '2h', '3d']
  assert(scoreCategory(evalScore(quads)) === 7, 'quads cat 7')
  // Фулл-хаус
  const fh = ['As', 'Ah', 'Ad', 'Ks', 'Kh', '2h', '3d']
  assert(scoreCategory(evalScore(fh)) === 6, 'full house cat 6')
  // Флеш
  const fl = ['As', 'Js', '9s', '7s', '3s', 'Kh', '3d']
  assert(scoreCategory(evalScore(fl)) === 5, 'flush cat 5')
  // Стрит (через туза вверх)
  const st = ['As', 'Kh', 'Qs', 'Jd', 'Ts', '2h', '3d']
  assert(scoreCategory(evalScore(st)) === 4, 'broadway cat 4')
  // Колесо A2345
  const wheel = ['As', '2h', '3s', '4d', '5s', 'Kh', 'Kd']
  assert(scoreCategory(evalScore(wheel)) === 4, 'wheel cat 4')
  // Сет
  const trips = ['As', 'Ah', 'Ad', 'Ks', 'Qh', '2h', '3d']
  assert(scoreCategory(evalScore(trips)) === 3, 'trips cat 3')
  // Две пары
  const tp = ['As', 'Ah', 'Kd', 'Kh', 'Qs', '2h', '3d']
  assert(scoreCategory(evalScore(tp)) === 2, 'two pair cat 2')
  // Пара
  const p = ['As', 'Ah', 'Kd', 'Qh', '9s', '2h', '3d']
  assert(scoreCategory(evalScore(p)) === 1, 'pair cat 1')
  // Старшая карта
  const hc = ['As', 'Kh', '9d', '7h', '5s', '2h', '3d']
  assert(scoreCategory(evalScore(hc)) === 0, 'high card cat 0')

  // Иерархия категорий
  const scores = [rf, sf, quads, fh, fl, st, trips, tp, p, hc].map(evalScore)
  for (let i = 0; i < scores.length - 1; i++) {
    // rf/sf одинаковы по категории, но rf выше
    if (i === 0) continue
    assert(scores[i] > scores[i + 1], `rank order ${i}: ${scores[i]} > ${scores[i + 1]}`)
  }
  assert(scores[0] > scores[1], 'royal > lower straight flush')
}

// ---------- 3. Оценщик vs brute-force на случайных раздачах ----------
{
  let mismatches = 0
  for (let i = 0; i < 20000; i++) {
    const deck = shuffle(fullDeck())
    const seven = deck.slice(0, 7)
    const fast = evaluate7(seven).score
    const slow = evaluate7BruteForce(seven)
    if (fast !== slow) {
      mismatches++
      if (mismatches <= 5) {
        console.error('MISMATCH:', seven.map(cardToString).join(' '), 'fast', fast, 'slow', slow)
      }
    }
  }
  assert(mismatches === 0, `evaluate7 == brute force (mismatches: ${mismatches})`)
}

// ---------- 4. best-five корректен (5 карт, совпадает по категории) ----------
{
  for (let i = 0; i < 3000; i++) {
    const deck = shuffle(fullDeck())
    const seven = deck.slice(0, 7)
    const res = evaluate7(seven)
    if (res.best.length !== 5) {
      assert(false, `best.length = ${res.best.length}`)
      break
    }
    if (evaluate5(res.best) !== res.score) {
      assert(false, `best5 rescore mismatch: ${seven.map(cardToString).join(' ')}`)
      break
    }
  }
  console.log('best-five checked')
}

// ---------- 5. Названия рук на русском ----------
{
  const n1 = handName(evaluate7(['As', 'Ah', 'Ad', 'Ac', 'Ks', '2h', '3d'].map(parseCard!)))
  assert(n1 === 'Каре тузов', `handName quads: ${n1}`)
  const n2 = handName(evaluate7(['As', 'Ah', 'Ad', 'Ks', 'Kh', '2h', '3d'].map(parseCard!)))
  assert(n2 === 'Фулл-хаус: тузов и королей', `handName full house: ${n2}`)
  const n3 = handName(evaluate7(['As', 'Ah', 'Kd', 'Kh', 'Qs', '2h', '3d'].map(parseCard!)))
  assert(n3 === 'Две пары: тузов и королей', `handName two pair: ${n3}`)
  const n4 = handName(evaluate7(['As', 'Kh', 'Qs', 'Jd', 'Ts', '2h', '3d'].map(parseCard!)))
  assert(n4 === 'Стрит до туза (Бродвей)', `handName broadway: ${n4}`)
  const n5 = handName(evaluate7(['As', '2h', '3s', '4d', '5s', 'Kh', 'Kd'].map(parseCard!)))
  assert(n5 === 'Колесо (5-4-3-2-A)', `handName wheel: ${n5}`)
  const n6 = handName(evaluate7(['Ks', 'Qh', 'Js', '9d', 'Th', '2h', '3d'].map(parseCard!)))
  assert(n6 === 'Стрит до короля', `handName K-straight: ${n6}`)
  const n7 = handName(evaluate7(['9s', 'Ts', 'Js', 'Qs', 'Ks', '2h', '3d'].map(parseCard!)))
  assert(n7 === 'Стрит-флеш до короля', `handName SF: ${n7}`)
  const n8 = handName(evaluate7(['As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d'].map(parseCard!)))
  assert(n8 === 'Флеш-рояль', `handName royal: ${n8}`)
}

// ---------- 6. Эквити: санити-проверки ----------
{
  const AA = [parseCard('As')!, parseCard('Ah')!]
  const eqAA = simulateEquity({ hero: AA, board: [], opponents: 1, iterations: 5000 })
  console.log('AA vs random:', (eqAA.win * 100).toFixed(1) + '% win,', (eqAA.tie * 100).toFixed(1) + '% tie')
  assert(eqAA.win > 0.80 && eqAA.win < 0.89, 'AA equity ~85%')

  const AK = [parseCard('As')!, parseCard('Kh')!]
  const eqAK = simulateEquity({ hero: AK, board: [], opponents: 1, iterations: 5000 })
  console.log('AK vs random:', (eqAK.win * 100).toFixed(1) + '%')
  assert(eqAK.win > 0.60 && eqAK.win < 0.70, 'AK equity ~65%')

  const eq72 = simulateEquity({ hero: [parseCard('7s')!, parseCard('2h')!], board: [], opponents: 1, iterations: 5000 })
  console.log('72o vs random:', (eq72.win * 100).toFixed(1) + '%')
  assert(eq72.win > 0.28 && eq72.win < 0.42, '72o equity ~35%')

  // 2 оппонента: эквити падает
  const eqAA2 = simulateEquity({ hero: AA, board: [], opponents: 2, iterations: 5000 })
  console.log('AA vs 2:', (eqAA2.win * 100).toFixed(1) + '%')
  assert(eqAA2.win > 0.55 && eqAA2.win < 0.75, 'AA vs 2 ~63%')

  // фиксированный виллиан: AA vs KK ≈ 81-82%
  const eqAAKK = simulateEquity({
    hero: AA, board: [], opponents: 1, iterations: 5000,
    villainCards: [parseCard('Ks')!, parseCard('Kh')!],
  })
  console.log('AA vs KK:', ((eqAAKK.win + eqAAKK.tie) * 100).toFixed(1) + '% (win+tie)')
  assert(eqAAKK.win > 0.78 && eqAAKK.win < 0.85, 'AA vs KK ~81%')

  // с флопом: флеш-дро vs пара тузов ≈ 22-26% (9 аутсов + бэкдоры)
  const drawEq = simulateEquity({
    hero: [parseCard('Qs')!, parseCard('Js')!],
    board: [parseCard('Ks')!, parseCard('7s')!, parseCard('2d')!],
    opponents: 1,
    iterations: 5000,
    villainCards: [parseCard('Ac')!, parseCard('Ad')!],
  })
  console.log('flush draw vs AA (two pair):', (drawEq.win * 100).toFixed(1) + '%')
  // точное значение 37.78% (перебор всех 990 выходов)
  assert(drawEq.win > 0.30 && drawEq.win < 0.42, 'flush draw vs AA ~37.8%')
}

// ---------- 7. Аутсы (структурированные классические сценарии) ----------
{
  // Флеш-дро QsJs / Ks 7s 2d vs AcAd → ровно 9 аутсов
  const r1 = countOuts(
    [parseCard('Qs')!, parseCard('Js')!],
    [parseCard('Ac')!, parseCard('Ad')!],
    [parseCard('Ks')!, parseCard('7s')!, parseCard('2d')!],
  )
  console.log('flush draw outs:', r1.outs.length, 'heroAhead:', r1.heroAheadNow)
  assert(r1.outs.length === 9, `flush draw outs = 9, got ${r1.outs.length}`)
  assert(!r1.heroAheadNow, 'flush draw hero behind')

  // OESD JhTh / 8c 9d 2s vs 9h9s (сет) → ровно 8
  const r2 = countOuts(
    [parseCard('Jh')!, parseCard('Th')!],
    [parseCard('9h')!, parseCard('9s')!],
    [parseCard('8c')!, parseCard('9d')!, parseCard('2s')!],
  )
  console.log('OESD outs (vs set 9):', r2.outs.length)
  assert(r2.outs.length === 8, `OESD outs = 8, got ${r2.outs.length}`)

  // Гатшот 8h7h / Td Jc 2s vs QdQc → ровно 4
  const r3 = countOuts(
    [parseCard('8h')!, parseCard('7h')!],
    [parseCard('Qd')!, parseCard('Qc')!],
    [parseCard('Td')!, parseCard('Jc')!, parseCard('2s')!],
  )
  console.log('gutshot outs:', r3.outs.length)
  assert(r3.outs.length === 4, `gutshot outs = 4, got ${r3.outs.length}`)
}

// ---------- 8. Диапазоны ----------
{
  for (const pos of ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'] as const) {
    const r = openRangeClasses(pos)
    const pct = rangePercent(r)
    console.log(`open ${pos}: ${pct.toFixed(1)}%`)
  }
  const utg = rangePercent(openRangeClasses('UTG'))
  assert(utg > 12 && utg < 18, `UTG open ~14%, got ${utg.toFixed(1)}`)
  const btn = rangePercent(openRangeClasses('BTN'))
  assert(btn > 40 && btn < 50, `BTN open ~45%, got ${btn.toFixed(1)}`)
  const top30 = topPercentClasses(30)
  console.log('top30%:', rangePercent(top30).toFixed(1) + '%')
  assert(rangePercent(top30) > 28 && rangePercent(top30) < 32, 'top30 ≈ 30%')

  const { threeBet, call } = vsRaiseClasses('BTN')
  assert(threeBet.has('AA') && threeBet.has('AKs'), '3bet range has AA, AKs')
  assert(call.has('T9s') && !call.has('AA'), 'call range has T9s, not AA')

  // Чен: порядок рук разумный
  assert(chenScore('AA') >= chenScore('KK'), 'AA >= KK')
  assert(chenScore('AKs') > chenScore('72o'), 'AKs > 72o')
  const ordered = orderedClasses()
  assert(ordered[0] === 'AA', `first ordered class = ${ordered[0]}`)
}

// ---------- 9. Генераторы вопросов ----------
{
  for (let i = 0; i < 200; i++) {
    const q = genMathQuestion()
    assert(q.requiredPct > 0 && q.requiredPct < 100, 'math required in (0,100)')
    // проверка формулы: колл при точно requiredPct — правильный ответ
    assert(checkMathAnswer(q, q.requiredPct), 'own answer passes')
    const q2 = genRatioQuestion()
    assert(q2.requiredPct > 0 && q2.requiredPct <= 67, 'ratio answer range')
  }
  console.log('math questions OK')

  let outsOk = 0
  const seenCounts = new Set<number>()
  for (let i = 0; i < 60; i++) {
    const q = genOutsQuestion()
    assert([9, 8, 4].includes(q.outsCount), `classic outs count 9/8/4: got ${q.outsCount}`)
    assert(q.hero.length === 2 && q.villain.length === 2, 'outs deal sizes')
    assert(!q.heroAheadNow, 'hero behind in outs scenario')
    seenCounts.add(q.outsCount)
    if (q.outsCount >= 6) outsOk++
  }
  console.log('outs questions OK, seen counts:', [...seenCounts].join(','))

  for (let i = 0; i < 200; i++) {
    const q = genEvQuestion()
    const expected = q.equityPct / 100 > q.bet / (q.pot + 2 * q.bet) ? 'call' : 'fold'
    assert(q.correctAction === expected, `EV action matches threshold: eq=${q.equityPct} req=${((q.bet / (q.pot + 2 * q.bet)) * 100).toFixed(1)}`)
  }
  console.log('EV questions OK')

  for (let i = 0; i < 100; i++) {
    const q = genWinnerQuestion()
    const heroRes = evaluate7([...q.hero, ...q.board])
    const vilRes = evaluate7([...q.villain, ...q.board])
    const expected = heroRes.score > vilRes.score ? 'hero' : heroRes.score < vilRes.score ? 'villain' : 'tie'
    assert(q.correct === expected, 'winner correctness')
    assert(q.heroBest.length === 5 && q.villainBest.length === 5, 'winner best5 sizes')
  }
  console.log('winner questions OK')

  for (let i = 0; i < 100; i++) {
    const q = genComboQuestion()
    assert(q.correctCat >= 0 && q.correctCat <= 8, 'combo cat range')
  }
  console.log('combo questions OK')

  // Симулятор: генерируется и решение согласовано
  for (let i = 0; i < 30; i++) {
    const s = genSimScenario()
    assert(s.correctAction === 'fold' || s.correctAction === 'call' || s.correctAction === 'raise', 'sim action valid')
    assert(s.explanation.length > 10, 'sim explanation present')
  }
  const opens = [genOpenScenario(), genOpenScenario(), genOpenScenario(), genOpenScenario(), genOpenScenario(), genOpenScenario()]
  console.log('open scenarios generated:', opens.map((o) => `${o.correctAction}`).join(','))
  const posts = [genPostflopScenario(), genPostflopScenario(), genPostflopScenario()]
  console.log('postflop actions:', posts.map((p) => p.correctAction).join(','), 'equity detail:', posts[0].detail[0])
}

// ---------- 10. Производительность эквити ----------
{
  const set = topPercentClasses(30)
  const t2 = performance.now()
  const sim = simulateEquity({
    hero: [parseCard('As')!, parseCard('Kd')!],
    board: [parseCard('7h')!, parseCard('2c')!, parseCard('9s')!],
    opponents: 1, iterations: 20000,
    villainFilter: (h) => set.has(handClass(h[0], h[1])),
  })
  const t3 = performance.now()
  console.log(`cached range-filtered 20000-iter sim: ${(t3 - t2).toFixed(0)}ms, win=${(sim.win * 100).toFixed(1)}%`)
}

console.log(failures === 0 ? '\n=== ALL TESTS PASSED ===' : `\n=== ${failures} FAILURES ===`)
process.exit(failures === 0 ? 0 : 1)
