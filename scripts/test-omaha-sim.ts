// Тесты симулятора раздач Омахи (2 доски): быстрый оценщик, эквити, генераторы
import { parseCard, Card, fullDeck, shuffle } from '../src/lib/poker/cards'
import { evaluate5, handName } from '../src/lib/poker/evaluator'
import { bestOmahaHand } from '../src/lib/poker/omaha'
import {
  bestOmahaScoreFast, simulateOmahaDouble, analyzePloHand, genOmahaSimScenario, genOmahaSimExam,
  advanceOmahaSimStreet,
} from '../src/lib/poker/omahaSim'
import { omahaPreflop, omahaAction, omahaActionFreqs, omahaEquityTier } from '../src/lib/poker/gto'
import { dominantAction, isMixed } from '../src/lib/poker/ranges'
import { omahaHandPercentile, handInRange } from '../src/lib/poker/handRanges'

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
  // Непобедимые руки: натсовый роял на доске 1 (As Ts + Ks Qs Js),
  // на доске 2 — A-флеш (Ad Kd + Qd 2d 7d): тузы/короли пик и бубен блокированы героем,
  // стрит-флеш на доске 2 невозможен (нет 3 подряд бубён в сочетании с 2 картами вилла)
  const hero = [pc('As'), pc('Ts'), pc('Ad'), pc('Kd')]
  const b1 = [pc('Ks'), pc('Qs'), pc('Js'), pc('2s'), pc('3d')]
  const b2 = [pc('Kd'), pc('Qd'), pc('2d'), pc('7d'), pc('3c')]
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
  let flopN = 0
  for (let t = 0; t < 60; t++) {
    for (const hc of [4, 5] as const) {
      const s = genOmahaSimScenario(hc)
      assert(s.hero.length === hc, `hole count ${hc}`)
      if (s.kind === 'postflop') {
        assert(!hasDuplicates([...s.hero, ...s.boards![0], ...s.boards![1]]), `postflop dup #${t}`)
        assert(s.sim !== null && s.heroHands !== null && s.heroBest !== null, 'postflop fields')
        assert(s.chart === null && s.handPct === null, 'postflop no chart')
        assert(s.gtoHint !== null && s.gtoHint.length > 0, 'postflop gtoHint')
        // тренировка начинается с двух флопов: доски синхронны, полные доски сданы заранее
        assert(
          s.boards![0].length === 3 && s.boards![1].length === 3,
          `training postflop starts at flop #${t}: ${s.boards![0].length}/${s.boards![1].length}`,
        )
        assert(
          s.fullBoards !== undefined && s.fullBoards !== null
          && s.fullBoards![0].length === 5 && s.fullBoards![1].length === 5,
          `fullBoards 5+5 #${t}`,
        )
        // стартовые доски — префиксы полных
        const pref = (full: Card[], seen: Card[]) => seen.every((c, i) => full[i].r === c.r && full[i].s === c.s)
        assert(pref(s.fullBoards![0], s.boards![0]) && pref(s.fullBoards![1], s.boards![1]), `flop is prefix of fullBoards #${t}`)
        // подпись улицы в промпте соответствует длине досок
        assert(s.prompt.startsWith('Флоп.'), `street label matches board size #${t}: ${s.prompt.slice(0, 12)}`)
        flopN++
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
        assert(s.chart !== null && s.handPct !== null, `preflop chart fields #${t}`)
        assert(s.gtoHint === null, 'preflop no gtoHint')
        assert(s.players >= 2 && s.players <= 9, `table size valid #${t}`)
        assert(s.handPct! >= 1 && s.handPct! <= 100, `percentile range #${t}`)
        const game = hc === 4 ? 'omaha4' : 'omaha5'
        const situation = s.kind === 'open' ? 'open' : 'vsraise'
        // правильное действие согласовано с GTO-чартом позиции: генератор берёт доминанту смешанных частот
        const sfreqs = omahaActionFreqs(game, s.hero, s.chart!, situation)
        const expected = dominantAction(sfreqs)
        assert(s.correctAction === expected, `preflop action match ${s.kind} #${t}`)
        // бинарное действие чарта обязано совпадать с доминантой для чистых (не смешанных) рук;
        // у смешанных рук у границы диапазона допускается расхождение (зона плавного смешения)
        const binary = omahaAction(game, s.hero, s.chart!, situation)
        if (!isMixed(sfreqs)) assert(s.correctAction === binary, `binary match outside mix band ${s.kind} #${t}`)
        // чарт соответствует параметрам позиции/стола/ситуации
        const ref = omahaPreflop(game, s.position, s.players, situation, 0, s.raiser)
        if (s.kind === 'open') {
          assert(s.chart!.openPercent === ref.openPercent, `open chart matches #${t}`)
          assert(Math.round(s.chart!.openPercent) !== 0, 'open percent nonzero')
        } else {
          assert(s.chart!.callPercent === ref.callPercent, `vsraise chart matches #${t}`)
          assert(s.chart!.threeBetPercent <= s.chart!.callPercent, '3bet tighter than call')
        }
        // согласованность percentile с диапазоном (допуск на округление)
        const inRange = s.kind === 'open'
          ? s.correctAction === 'raise'
          : s.correctAction !== 'fold'
        const rangePct = s.kind === 'open' ? s.chart!.openPercent : s.chart!.callPercent
        if (inRange) assert(s.handPct! <= rangePct + 3, `handPct consistent for in-range #${t}: ${s.handPct} vs ${rangePct}`)
        else assert(s.handPct! >= rangePct - 3, `handPct consistent for out-of-range #${t}: ${s.handPct} vs ${rangePct}`)
      }
      assert(!hasDuplicates(s.hero) || true, 'hero no dups')
      assert(!hasDuplicates(s.hero), 'hero cards unique')
    }
  }
  console.log(`Постфлоп-раздачи начинаются с двух флопов: ${flopN} из 120 сценариев`)
  assert(flopN > 0, 'postflop scenarios generated')
}

// ---------- 5b. omahaHandPercentile: место руки «топ X%» ----------
{
  const aaKK = [pc('Ah'), pc('As'), pc('Kh'), pc('Kd')]
  const junk = [pc('2h'), pc('7d'), pc('9c'), pc('3s')]
  const pAA = omahaHandPercentile('omaha4', aaKK)
  const pJunk = omahaHandPercentile('omaha4', junk)
  assert(pAA <= 10, `AAKK ds in top 10%, got ${pAA}`)
  assert(pJunk >= 60, `2379 junk worse than top 60%, got ${pJunk}`)
  assert(pAA < pJunk, 'stronger hand -> better percentile')

  const pAA5 = omahaHandPercentile('omaha5', [pc('Ah'), pc('Kh'), pc('Qh'), pc('Js'), pc('Ad')])
  const pJunk5 = omahaHandPercentile('omaha5', [...junk, pc('6d')])
  assert(pAA5 <= 10, `5-card premium rundown top 10%, got ${pAA5}`)
  assert(pAA5 < pJunk5, 'omaha5 percentile monotonic')
  // трипс в руке в 5-card Омахе — «мёртвый вес»: слабее премиум-связки
  const trips5 = omahaHandPercentile('omaha5', [pc('Ah'), pc('As'), pc('Kh'), pc('Kd'), pc('Kc')])
  assert(trips5 > pAA5, `AAKKK in hand weaker than premium rundown, got ${trips5} vs ${pAA5}`)

  // согласованность percentile с handInRange на случайной выборке (допуск на округление)
  for (let t = 0; t < 300; t++) {
    const deck = shuffle(fullDeck())
    const hand = deck.slice(0, 4)
    const pct = omahaHandPercentile('omaha4', hand)
    for (const rp of [10, 30, 50]) {
      const inRange = handInRange('omaha4', hand, rp)
      if (inRange) assert(pct <= rp + 3, `in-range ${rp}% but pct ${pct}`)
      else assert(pct >= rp - 3, `out-of-range ${rp}% but pct ${pct}`)
    }
  }
  console.log(`Percentile: AAKK ds → топ ${pAA}%, junk 2379 → топ ${pJunk}% (omaha4); 5-card: ${pAA5}% / ${pJunk5}%`)
}

// ---------- 5c. omahaEquityTier: тиры постфлоп-чарта ----------
{
  for (const game of ['omaha4', 'omaha5'] as const) {
    for (const street of ['flop', 'turn', 'river'] as const) {
      const tRaise = omahaEquityTier(game, street, 'raise')
      const tCall = omahaEquityTier(game, street, 'call')
      const tFold = omahaEquityTier(game, street, 'fold')
      assert(tRaise.action === 'bet', `${game}:${street} raise tier = bet`)
      assert(tCall.action === 'call', `${game}:${street} call tier = call`)
      assert(tFold.action === 'fold', `${game}:${street} fold tier = fold`)
      assert(tRaise.tier.length > 0 && tCall.tier.length > 0 && tFold.tier.length > 0, 'tiers have titles')
    }
  }
}

// ---------- 5d. Режим экзамена: состав и целостность ----------
{
  for (const hc of [4, 5] as const) {
    for (const len of [5, 10, 20] as const) {
      const exam = genOmahaSimExam(hc, len)
      assert(exam.length === len, `exam length ${hc}/${len}, got ${exam.length}`)
      let openN = 0
      let vsN = 0
      let flopN = 0
      let turnN = 0
      let riverN = 0
      for (const s of exam) {
        assert(s.hero.length === hc, `exam hole count ${hc}`)
        assert(!hasDuplicates(s.hero), 'exam hero cards unique')
        if (s.kind === 'open') {
          openN++
          assert(s.boards === null && s.chart !== null, 'exam open: preflop fields')
        } else if (s.kind === 'vsRaise') {
          vsN++
          assert(s.boards === null && s.chart !== null, 'exam vsraise: preflop fields')
        } else {
          if (s.boardStreet === 3) flopN++
          else if (s.boardStreet === 4) turnN++
          else riverN++
          // улица вопроса соответствует запрошенной: обе доски нужной длины
          assert(
            s.boards![0].length === s.boardStreet && s.boards![1].length === s.boardStreet,
            `exam postflop boards match street: ${s.boards![0].length}/${s.boards![1].length} vs ${s.boardStreet}`,
          )
          assert(s.sim !== null && s.chart === null, 'exam postflop fields')
        }
      }
      const per = len / 5
      assert(openN === per && vsN === per, `exam preflop mix ${hc}/${len}: open ${openN}, vs ${vsN}`)
      assert(
        flopN === per && turnN === per && riverN === per,
        `exam streets mix ${hc}/${len}: flop ${flopN}, turn ${turnN}, river ${riverN}`,
      )
    }
  }
  // порядок вопросов перемешан (на достаточной выборке встречаются разные первые вопросы)
  const firsts = new Set<string>()
  for (let t = 0; t < 30; t++) {
    const exam = genOmahaSimExam(4, 10)
    firsts.add(exam[0].kind)
  }
  assert(firsts.size > 1, `exam order shuffled, first kinds: ${[...firsts].join(',')}`)
  console.log(`Экзамен: состав 5/10/20 для 4-card и 5-card корректен; первый вопрос варьируется (${firsts.size} варианта)`)
}

// ---------- 5e. advanceOmahaSimStreet: синхронное открытие улиц ----------
{
  const samePrefix = (b: Card[], bb: Card[]) => bb.slice(0, b.length).every((c, i) => c.r === b[i].r && c.s === b[i].s)
  for (const hc of [4, 5] as const) {
    let advanced = 0
    for (let t = 0; t < 60 && advanced < 20; t++) {
      const s0 = genOmahaSimScenario(hc)
      if (s0.kind !== 'postflop') continue
      advanced++
      let s = s0
      let street = 3
      while (street < 5) {
        const prev = s
        s = advanceOmahaSimStreet(s)
        street++
        assert(s.boardStreet === street, `advance to street ${street}`)
        assert(
          s.boards![0].length === street && s.boards![1].length === street,
          `both boards grow to ${street}: ${s.boards![0].length}/${s.boards![1].length}`,
        )
        // доски — стабильные префиксы: старые карты не меняются, новые добавляются синхронно
        assert(samePrefix(prev.boards![0], s.boards![0]) && samePrefix(prev.boards![1], s.boards![1]), `prefix stable ${street}`)
        assert(samePrefix(s.fullBoards![0].slice(0, street), s.boards![0]), `boards == fullBoards[0] prefix ${street}`)
        assert(samePrefix(s.fullBoards![1].slice(0, street), s.boards![1]), `boards == fullBoards[1] prefix ${street}`)
        // банк вырос на ставку и колл предыдущей улицы; ставка в пределах стека
        assert(s.pot === prev.pot + 2 * prev.bet, `pot grows: ${s.pot} vs ${prev.pot + 2 * prev.bet}`)
        assert(s.bet >= 1 && s.bet <= s.stack, `bet within stack: ${s.bet}`)
        assert(!hasDuplicates([...s.hero, ...s.boards![0], ...s.boards![1]]), `no dup street ${street}`)
        // решение согласовано с эквити и промптом улицы
        const req = s.bet / (s.pot + 2 * s.bet)
        const expected: 'fold' | 'call' | 'raise' = s.sim!.total >= req + 0.14 ? 'raise' : s.sim!.total >= req + 0.01 ? 'call' : 'fold'
        assert(s.correctAction === expected, `action match street ${street}`)
        const w = street === 3 ? 'Флоп.' : street === 4 ? 'Терн.' : 'Ривер.'
        assert(s.prompt.startsWith(w), `prompt street label ${street}: ${s.prompt.slice(0, 10)}`)
        assert(s.heroHands !== null && s.heroBest !== null, `combo fields street ${street}`)
      }
      // на ривере advance — no-op
      const frozen = advanceOmahaSimStreet(s)
      assert(frozen === s, 'advance at river is a no-op')
    }
    assert(advanced >= 10, `enough postflop scenarios for ${hc}-card, got ${advanced}`)
    console.log(`advanceOmahaSimStreet (${hc}-card): ${advanced} раздач доиграны до ривера, доски синхронны`)
  }
  // префлоп-сценарии advance не трогает
  let preflopSeen = 0
  for (let t = 0; t < 40 && preflopSeen < 10; t++) {
    const s = genOmahaSimScenario(4)
    if (s.kind === 'postflop') continue
    preflopSeen++
    assert(advanceOmahaSimStreet(s) === s, 'advance preflop no-op')
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
