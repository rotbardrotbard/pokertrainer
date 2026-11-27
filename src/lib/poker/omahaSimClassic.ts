// Симулятор раздач для классической Омахи (4-card, одна доска).
// Префлоп: решения по GTO-чартам позиции — те же диапазоны, что в разделе GTO
// (размер стола меняет ширину диапазона, рука оценивается как «топ X%»).
// Постфлоп: Monte-Carlo эквити на одной доске против случайной руки,
// решение по пот-оддсам.
import { Card, fullDeck } from './cards'
import { handName } from './evaluator'
import { bestOmahaHand } from './omaha'
import { Position, POSITION_NAMES_RU, dominantAction, secondaryAction, freqLabel } from './ranges'
import { seatsForTable, basePos, omahaPreflop, omahaActionFreqs, omahaEquityTier } from './gto'
import type { OmahaPreflop } from './gto'
import { omahaHandPercentile } from './handRanges'
import type { ExamLength, OmahaSimAction, OmahaSimKind, PloProfile } from './omahaSim'
import { analyzePloHand, bestOmahaScoreFast } from './omahaSim'

// ============ Monte-Carlo эквити на одной доске ============

export interface OmahaSingleEquity {
  eq: number // доля банка (win + tie/2), 0..1
  iterations: number
}

interface SimSingleOptions {
  hero: Card[]
  board: Card[]
  holeCount?: 4 // классическая Омаха — 4 карты руки
  iterations?: number
  rand?: () => number
}

/** Частичная перетасовка: первые need элементов deck — случайная выборка. */
function sampleFrom(deck: Card[], need: number, rand: () => number): void {
  const len = deck.length
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rand() * (len - i))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
}

/** Эквити героя на одной доске против одного оппонента со случайной рукой. */
export function simulateOmahaSingle(opts: SimSingleOptions): OmahaSingleEquity {
  const { hero, board } = opts
  const rand = opts.rand ?? Math.random
  const holeCount = opts.holeCount ?? 4
  const iters = opts.iterations ?? 700

  const known = new Set<string>()
  for (const c of [...hero, ...board]) known.add(c.r + '-' + c.s)
  const deck = fullDeck().filter((c) => !known.has(c.r + '-' + c.s))

  const needBoard = 5 - board.length
  const need = needBoard + holeCount

  const bf: Card[] = new Array(5)
  for (let i = 0; i < board.length; i++) bf[i] = board[i]
  const vil: Card[] = new Array(holeCount)

  let w = 0
  let t = 0
  for (let it = 0; it < iters; it++) {
    sampleFrom(deck, need, rand)
    for (let i = 0; i < needBoard; i++) bf[board.length + i] = deck[i]
    for (let i = 0; i < holeCount; i++) vil[i] = deck[needBoard + i]

    const h = bestOmahaScoreFast(hero, bf)
    const v = bestOmahaScoreFast(vil, bf)
    if (h > v) w++
    else if (h === v) t++
  }
  return { eq: (w + t / 2) / iters, iterations: iters }
}

// ============ Сценарии симулятора ============

export interface OmahaSimScenarioSingle {
  kind: OmahaSimKind
  hero: Card[]
  board: Card[] | null // только postflop
  boardStreet: number // длина доски: 3=флоп, 4=терн, 5=ривер; 0 у префлопа
  position: Position
  players: number // размер стола (влияет на ширину диапазона)
  raiser?: Position // позиция рейзера (для сценария vsRaise)
  chart: OmahaPreflop | null // GTO-чарт позиции (префлоп)
  handPct: number | null // место руки: «топ X%» стартовых рук (префлоп)
  gtoHint: string | null // постфлоп: ориентир из GTO-чарта
  prompt: string
  actionLabels: { fold: string; call: string | null; raise: string }
  correctAction: OmahaSimAction
  altAction?: OmahaSimAction // второе действие смешанной стратегии (тоже засчитывается)
  altFreq?: number // частота второго действия, %
  pot: number
  bet: number
  stack: number
  profile: PloProfile
  sim: OmahaSingleEquity | null // только postflop
  requiredPct: number | null // требуемые пот-оддсы, %
  heroHand: string | null // название текущей комбинации на доске
  heroBest: Card[] | null // 5 карт лучшей комбинации
  explanation: string
  detail: string[]
}

const ri = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: readonly T[]): T => arr[ri(arr.length)]

const OMAHA_SIM_ALT: Record<OmahaSimAction, string> = { fold: 'фолд', call: 'колл', raise: '3бет' }

// размеры стола в симуляторе: от хедз-апа до 9-max
const SIM_TABLES = [2, 3, 4, 5, 6, 9] as const

/** Уникальные базовые позиции стола в порядке действия (без BB, если excludeBB). */
function tablePositions(players: number, excludeBB: boolean): Position[] {
  const seats = seatsForTable(players).map(basePos)
  const uniq = [...new Set(seats)]
  return excludeBB ? uniq.filter((p) => p !== 'BB') : uniq
}

function shuffled(): Card[] {
  const a = fullDeck().slice().map((c) => ({ ...c }))
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Префлоп: открытие из позиции (по GTO-чарту) ---

function genOpenScenario(): OmahaSimScenarioSingle {
  const players = pick(SIM_TABLES)
  const pos = pick(tablePositions(players, true)) // открытие — все позиции кроме BB
  const deck = shuffled()
  const hero = deck.slice(0, 4)
  const profile = analyzePloHand(hero)
  const chart = omahaPreflop('omaha4', pos, players, 'open', 0)
  // смешанные частоты у границы диапазона: пограничная рука — микс рейз/фолд
  const freqs = omahaActionFreqs('omaha4', hero, chart, 'open')
  const correct: OmahaSimAction = dominantAction(freqs)
  const sec = secondaryAction(freqs, 25)
  const altAction = sec?.action
  const altFreq = sec?.freq
  const handPct = omahaHandPercentile('omaha4', hero)
  const raisePct = Math.round(chart.openPercent)
  const mixNote = altAction
    ? ` Пограничная рука: смешанная стратегия — допустимо и «${OMAHA_SIM_ALT[altAction]}» (~${altFreq}%).`
    : ''
  return {
    kind: 'open',
    hero,
    board: null,
    boardStreet: 0,
    position: pos,
    players,
    chart,
    handPct,
    gtoHint: null,
    prompt: `${POSITION_NAMES_RU[pos]} · стол ${players}-max. До вас все сбросили. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: null, raise: 'Рейз до 3bb' },
    correctAction: correct,
    altAction,
    altFreq,
    pot: 1.5,
    bet: 0,
    stack: 100,
    profile,
    sim: null,
    requiredPct: null,
    heroHand: null,
    heroBest: null,
    explanation: correct === 'raise'
      ? `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — входит в диапазон открытия с ${POSITION_NAMES_RU[pos]} (топ ~${raisePct}%). Открывайте рейзом 3–4bb.${mixNote}`
      : `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — вне диапазона открытия с ${POSITION_NAMES_RU[pos]} (топ ~${raisePct}%). Сбрасывайте.${mixNote}`,
    detail: [
      ...profile.features,
      `GTO-чарт: открытие с ${POSITION_NAMES_RU[pos]} за столом ${players}-max — рейз с топ ~${raisePct}% рук (оценка структуры ≥ ${Math.round(chart.openThreshold)} из 100).`,
      `Ваша рука по той же шкале — топ ~${handPct}%: чем раньше позиция и больше стол, тем тайтовее диапазон.`,
      `Частоты GTO: ${freqLabel(freqs, 'рейз')}.`,
    ],
  }
}

// --- Префлоп: против рейза (по GTO-чарту) ---

function genVsRaiseScenario(): OmahaSimScenarioSingle {
  const players = pick(SIM_TABLES)
  const seats = seatsForTable(players)
  const vi = ri(seats.length - 1) // рейзер — любой кроме BB, действует раньше героя
  const villainPos = basePos(seats[vi])
  // герой сидит после рейзера на другой базовой позиции (UTG1 за UTG — тот же чарт, показываем разный)
  const candidates = seats.slice(vi + 1).filter((s) => basePos(s) !== villainPos)
  const pos = basePos(pick(candidates.length > 0 ? candidates : seats.slice(vi + 1)))
  const deck = shuffled()
  const hero = deck.slice(0, 4)
  const profile = analyzePloHand(hero)
  const openSize = 3
  // все сбросили до героя: только рейзер в банке (opponents = 1, callers = 0)
  const chart = omahaPreflop('omaha4', pos, players, 'vsraise', 0, villainPos)
  // смешанные частоты: у границы 3бета — микс 3бет/колл, у границы колла — микс колл/фолд
  const freqs = omahaActionFreqs('omaha4', hero, chart, 'vsraise')
  const correct: OmahaSimAction = dominantAction(freqs)
  const sec = secondaryAction(freqs, 25)
  const altAction = sec?.action
  const altFreq = sec?.freq
  const handPct = omahaHandPercentile('omaha4', hero)
  const tbPct = Math.round(chart.threeBetPercent)
  const callPct = Math.round(chart.callPercent)
  const mixNote = altAction
    ? ` Смешанная стратегия: допустимо и «${OMAHA_SIM_ALT[altAction]}» (~${altFreq}%).`
    : ''
  return {
    kind: 'vsRaise',
    hero,
    board: null,
    boardStreet: 0,
    position: pos,
    players,
    raiser: villainPos,
    chart,
    handPct,
    gtoHint: null,
    prompt: `${villainPos} открывается рейзом до ${openSize}bb (стол ${players}-max). Вы на ${POSITION_NAMES_RU[pos]}. Ваше действие?`,
    actionLabels: { fold: 'Фолд', call: `Колл ${openSize}bb`, raise: '3бет до 12bb' },
    correctAction: correct,
    altAction,
    altFreq,
    pot: 1.5 + openSize,
    bet: openSize,
    stack: 100,
    profile,
    sim: null,
    requiredPct: null,
    heroHand: null,
    heroBest: null,
    explanation: correct === 'raise'
      ? `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — в 3бет-диапазоне с ${POSITION_NAMES_RU[pos]} (топ ~${tbPct}%). 3бет для вэлью и инициативы.${mixNote}`
      : correct === 'call'
        ? `Рука — топ ~${handPct}% стартовых: вне 3бета (топ ~${tbPct}%), но в диапазоне колла с ${POSITION_NAMES_RU[pos]} (топ ~${callPct}%). Колл и игра постфлоп.${mixNote}`
        : `Рука — топ ~${handPct}% стартовых (${profile.desc.toLowerCase()}) — слабее диапазона защиты с ${POSITION_NAMES_RU[pos]} (колл — топ ~${callPct}%). Фолд.${mixNote}`,
    detail: [
      ...profile.features,
      `GTO-чарт: против рейза с ${POSITION_NAMES_RU[pos]} — 3бет с топ ~${tbPct}%, колл с топ ~${callPct}% рук (стол ${players}-max).`,
      `Частоты GTO: ${freqLabel(freqs)}.`,
      'Диапазон зависит от размера стола: чем больше игроков, тем тайтовее защита.',
    ],
  }
}

// --- Постфлоп: решение против ставки на одной доске ---

function genPostflopScenario(forceStreet?: 3 | 4 | 5): OmahaSimScenarioSingle {
  const pot = pick([30, 40, 60, 80])
  const betMult = pick([0.5, 0.75, 1])
  const bet = Math.round(pot * betMult)
  const required = bet / (pot + 2 * bet)
  const requiredPct = Math.round(required * 1000) / 10

  // выбираем самую «интересную» из нескольких раздач: эквити ближе к границе решения
  let best: OmahaSimScenarioSingle | null = null
  let bestInterest = -Infinity
  for (let t = 0; t < 4; t++) {
    const deck = shuffled()
    const hero = deck.slice(0, 4)
    const n = forceStreet ?? pick([3, 3, 4, 5])
    const board = deck.slice(4, 4 + n)
    const sim = simulateOmahaSingle({ hero, board, holeCount: 4, iterations: 600 })
    const eqPct = sim.eq * 100
    const street = n === 3 ? 'флоп' : n === 4 ? 'терн' : 'ривер'
    const res = bestOmahaHand(hero, board)
    let correct: OmahaSimAction
    if (sim.eq >= required + 0.14) correct = 'raise'
    else if (sim.eq >= required + 0.01) correct = 'call'
    else correct = 'fold'
    const verdict = correct === 'raise'
      ? 'рейз для вэлью — эквити сильно выше требуемого'
      : correct === 'call'
        ? 'колл прибылен — эквити выше требуемых пот-оддсов'
        : 'фолд — колл теряет деньги'
    // GTO-ориентир по улице
    const gtoStreet: 'flop' | 'turn' | 'river' = n === 3 ? 'flop' : n === 4 ? 'turn' : 'river'
    const tier = omahaEquityTier('omaha4', gtoStreet, correct)
    const scenario: OmahaSimScenarioSingle = {
      kind: 'postflop',
      hero,
      board,
      boardStreet: n,
      position: 'BB',
      players: 6,
      chart: null,
      handPct: null,
      gtoHint: `${tier.tier} — против ставки: ${tier.facingBet.toLowerCase()}`,
      prompt: `${street.charAt(0).toUpperCase()}${street.slice(1)}. Оппонент ставит ${bet} bb в банк ${pot} bb. Ваше действие?`,
      actionLabels: { fold: 'Фолд', call: `Колл ${bet} bb`, raise: `Рейз до ${Math.round(bet * 2.5)} bb` },
      correctAction: correct,
      pot,
      bet,
      stack: 100,
      profile: analyzePloHand(hero),
      sim,
      requiredPct,
      heroHand: handName(res),
      heroBest: res.best,
      explanation:
        `Эквити ${eqPct.toFixed(1)}% против случайной руки при требуемых ${requiredPct}% — ${verdict}.`,
      detail: [
        'Эквити считается против случайной руки оппонента: против реального диапазона бэттера оно ниже — решение может отличаться (чаще фолд).',
        `Пот-оддсы: ${bet} / (${pot} + ${bet} + ${bet}) = ${requiredPct}%.`,
        `Доска (${street}) — ваша лучшая комбинация: ${handName(res)}.`,
        `GTO-чарт (${street}): ${tier.tier} — против ставки: ${tier.facingBet.toLowerCase()}.`,
        'В Омахе комбинация — ровно 2 карты руки + 3 с доски, подсветка показывает их.',
      ],
    }
    // интерес: эквити близко к границе решения
    const interest = -Math.abs(sim.eq - (required + 0.05)) + Math.random() * 0.04
    if (interest > bestInterest) {
      bestInterest = interest
      best = scenario
    }
  }
  return best!
}

export function genOmahaSimScenarioClassic(): OmahaSimScenarioSingle {
  const r = Math.random()
  if (r < 0.3) return genOpenScenario()
  if (r < 0.55) return genVsRaiseScenario()
  return genPostflopScenario()
}

// ============ Режим экзамена ============

/** Сценарий заданного типа. street — только для postflop (3=флоп, 4=терн, 5=ривер). */
export function genOmahaSimScenarioOfClassic(
  kind: 'open' | 'vsRaise' | 'postflop',
  street?: 3 | 4 | 5,
): OmahaSimScenarioSingle {
  if (kind === 'open') return genOpenScenario()
  if (kind === 'vsRaise') return genVsRaiseScenario()
  return genPostflopScenario(street)
}

/**
 * Экзамен: сбалансированный набор раздач фиксированной длины.
 * На каждые 5 вопросов — 1 открытие, 1 защита против рейза и по одному
 * постфлоп-решению на флопе, терне и ривере. Порядок вопросов перемешан.
 */
export function genOmahaSimExamClassic(length: ExamLength): OmahaSimScenarioSingle[] {
  const per = length / 5
  const plan: Array<{ kind: 'open' | 'vsRaise' | 'postflop'; street?: 3 | 4 | 5 }> = []
  for (let i = 0; i < per; i++) {
    plan.push(
      { kind: 'open' },
      { kind: 'vsRaise' },
      { kind: 'postflop', street: 3 },
      { kind: 'postflop', street: 4 },
      { kind: 'postflop', street: 5 },
    )
  }
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }
  return plan.map((p) => genOmahaSimScenarioOfClassic(p.kind, p.street))
}
