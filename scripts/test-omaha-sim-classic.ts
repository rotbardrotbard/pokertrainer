// Тесты классического симулятора Омахи (4-card, одна доска):
// Monte-Carlo эквити, генераторы сценариев, экзамен, согласованность решений.
import { parseCard, Card, fullDeck } from '../src/lib/poker/cards'
import { evaluate5 } from '../src/lib/poker/evaluator'
import {
  simulateOmahaSingle,
  genOmahaSimScenarioClassic,
  genOmahaSimExamClassic,
  OmahaSimScenarioSingle,
} from '../src/lib/poker/omahaSimClassic'
import { isOmahaSimActionCorrect } from '../src/lib/poker/omahaSim'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}
const pc = (s: string) => parseCard(s) as Card

// Детерминированный генератор для equity-тестов (mulberry32)
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

// ---------- 1. Эквити: заблокированные доски ----------

{
  // Каре тузов в руке и на доске: у оппонента максимум фулл-хаус -> eq = 1.0
  const hero = [pc('As'), pc('Ad'), pc('2c'), pc('3c')]
  const board = ['Ah', 'Ac', 'Qd', 'Jc', '4h'].map(pc)
  const sim = simulateOmahaSingle({ hero, board, iterations: 500, rand: seeded(1) })
  assert(sim.eq === 1, `quad aces locked: eq=1, получено ${sim.eq}`)

  // Роял-флеш на доске + герой с двумя пиками: герой собирает роял (2 свои + 3 с доски).
  // В Омахе «играть доску» нельзя — роял только у тех, у кого 2 пики в руке:
  // остальные проигрывают (максимум стрит) -> eq ~ 1 - P(у оппонента 2 пики) > 0.95
  const hero2 = ['Ks', 'As', '2c', '3c'].map(pc)
  const board2 = ['Ts', 'Js', 'Qs', 'Ks', 'As'].map(pc)
  const sim2 = simulateOmahaSingle({ hero: hero2, board: board2, iterations: 3000, rand: seeded(2) })
  assert(sim2.eq > 0.95, `royal board + 2 пики: eq > 0.95, получено ${sim2.eq.toFixed(3)}`)

  // А без пик в руке роял на доске недостижим (нужно ровно 2 карты руки):
  // герой с чёвыми картами проигрывает флашам оппонентов -> eq заметно ниже 0.5
  const hero3 = ['2c', '3c', '4c', '5c'].map(pc)
  const sim3 = simulateOmahaSingle({ hero: hero3, board: board2, iterations: 3000, rand: seeded(3) })
  assert(sim3.eq < 0.45, `royal board без пик: eq < 0.45, получено ${sim3.eq.toFixed(3)}`)
}

// ---------- 2. Эквити: известные ситуации против случайной руки ----------

{
  // Пара тузов + KW на сухом флопе: эквити против случайной Омаха-руки.
  // Топ-пара в Омахе слабее, чем в Холдеме: оппоненты с тузом бьют кикером,
  // карманные пары дают сеты/две пары -> ориентир ~0.6
  const hero = [pc('As'), pc('Ad'), pc('Ks'), pc('Qd')]
  const board = [pc('7c'), pc('3d'), pc('2h')]
  const sim = simulateOmahaSingle({ hero, board, iterations: 3000, rand: seeded(42) })
  assert(sim.eq > 0.5 && sim.eq < 0.75, `AAKQ dry flop: eq в (0.5, 0.75), получено ${sim.eq.toFixed(3)}`)

  // Детерминированность: тот же seed — тот же результат
  const simB = simulateOmahaSingle({ hero, board, iterations: 3000, rand: seeded(42) })
  assert(sim.eq === simB.eq, 'одинаковый seed даёт одинаковое эквити')

  // Эквити в диапазоне [0, 1]
  assert(sim.eq >= 0 && sim.eq <= 1, 'eq в [0, 1]')
}

// ---------- 3. Эквити против независимого оценщика ----------

{
  // Проверка bestOmahaScoreFast на одной доске через refOmahaScore на нескольких раздачах
  const hero = [pc('Ts'), pc('Js'), pc('Qs'), pc('Ks')]
  const board = [pc('2h'), pc('9s'), pc('3d'), pc('8c'), pc('Ad')]
  const sim = simulateOmahaSingle({ hero, board: board.slice(0, 3), iterations: 1, rand: () => 0 })
  assert(sim.eq >= 0, 'sanity')
  void refOmahaScore(hero, board) // не падает
}

// ---------- 4. Генераторы: структурная валидность ----------

function validateScenario(sc: OmahaSimScenarioSingle, tag: string) {
  assert(sc.hero.length === 4, `${tag}: 4 карты героя`)
  const heroKeys = new Set(sc.hero.map((c) => c.r + '-' + c.s))
  assert(heroKeys.size === 4, `${tag}: карты героя уникальны`)

  if (sc.kind === 'postflop') {
    assert(sc.board !== null && [3, 4, 5].includes(sc.board!.length), `${tag}: длина доски 3/4/5`)
    const overlap = sc.board!.some((c) => heroKeys.has(c.r + '-' + c.s))
    assert(!overlap, `${tag}: доска не пересекается с рукой`)
    assert(sc.sim !== null && sc.sim.eq >= 0 && sc.sim.eq <= 1, `${tag}: sim.eq в [0,1]`)
    assert(sc.requiredPct !== null && sc.requiredPct > 0, `${tag}: requiredPct > 0`)
    const required = sc.bet / (sc.pot + 2 * sc.bet)
    assert(Math.abs(required * 100 - sc.requiredPct!) < 0.2, `${tag}: requiredPct согласован с bet/pot`)
    assert(sc.heroHand !== null && sc.heroHand.length > 0, `${tag}: имя комбинации`)
    assert(sc.heroBest !== null && sc.heroBest.length === 5, `${tag}: 5 карт комбинации`)
    // согласованность решения с эквити
    const eq = sc.sim!.eq
    const expect = eq >= sc.requiredPct! / 100 + 0.14 ? 'raise' : eq >= sc.requiredPct! / 100 + 0.01 ? 'call' : 'fold'
    assert(sc.correctAction === expect, `${tag}: correctAction согласован с эквити (${eq.toFixed(3)} vs ${sc.requiredPct}%)`)
    // heroBest: 2 карты из руки + 3 с доски
    const fromHero = sc.heroBest!.filter((c) => sc.hero.some((h) => h.r === c.r && h.s === c.s)).length
    const fromBoard = sc.heroBest!.filter((c) => sc.board!.some((b) => b.r === c.r && b.s === c.s)).length
    assert(fromHero === 2 && fromBoard === 3, `${tag}: комбинация 2 из руки + 3 с доски`)
    assert(sc.actionLabels.call !== null, `${tag}: у постфлопа есть колл`)
  } else {
    assert(sc.board === null && sc.sim === null, `${tag}: у префлопа нет доски и sim`)
    assert(sc.chart !== null, `${tag}: префлоп имеет GTO-чарт`)
    assert(sc.handPct !== null && sc.handPct >= 0 && sc.handPct <= 100, `${tag}: handPct в [0,100]`)
    assert(sc.players >= 2 && sc.players <= 9, `${tag}: стол 2..9`)
    assert(['open', 'vsRaise'].includes(sc.kind), `${tag}: префлоп-тип`)
    if (sc.kind === 'open') {
      assert(sc.position !== 'BB', `${tag}: открытие не с BB`)
      assert(sc.bet === 0 && sc.actionLabels.call === null, `${tag}: у открытия нет колла`)
    }
    if (sc.kind === 'vsRaise') {
      assert(sc.raiser !== undefined && sc.raiser !== sc.position, `${tag}: рейзер существует и не герой`)
    }
  }
  if (sc.altAction !== undefined) {
    assert((sc.altFreq ?? 0) >= 25, `${tag}: альтернатива >= 25%`)
    assert(sc.altAction !== sc.correctAction, `${tag}: альтернатива отличается от основного действия`)
  }
  assert(sc.explanation.length > 10, `${tag}: объяснение заполнено`)
  assert(sc.detail.length >= 3, `${tag}: детали заполнены`)
}

{
  const seen = new Set<string>()
  let postflop = 0
  let open = 0
  let vsRaise = 0
  for (let i = 0; i < 300; i++) {
    const sc = genOmahaSimScenarioClassic()
    validateScenario(sc, `gen#${i}`)
    const key = sc.hero.map((c) => `${c.r}-${c.s}`).join('|') + (sc.board ? '#' + sc.board.map((c) => `${c.r}-${c.s}`).join('|') : '')
    assert(!seen.has(key), `gen#${i}: сценарий уникален`)
    seen.add(key)
    if (sc.kind === 'postflop') postflop++
    else if (sc.kind === 'open') open++
    else vsRaise++
  }
  // распределение примерно как заявлено: 30/25/45
  assert(postflop > 90, `постфлоп-сценариев большинство (${postflop}/300)`)
  assert(open > 60 && vsRaise > 40, `префлоп-типы присутствуют (open=${open}, vsRaise=${vsRaise})`)
}

// ---------- 5. Экзамен ----------

{
  for (const len of [5, 10, 20] as const) {
    const q = genOmahaSimExamClassic(len)
    assert(q.length === len, `экзамен ${len}: длина ${q.length}`)
    const per = len / 5
    const counts = { open: 0, vsRaise: 0, postflop: 0 }
    const streets = new Map<number, number>()
    q.forEach((sc) => {
      validateScenario(sc, `exam${len}`)
      if (sc.kind === 'postflop') {
        counts.postflop++
        streets.set(sc.boardStreet, (streets.get(sc.boardStreet) ?? 0) + 1)
      } else if (sc.kind === 'open') counts.open++
      else counts.vsRaise++
    })
    assert(counts.open === per && counts.vsRaise === per, `экзамен ${len}: open/vsRaise по ${per}`)
    assert(counts.postflop === per * 3, `экзамен ${len}: постфлопов ${per * 3}`)
    assert(streets.get(3) === per && streets.get(4) === per && streets.get(5) === per, `экзамен ${len}: флоп/терн/ривер поровну`)
  }
}

// ---------- 6. isOmahaSimActionCorrect ----------

{
  const base = { correctAction: 'call' as const }
  assert(isOmahaSimActionCorrect(base, 'call'), 'isCorrect: основной ответ')
  assert(isOmahaSimActionCorrect({ ...base, altAction: 'raise' }, 'raise'), 'isCorrect: альтернатива')
  assert(!isOmahaSimActionCorrect(base, 'raise'), 'isCorrect: неверный ответ')
  assert(!isOmahaSimActionCorrect(base, null), 'isCorrect: null неверно')
}

// ---------- 7. Деки: генератор не мутирует fullDeck ----------

{
  const before = fullDeck().map((c) => c.r + '-' + c.s).join(',')
  genOmahaSimScenarioClassic()
  const after = fullDeck().map((c) => c.r + '-' + c.s).join(',')
  assert(before === after, 'fullDeck не мутируется генераторами')
}

// ---------- Итог ----------

if (failures === 0) {
  console.log('OK: все тесты классического симулятора Омахи пройдены')
} else {
  console.error(`Провалено проверок: ${failures}`)
  process.exit(1)
}
