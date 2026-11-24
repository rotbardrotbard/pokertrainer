// Тесты Омахи: оценщик 2+3, правило ровно двух карт руки, генераторы вопросов
import { parseCard, Card, fullDeck, shuffle } from '../src/lib/poker/cards'
import { evaluate5, handName } from '../src/lib/poker/evaluator'
import { bestOmahaHand, bestHandFromCards, playsBoardOnly } from '../src/lib/poker/omaha'
import { genOmahaWinnerQuestion, genOmahaDoubleQuestion } from '../src/lib/poker/omahaTraining'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}
const pc = (s: string) => parseCard(s) as Card

// Независимая реализация: перебор всех 5-карточных подмножеств hole+board,
// содержащих ровно 2 карты руки
function refOmahaScore(hole: Card[], board: Card[]): number {
  const all = [...hole, ...board]
  const inHole = (c: Card) => hole.some((h) => h.r === c.r && h.s === c.s)
  let best = -1
  const idx = [0, 1, 2, 3, 4]
  const n = all.length
  function rec(start: number, depth: number) {
    if (depth === 5) {
      const five = idx.map((i) => all[i])
      const holeCount = five.filter(inHole).length
      if (holeCount !== 2) return
      const s = evaluate5(five)
      if (s > best) best = s
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

// ---------- 1. Известные Омаха-руки ----------
{
  // Каре тузов: 2 туза руки + 2 туза доски
  const hole = [pc('As'), pc('Ad'), pc('2c'), pc('3c')]
  const board = [pc('Ah'), pc('Ac'), pc('Qd'), pc('Jc'), pc('4h')]
  const res = bestOmahaHand(hole, board)
  assert(res.cat === 7, `quads aces cat 7, got ${res.cat}`)
  assert(refOmahaScore(hole, board) === res.score, 'quads: ref match')

  // Фулл-хаус: рука AA, доска KKK
  const hole2 = [pc('As'), pc('Ad'), pc('2c'), pc('3c')]
  const board2 = [pc('Kh'), pc('Kd'), pc('Kc'), pc('2h'), pc('3d')]
  const res2 = bestOmahaHand(hole2, board2)
  assert(res2.cat === 6, `AA vs KKK board = full house, got cat ${res2.cat}`)
  assert(handName(res2).includes('Фулл-хаус'), `full house name, got ${handName(res2)}`)
  assert(refOmahaScore(hole2, board2) === res2.score, 'FH: ref match')

  // Стрит с использованием ровно 2 карт руки: 8h7h + 9d Tc Jd
  const hole3 = [pc('8h'), pc('7h'), pc('2c'), pc('3c')]
  const board3 = [pc('9d'), pc('Tc'), pc('Jd'), pc('2s'), pc('3c')]
  const res3 = bestOmahaHand(hole3, board3)
  assert(res3.cat === 4, `straight cat 4, got ${res3.cat}`)
  assert(handName(res3) === 'Стрит до валета', `straight to J name, got ${handName(res3)}`)
  assert(refOmahaScore(hole3, board3) === res3.score, 'straight: ref match')

  // Флеш: ровно 2 пики руки + 3 пики доски
  const hole4 = [pc('As'), pc('Ks'), pc('2c'), pc('3c')]
  const board4 = [pc('2s'), pc('7s'), pc('Qs'), pc('9d'), pc('9c')]
  const res4 = bestOmahaHand(hole4, board4)
  assert(res4.cat === 5, `flush cat 5, got ${res4.cat}`)
  assert(handName(res4) === 'Флеш (туз старший)', `flush name, got ${handName(res4)}`)
  // лучшая рука состоит из 2 карт руки и 3 с доски
  const fromHole = res4.best.filter((c) => hole4.some((h) => h.r === c.r && h.s === c.s)).length
  const fromBoard = res4.best.filter((c) => board4.some((b) => b.r === c.r && b.s === c.s)).length
  assert(fromHole === 2 && fromBoard === 3, `best = 2 hole + 3 board, got ${fromHole}+${fromBoard}`)

  // Правило Омахи: нельзя играть только доской. Рука мусор 2c3d9s9c, доска 5h6h7h8h9h:
  // стрит-флеш на доске НЕДОСТИЖИМ (нужно 0 карт руки), лучшее — сет девяток (2 карты руки 99 + 3 с доски)
  const hole5 = [pc('2c'), pc('3d'), pc('9s'), pc('9c')]
  const board5 = [pc('5h'), pc('6h'), pc('7h'), pc('8h'), pc('9h')]
  const res5 = bestOmahaHand(hole5, board5)
  const boardOnly = bestHandFromCards(board5)!
  assert(boardOnly.cat === 8, 'board alone is straight flush')
  assert(res5.cat === 3, `player best is trips nines, got cat ${res5.cat}`)
  assert(res5.score < boardOnly.score, 'Omaha: board SF unreachable for player')
  assert(!playsBoardOnly(hole5, board5), 'playsBoardOnly false here')

  // «Играет доской»: рука дублирует ранги борда — лучшая Омаха-рука равна лучшей руке самого борда
  // борд 5♣6♦7♣8♠9♣ — стрит до 9; рука 5♦6♥(2♦3♥) — тот же стрит до 9, улучшений нет
  const hole5b = [pc('5d'), pc('6h'), pc('2d'), pc('3h')]
  const board5b = [pc('5c'), pc('6d'), pc('7c'), pc('8s'), pc('9c')]
  const res5b = bestOmahaHand(hole5b, board5b)
  const boardOnly5b = bestHandFromCards(board5b)!
  assert(res5b.cat === 4, `both straights, got cat ${res5b.cat}`)
  assert(res5b.score === boardOnly5b.score, 'hole cards add nothing: same score as board-only')
  assert(playsBoardOnly(hole5b, board5b), 'playsBoardOnly true when hole adds nothing')

  // 5-card Омаха: рука AhKhQhJhTh, доска 2h 3h 9d9s9c — сет девяток, не флеш (лишь 2 червы на доске)
  const hole6 = [pc('Ah'), pc('Kh'), pc('Qh'), pc('Jh'), pc('Th')]
  const board6 = [pc('2h'), pc('3h'), pc('9d'), pc('9s'), pc('9c')]
  const res6 = bestOmahaHand(hole6, board6)
  assert(res6.cat === 3, `5-card Omaha trips nines cat 3, got ${res6.cat}`)
  assert(refOmahaScore(hole6, board6) === res6.score, '5-card trips: ref match')

  // 5-card Омаха: стрит-флеш через колесо
  const hole7 = [pc('Ah'), pc('Kh'), pc('5s'), pc('4s'), pc('2c')]
  const board7 = [pc('3s'), pc('6d'), pc('9c'), pc('9d'), pc('Jc')]
  const res7 = bestOmahaHand(hole7, board7)
  // 5s4s + A? колесо: 5,4,3,2,A — нужно 2 руки + 3 доски: 5s4s + 3s + A? Ah не пика. Стрит A2345: руки 5s,4s? + доска 3s, 2c? нет 2 на доске...
  // правильнее: руки Ah,2c? доска 3s... A,2 руки + 3,5 доски? на доске 3s есть, 5 нет.
  // так: руки 5s4s + доска 3s+2c? нет. Просто сверяем с ref.
  assert(refOmahaScore(hole7, board7) === res7.score, '5-card arbitrary: ref match')
}

// ---------- 2. Случайные раздачи: совпадение с независимой реализацией ----------
{
  for (let t = 0; t < 300; t++) {
    const deck = shuffle(fullDeck())
    const hole4 = deck.slice(0, 4)
    const board = deck.slice(4, 9)
    const r = bestOmahaHand(hole4, board)
    assert(refOmahaScore(hole4, board) === r.score, `random 4-card omaha mismatch #${t}`)
    assert(r.best.length === 5, 'best has 5 cards')
    const hole5 = deck.slice(9, 14)
    const r5 = bestOmahaHand(hole5, deck.slice(14, 19))
    assert(refOmahaScore(hole5, deck.slice(14, 19)) === r5.score, `random 5-card omaha mismatch #${t}`)
  }
}

// ---------- 3. Генераторы вопросов: целостность ----------
function allCards(...groups: Card[][]): Card[] {
  return groups.flat()
}
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
  for (let t = 0; t < 200; t++) {
    const q = genOmahaWinnerQuestion()
    assert(!hasDuplicates(allCards(q.hero, q.villain, q.board)), `winner q duplicate cards #${t}`)
    assert(q.board.length >= 3 && q.board.length <= 5, 'winner board length')
    assert(q.hero.length === 4 && q.villain.length === 4, 'winner 4 hole cards each')
    // корректность ответа пересчитываем независимо
    const h = refOmahaScore(q.hero, q.board)
    const v = refOmahaScore(q.villain, q.board)
    const expected = h > v ? 'hero' : h < v ? 'villain' : 'tie'
    assert(q.correct === expected, `winner correct mismatch #${t}: ${q.correct} vs ${expected}`)
  }
  for (let t = 0; t < 200; t++) {
    const q4 = genOmahaDoubleQuestion(4)
    assert(!hasDuplicates(allCards(q4.hero, q4.villain, ...q4.boards)), `double4 duplicates #${t}`)
    assert(q4.hero.length === 4 && q4.villain.length === 4, 'double4 hole count')
    const h1 = refOmahaScore(q4.hero, q4.boards[0])
    const v1 = refOmahaScore(q4.villain, q4.boards[0])
    const h2 = refOmahaScore(q4.hero, q4.boards[1])
    const v2 = refOmahaScore(q4.villain, q4.boards[1])
    assert(q4.heroWins[0] === h1 > v1 && q4.heroWins[1] === h2 > v2, `double4 heroWins mismatch #${t}`)
    assert(q4.ties[0] === (h1 === v1) && q4.ties[1] === (h2 === v2), `double4 ties mismatch #${t}`)
    const expected = q4.heroWins[0] && q4.heroWins[1] ? 'both' : q4.heroWins[0] ? 'b1' : q4.heroWins[1] ? 'b2' : 'none'
    assert(q4.correct === expected, `double4 correct mismatch #${t}`)

    const q5 = genOmahaDoubleQuestion(5)
    assert(!hasDuplicates(allCards(q5.hero, q5.villain, ...q5.boards)), `double5 duplicates #${t}`)
    assert(q5.hero.length === 5 && q5.villain.length === 5, 'double5 hole count')
  }
}

// ---------- 4. Производительность генераторов ----------
{
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) {
    genOmahaWinnerQuestion()
    genOmahaDoubleQuestion(4)
    genOmahaDoubleQuestion(5)
  }
  const dt = Date.now() - t0
  console.log(`150 вопросов сгенерированы за ${dt} мс (${(dt / 150).toFixed(1)} мс/вопрос)`)
  assert(dt < 5000, 'generation performance')
}

if (failures === 0) {
  console.log('OK: все тесты Омахи пройдены')
} else {
  console.error(`Провалено проверок: ${failures}`)
  process.exit(1)
}
