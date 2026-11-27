// Живая игра: визуальная раздача за столом 2–9 игроков.
// Типы игры: Hold'em, Омаха 4-card (одна доска), Омаха 4-card и 5-card на двух досках.
// Оппоненты: префлоп — по GTO-чартам со смешанными частотами, постфлоп — по силе руки
// (Monte-Carlo против случайных рук поля). Герой решает через UI; его решения
// оцениваются: префлоп — чарт, постфлоп — эквити против пот-оддсов.
// Стеки 100 bb, блайнды 0.5/1, ставки: открытие 2.5bb, 3бет ×3, постфлоп 0.5–0.75 банка.

import { Card, fullDeck, shuffle } from './cards'
import { evaluate7, handName } from './evaluator'
import { bestOmahaHand } from './omaha'
import { bestOmahaScoreFast } from './omahaSim'
import { simulateEquity } from './equity'
import { handClass } from './ranges'
import type { ActionFreq, Position } from './ranges'
import {
  holdemPreflop, holdemAction, omahaPreflop, omahaActionFreqs,
  seatsForTable, basePos, analyzeBoardTexture, STREET_NAMES_RU,
} from './gto'
import type { Street } from './gto'
import { omahaHandPercentile, handInRange } from './handRanges'
import type { GameKind } from './handRanges'

export type LiveGame = 'holdem' | 'omaha4' | 'omaha4x2' | 'omaha5x2'

export const LIVE_GAME_NAMES_RU: Record<LiveGame, string> = {
  holdem: "Texas Hold'em",
  omaha4: 'Омаха 4-card · 1 доска',
  omaha4x2: 'Омаха 4-card · 2 доски',
  omaha5x2: 'Омаха 5-card · 2 доски',
}

export const LIVE_GAME_HINTS: Record<LiveGame, string> = {
  holdem: '2 карты руки, одна доска, чарты 2–9-max',
  omaha4: '4 карты руки (ровно 2 + 3 с доски), одна доска',
  omaha4x2: '4 карты руки, две доски — банк делится пополам между ними',
  omaha5x2: '5 карт руки, две доски — максимум 7 оппонентов (не хватает колоды)',
}

export const SB = 0.5
export const BB = 1
export const START_STACK = 100

export const HOLE_N: Record<LiveGame, number> = { holdem: 2, omaha4: 4, omaha4x2: 4, omaha5x2: 5 }
export const BOARD_COUNT: Record<LiveGame, 1 | 2> = { holdem: 1, omaha4: 1, omaha4x2: 2, omaha5x2: 2 }
export const MAX_BOTS: Record<LiveGame, number> = { holdem: 8, omaha4: 8, omaha4x2: 8, omaha5x2: 7 }

function omahaGame(g: LiveGame): 'omaha4' | 'omaha5' {
  return g === 'omaha5x2' ? 'omaha5' : 'omaha4'
}

export type LiveActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export function actionText(kind: LiveActionKind, amount: number): string {
  if (kind === 'fold') return 'Фолд'
  if (kind === 'check') return 'Чек'
  if (kind === 'call') return `Колл ${fmt(amount)}`
  if (kind === 'bet') return `Бет ${fmt(amount)}`
  return `Рейз до ${fmt(amount)}`
}

function fmt(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(1)
}

export function roundHalf(x: number): number {
  return Math.round(x * 2) / 2
}

export type LiveMode = 'full' | 'node'

export interface LiveConfig {
  game: LiveGame
  bots: number // 1..MAX_BOTS[game]
  mode?: LiveMode // 'full' — герой играет всю раздачу; 'node' — одно решение
  rand?: () => number
}

export interface SeatView {
  idx: number
  name: string // 'Вы' | 'Оппонент N'
  seat: string // 'UTG' | 'BTN' | ...
  folded: boolean
  allIn: boolean
  isHero: boolean
  faceUp: boolean
  cards: Card[]
  stack: number
  totalBet: number
  lastText: string | null
  handLabel: string | null // подпись комбинации на вскрытии
}

export interface DecisionRec {
  street: Street
  prompt: string
  chosen: string
  best: string
  correct: boolean
  reason: string
  eqPct?: number
  requiredPct?: number
}

export interface BoardResult {
  board: number
  winnerNames: string[]
  label: string
}

export interface LiveResult {
  text: string
  heroWon: number
  boards: BoardResult[]
  showdown: boolean
}

interface P {
  idx: number
  seat: string
  pos: Position
  name: string
  cards: Card[]
  stack: number
  streetBet: number
  totalBet: number
  folded: boolean
  allIn: boolean
  acted: boolean
  lastText: string | null
  isHero: boolean
  handLabel: string | null
}

export interface HeroOptions {
  toCall: number
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  callAmount: number // с учётом олл-ина
  canRaise: boolean
  raiseTo: number // размер по умолчанию (капнутый стеком)
  raiseAllIn: boolean
  prompt: string
}

export interface LiveSnapshot {
  street: Street
  streetLabel: string
  pot: number
  boards: Card[][]
  dealtPerBoard: number
  seats: SeatView[]
  buttonIdx: number
  awaitingHero: boolean
  finished: boolean
  options: HeroOptions | null
  decisions: DecisionRec[]
  log: string[]
  result: LiveResult | null
  lastVerdict: { correct: boolean; reason: string } | null
  heroSeat: number
  mode: LiveMode
}

// ============ Движок ============

export class LiveHand {
  readonly game: LiveGame
  readonly kind: GameKind
  readonly players: number
  readonly mode: LiveMode
  private rand: () => number

  private seats: P[] = []
  private boards: Card[][] = []
  private deck: Card[] = []
  private deckPtr = 0
  private street: Street = 'preflop'
  private potBanked = 0
  private currentBet = 0
  private lastRaiseSize = BB
  private betCount = 0
  private buttonIdx = 0
  private heroIdx = 0
  private actorPtr = 0
  private awaitingHeroFlag = false
  private finishedFlag = false
  private revealed = false
  private lastRaiserIdx: number | null = null
  private decisions: DecisionRec[] = []
  private log: string[] = []
  private result: LiveResult | null = null
  private lastVerdict: { correct: boolean; reason: string } | null = null
  private heroTurns = 0 // всех точек решения героя (авто + пользователь)
  private nodeTarget: number // 1..3 для режима 'node'
  private steps = 0

  constructor(cfg: LiveConfig) {
    this.game = cfg.game
    this.kind = cfg.game === 'holdem' ? 'holdem' : omahaGame(cfg.game)
    this.mode = cfg.mode ?? 'full'
    this.rand = cfg.rand ?? Math.random
    const maxBots = MAX_BOTS[cfg.game]
    const bots = Math.max(1, Math.min(cfg.bots, maxBots))
    this.players = bots + 1
    this.nodeTarget = this.mode === 'node' ? 1 + Math.floor(this.rand() * 3) : 0

    // раздача карт
    this.deck = shuffle(fullDeck(), this.rand)
    const seatNames = seatsForTable(this.players) // порядок действия на префлопе
    this.heroIdx = Math.floor(this.rand() * this.players)
    let botNo = 0
    for (let i = 0; i < this.players; i++) {
      const seat = seatNames[i]
      const cards = this.deck.slice(this.deckPtr, this.deckPtr + HOLE_N[this.game])
      this.deckPtr += HOLE_N[this.game]
      const isHero = i === this.heroIdx
      this.seats.push({
        idx: i,
        seat,
        pos: basePos(seat),
        name: isHero ? 'Вы' : `Оппонент ${++botNo}`,
        cards,
        stack: START_STACK,
        streetBet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        acted: false,
        lastText: null,
        isHero,
        handLabel: null,
      })
    }
    this.buttonIdx = seatNames.indexOf('BTN')
    if (this.buttonIdx < 0) this.buttonIdx = 0
    for (let k = 0; k < BOARD_COUNT[this.game]; k++) this.boards.push([])

    // блайнды
    const sbIdx = this.players === 2 ? this.buttonIdx : this.players - 2
    const bbIdx = this.players - 1
    this.postBlind(this.seats[sbIdx], SB)
    this.postBlind(this.seats[bbIdx], BB)
    this.currentBet = BB
    this.lastRaiseSize = BB
    this.log.push(`Блайнды: SB ${fmt(SB)} / BB ${fmt(BB)}. Вы на позиции ${this.seats[this.heroIdx].seat}.`)
    this.actorPtr = 0
    this.awaitNextActor()
  }

  private postBlind(p: P, amount: number): void {
    const a = Math.min(amount, p.stack)
    p.stack = roundHalf(p.stack - a)
    p.streetBet = roundHalf(p.streetBet + a)
    p.totalBet = roundHalf(p.totalBet + a)
    if (p.stack === 0) p.allIn = true
  }

  // ---- вспомогательные ----

  private pot(): number {
    let s = this.potBanked
    for (const p of this.seats) s += p.streetBet
    return roundHalf(s)
  }

  private canAct(p: P): boolean {
    return !p.folded && !p.allIn && p.stack > 0
  }

  private hero(): P {
    return this.seats[this.heroIdx]
  }

  private toCallFor(p: P): number {
    return roundHalf(Math.max(0, this.currentBet - p.streetBet))
  }

  private callersExcluding(p: P): number {
    if (this.currentBet <= BB) return 0
    return this.seats.filter(
      (q) => q.idx !== p.idx && q.idx !== this.lastRaiserIdx && !q.folded && q.streetBet >= this.currentBet,
    ).length
  }

  // ---- порядок действия ----

  private streetOrder(): number[] {
    if (this.street === 'preflop') return this.seats.map((p) => p.idx)
    const order: number[] = []
    for (let k = 1; k <= this.players; k++) order.push((this.buttonIdx + k) % this.players)
    return order
  }

  private awaitNextActor(): void {
    if (this.checkOneLeft()) return
    const pending = this.seats.filter((p) => this.canAct(p) && (!p.acted || this.toCallFor(p) > 0))
    if (pending.length === 0) {
      this.nextStreet()
      return
    }
    const order = this.streetOrder()
    const start = order.indexOf(this.actorPtr)
    for (let k = 1; k <= this.players; k++) {
      const idx = order[((start + k) % this.players + this.players) % this.players]
      const p = this.seats[idx]
      if (this.canAct(p) && (!p.acted || this.toCallFor(p) > 0)) {
        this.actorPtr = idx
        if (p.isHero && this.needsHeroDecision()) this.awaitingHeroFlag = true
        return
      }
    }
    this.nextStreet()
  }

  /** Режим 'node': пауза только на узле nodeTarget (1..3-е решение героя). */
  private needsHeroDecision(): boolean {
    if (this.mode === 'full') return true
    return this.heroTurns === this.nodeTarget - 1
  }

  private checkOneLeft(): boolean {
    const alive = this.seats.filter((p) => !p.folded)
    if (alive.length === 1 && !this.finishedFlag) {
      const winner = alive[0]
      const won = roundHalf(this.pot())
      winner.stack = roundHalf(winner.stack + won)
      this.finish({
        text: `${winner.name} забирает банк ${fmt(won)} bb — все сбросили.`,
        heroWon: winner.isHero ? won : 0,
        boards: [],
        showdown: false,
      })
      return true
    }
    return false
  }

  // ---- применение действия ----

  private apply(p: P, kind: LiveActionKind, amount?: number): void {
    this.steps++
    if (this.steps > 800) throw new Error('live: слишком много шагов — зацикливание')
    p.acted = true
    switch (kind) {
      case 'fold':
        p.folded = true
        p.lastText = 'Фолд'
        this.log.push(`${p.name} (${p.seat}): фолд`)
        break
      case 'check':
        p.lastText = 'Чек'
        this.log.push(`${p.name} (${p.seat}): чек`)
        break
      case 'call': {
        const a = Math.min(this.toCallFor(p), p.stack)
        p.stack = roundHalf(p.stack - a)
        p.streetBet = roundHalf(p.streetBet + a)
        p.totalBet = roundHalf(p.totalBet + a)
        if (p.stack === 0) p.allIn = true
        p.lastText = `Колл ${fmt(a)}${p.allIn ? ' (олл-ин)' : ''}`
        this.log.push(`${p.name} (${p.seat}): колл ${fmt(a)}${p.allIn ? ' — олл-ин' : ''}`)
        break
      }
      case 'bet':
      case 'raise': {
        const target = roundHalf(Math.min(amount ?? 0, p.streetBet + p.stack))
        const prevBet = this.currentBet
        const add = roundHalf(target - p.streetBet)
        p.stack = roundHalf(p.stack - add)
        p.streetBet = target
        p.totalBet = roundHalf(p.totalBet + add)
        if (p.stack === 0) p.allIn = true
        this.currentBet = target
        this.lastRaiseSize = Math.max(this.lastRaiseSize, roundHalf(target - prevBet))
        this.betCount++
        this.lastRaiserIdx = p.idx
        p.lastText = `${kind === 'bet' ? 'Бет' : 'Рейз до'} ${fmt(target)}${p.allIn ? ' (олл-ин)' : ''}`
        this.log.push(`${p.name} (${p.seat}): ${p.lastText}`)
        break
      }
    }
    this.awaitingHeroFlag = false
    this.checkOneLeft()
    if (!this.finishedFlag) this.awaitNextActor()
  }

  // ---- оппоненты: префлоп ----

  private botPreflop(p: P): void {
    const facingRaise = this.currentBet > BB || this.betCount > 0
    const situation: 'open' | 'vsraise' = facingRaise ? 'vsraise' : 'open'
    const callers = this.callersExcluding(p)
    let act: 'raise' | 'call' | 'fold'
    if (this.kind === 'holdem') {
      const chart = holdemPreflop(p.pos, this.players, situation, callers, this.raiserPos() ?? undefined)
      const cls = handClass(p.cards[0], p.cards[1])
      const f = situation === 'vsraise' ? chart.freq.get(cls) ?? null : null
      act = sampleFreq(f, holdemAction(cls, chart), this.rand)
    } else {
      const chart = omahaPreflop(omahaGame(this.game), p.pos, this.players, situation, callers, this.raiserPos() ?? undefined)
      const f = omahaActionFreqs(omahaGame(this.game), p.cards, chart, situation)
      act = sampleFreq(f, freqDominant(f), this.rand)
    }
    // бесплатный чек (право большого блайнда) лучше фолда
    if (this.toCallFor(p) === 0 && act === 'fold') act = 'call'
    if (act === 'fold') this.apply(p, 'fold')
    else if (act === 'call') this.apply(p, 'call')
    else {
      const target = defaultRaiseTo(this.pot(), this.currentBet, this.lastRaiseSize, true, this.betCount)
      this.apply(p, this.betCount > 0 ? 'raise' : 'bet', target)
    }
  }

  private raiserPos(): Position | null {
    if (this.lastRaiserIdx === null) return null
    return this.seats[this.lastRaiserIdx].pos
  }

  // ---- оппоненты: постфлоп ----

  /** Сила руки: доля банка против others случайных рук (усреднение по доскам). */
  private strength(hand: Card[], others: number, iters = 150): number {
    const n = Math.max(1, Math.min(others, 8))
    let sum = 0
    for (const b of this.boards) {
      const sim = simulateEquity({ game: this.kind, hero: hand, board: b, opponents: n, iterations: iters, rand: this.rand })
      sum += sim.win + sim.tie / 2
    }
    return sum / this.boards.length
  }

  private botPostflop(p: P): void {
    const others = this.seats.filter((q) => !q.folded && q.idx !== p.idx).length
    const s = this.strength(p.cards, others)
    const toCall = this.toCallFor(p)
    const pot = this.pot()

    if (toCall === 0) {
      const pBet = s >= 0.85 ? 0.85 : s >= 0.7 ? 0.8 : s >= 0.55 ? 0.3 : 0.1
      if (this.rand() < pBet) {
        const size = s >= 0.8 ? 0.66 : 0.5
        this.apply(p, 'bet', roundHalf(Math.max(BB, pot * size)))
      } else {
        this.apply(p, 'check')
      }
      return
    }

    const potFrac = toCall / (pot + toCall)
    const margin = 0.02 + 0.03 * Math.max(0, others - 1)
    const callTh = Math.min(0.9, potFrac + margin)

    if (s >= 0.82 && this.betCount < 3 && this.rand() < 0.6) {
      this.apply(p, 'raise', defaultRaiseTo(pot, this.currentBet, this.lastRaiseSize, false, this.betCount))
      return
    }
    if (s >= callTh) {
      this.apply(p, 'call')
      return
    }
    const lower = callTh - 0.06
    if (s >= lower && this.rand() < (s - lower) / 0.06) {
      this.apply(p, 'call')
      return
    }
    if (others === 1 && s < lower && this.betCount < 2 && this.rand() < 0.05) {
      this.apply(p, 'raise', defaultRaiseTo(pot, this.currentBet, this.lastRaiseSize, false, this.betCount))
      return
    }
    this.apply(p, 'fold')
  }

  // ---- улицы ----

  private bankBets(): void {
    for (const p of this.seats) {
      this.potBanked += p.streetBet
      p.streetBet = 0
      p.acted = false
      p.lastText = null
    }
    this.currentBet = 0
    this.lastRaiseSize = BB
    this.betCount = 0
    this.lastRaiserIdx = null
    this.lastVerdict = null
  }

  private dealNextStreet(): void {
    if (this.street === 'preflop') {
      this.dealBoard(3)
      this.street = 'flop'
    } else if (this.street === 'flop') {
      this.dealBoard(1)
      this.street = 'turn'
    } else if (this.street === 'turn') {
      this.dealBoard(1)
      this.street = 'river'
    }
    const texture = analyzeBoardTexture(this.boards[0])
    this.log.push(`— ${STREET_NAMES_RU[this.street]}: ${texture.empty ? 'карты сданы' : texture.label}`)
  }

  private nextStreet(): void {
    this.bankBets()
    if (this.street === 'river') {
      this.showdown()
      return
    }
    this.dealNextStreet()
    // если действовать может максимум один игрок — ранаут без действий
    const actors = this.seats.filter((p) => this.canAct(p))
    if (actors.length <= 1) {
      // локальная переменная: TS не отслеживает изменение this.street внутри dealNextStreet()
      let st = this.street as Street
      while (st !== 'river') {
        this.bankBets()
        this.dealNextStreet()
        st = this.street
      }
      this.showdown()
      return
    }
    this.actorPtr = this.buttonIdx
    this.awaitNextActor()
  }

  private dealBoard(n: number): void {
    // у каждой доски свои карты
    for (const b of this.boards) {
      for (let k = 0; k < n; k++) b.push(this.deck[this.deckPtr++])
    }
  }

  // ---- вскрытие и банки (с сайд-потами) ----

  private showdown(): void {
    this.revealed = true
    const alive = this.seats.filter((p) => !p.folded)
    for (const p of alive) {
      p.handLabel = this.boards.map((b) => this.bestLabel(p.cards, b)).join(' / ')
    }
    // слои сайд-потов по общему внесённому
    const totals = this.seats.map((p) => p.totalBet)
    const levels = [...new Set(totals.filter((t) => t > 0))].sort((a, b) => a - b)
    const boardResults: BoardResult[] = []
    let heroWon = 0
    let prev = 0
    for (const L of levels) {
      let amount = 0
      for (const t of totals) if (t >= L) amount += L - prev
      amount = roundHalf(amount)
      prev = L
      if (amount <= 0) continue
      const eligible = this.seats.filter((p) => !p.folded && p.totalBet >= L)
      if (eligible.length === 0) continue
      const perBoard = amount / this.boards.length
      // доли досок кратно 0.5: первая округляется, вторая добирает остаток
      const firstShare = this.boards.length === 1 ? amount : roundHalf(perBoard)
      for (let bi = 0; bi < this.boards.length; bi++) {
        const boardShare = this.boards.length === 1 ? amount : bi === 0 ? firstShare : roundHalf(amount - firstShare)
        if (boardShare <= 0) continue
        const board = this.boards[bi]
        const scores = eligible.map((p) => this.bestScore(p.cards, board))
        let best = -1
        for (const s of scores) if (s > best) best = s
        const winners = eligible.filter((_, i) => scores[i] === best)
        // распределение кратно 0.5: последний добирает остаток слоя
        let given = 0
        for (let wi = 0; wi < winners.length; wi++) {
          const remain = roundHalf(boardShare - given)
          let s = wi < winners.length - 1 ? Math.min(roundHalf(boardShare / winners.length), remain) : remain
          s = Math.max(0, s)
          given = roundHalf(given + s)
          winners[wi].stack = roundHalf(winners[wi].stack + s)
          if (winners[wi].isHero) heroWon += s
        }
        boardResults.push({
          board: bi,
          winnerNames: winners.map((w) => w.name),
          label: this.bestLabel(winners[0].cards, board),
        })
      }
    }
    const grouped: BoardResult[] = this.boards.map((_, bi) => {
      const items = boardResults.filter((r) => r.board === bi)
      return {
        board: bi,
        winnerNames: items.flatMap((r) => r.winnerNames),
        label: items.map((r) => r.label).filter((v, i, a) => a.indexOf(v) === i).join(' + '),
      }
    })
    const wonText = heroWon > 0
      ? `Вы выиграли ${fmt(roundHalf(heroWon))} bb.`
      : `Вы проиграли ${fmt(roundHalf(this.hero().totalBet))} bb.`
    const parts = grouped.map((r) => {
      const name = this.boards.length > 1 ? `Доска ${r.board + 1}` : 'Вскрытие'
      const w = r.winnerNames.filter((v, i, a) => a.indexOf(v) === i).join(', ')
      return `${name}: ${w}${r.label ? ` — ${r.label}` : ''}`
    })
    this.finish({
      text: `${parts.join('. ')}. ${wonText}`,
      heroWon: roundHalf(heroWon),
      boards: grouped,
      showdown: true,
    })
  }

  private bestScore(cards: Card[], board: Card[]): number {
    if (this.kind === 'holdem') return evaluate7([cards[0], cards[1], ...board]).score
    return bestOmahaScoreFast(cards, board)
  }

  private bestLabel(cards: Card[], board: Card[]): string {
    if (this.kind === 'holdem') return handName(evaluate7([cards[0], cards[1], ...board]))
    return handName(bestOmahaHand(cards, board))
  }

  private finish(result: LiveResult): void {
    this.result = result
    this.finishedFlag = true
    this.awaitingHeroFlag = false
    this.log.push(result.text)
  }

  // ---- герой ----

  private heroPreflopGrade(p: P): { kind: LiveActionKind; reason: string } {
    const facingRaise = this.currentBet > BB || this.betCount > 0
    const situation: 'open' | 'vsraise' = facingRaise ? 'vsraise' : 'open'
    const callers = this.callersExcluding(p)
    const toCall = this.toCallFor(p)
    if (this.kind === 'holdem') {
      const chart = holdemPreflop(p.pos, this.players, situation, callers, this.raiserPos() ?? undefined)
      const cls = handClass(p.cards[0], p.cards[1])
      const base = holdemAction(cls, chart)
      const act: LiveActionKind = base === 'raise' ? (this.betCount > 0 ? 'raise' : 'bet') : base === 'call' ? (toCall > 0 ? 'call' : 'check') : toCall > 0 ? 'fold' : 'check'
      const f = situation === 'vsraise' ? chart.freq.get(cls) ?? null : null
      const pctNote = situation === 'open'
        ? `диапазон открытия с ${p.seat} ≈ топ ${Math.round(chart.raisePct)}% рук`
        : `защита ${p.seat} против рейза с ${this.raiserPos() ?? '?'}: 3бет ≈ топ ${Math.round(chart.raisePct)}%, колл ≈ топ ${Math.round(chart.callPct)}%`
      const mixNote = f && f.raise > 0 && f.raise < 100 ? ` Частоты GTO: ${freqText(f)}.` : ''
      return { kind: act, reason: `${cls}: ${pctNote}.${mixNote}` }
    }
    const game = omahaGame(this.game)
    const chart = omahaPreflop(game, p.pos, this.players, situation, callers, this.raiserPos() ?? undefined)
    const topPct = omahaHandPercentile(game, p.cards)
    let act: LiveActionKind
    if (situation === 'open') {
      act = handInRange(game, p.cards, chart.openPercent) ? 'bet' : toCall > 0 ? 'fold' : 'check'
    } else if (handInRange(game, p.cards, chart.threeBetPercent)) {
      act = 'raise'
    } else if (handInRange(game, p.cards, chart.callPercent)) {
      act = toCall > 0 ? 'call' : 'check'
    } else {
      act = toCall > 0 ? 'fold' : 'check'
    }
    const reason = situation === 'open'
      ? `Рука — топ ~${topPct}% стартовых; диапазон открытия с ${p.seat} ≈ топ ${chart.openPercent}%.`
      : `Рука — топ ~${topPct}% стартовых; защита ${p.seat}: 3бет ≈ топ ${Math.round(chart.threeBetPercent)}%, колл ≈ топ ${Math.round(chart.callPercent)}%.`
    return { kind: act, reason }
  }

  /** Эквити героя и верное действие на постфлопе. */
  private heroPostflopGrade(p: P): { kind: LiveActionKind; reason: string; eq: number; required: number } {
    const others = Math.max(1, this.seats.filter((q) => !q.folded && q.idx !== p.idx).length)
    let eq = 0
    for (const b of this.boards) {
      const sim = simulateEquity({ game: this.kind, hero: p.cards, board: b, opponents: others, iterations: 400, rand: this.rand })
      eq += sim.win + sim.tie / 2
    }
    eq /= this.boards.length
    const toCall = this.toCallFor(p)
    const pot = this.pot()
    const required = toCall > 0 ? toCall / (pot + toCall) : 0
    let kind: LiveActionKind
    if (toCall > 0) {
      if (eq >= required + 0.15) kind = 'raise'
      else if (eq >= required + 0.005) kind = 'call'
      else kind = 'fold'
    } else {
      kind = eq >= 0.62 ? 'bet' : 'check'
    }
    const eqPct = Math.round(eq * 1000) / 10
    const reqPct = Math.round(required * 1000) / 10
    const toCallText = toCall > 0
      ? `требуемое эквити ${reqPct}% (${fmt(toCall)} / (${fmt(pot)} + ${fmt(toCall)}))`
      : 'перед вами чек'
    const verdict = kind === 'raise' ? 'ставка/рейз для вэлью' : kind === 'call' ? 'колл прибылен' : kind === 'bet' ? 'ставка для вэлью' : 'чек'
    const reason =
      `Эквити ${eqPct}% против ${others} ${others === 1 ? 'случайной руки' : 'случайных рук'} (${this.boards.length > 1 ? 'среднее по доскам' : 'одна доска'}), ${toCallText} — ${verdict}. ` +
      'Эквити считается против случайных рук: против реального диапазона бэттера оно ниже — решение может отличаться (чаще фолд).'
    return { kind, reason, eq, required }
  }

  /** Варианты действий героя. */
  heroOptions(): HeroOptions | null {
    if (!this.awaitingHeroFlag || this.finishedFlag) return null
    const p = this.hero()
    const toCall = this.toCallFor(p)
    const pot = this.pot()
    const canRaise = this.betCount < 3
    const target = canRaise
      ? Math.min(defaultRaiseTo(pot, this.currentBet, this.lastRaiseSize, this.street === 'preflop', this.betCount), p.streetBet + p.stack)
      : 0
    const raiseAllIn = target >= roundHalf(p.streetBet + p.stack)
    const streetName = STREET_NAMES_RU[this.street]
    const prompt = toCall > 0
      ? `${streetName}: перед вами ставка ${fmt(this.currentBet)} bb (банк ${fmt(pot)} bb). Ваше действие?`
      : `${streetName}: ход за вами, банк ${fmt(pot)} bb. Ваше действие?`
    return {
      toCall,
      canFold: toCall > 0,
      canCheck: toCall === 0,
      canCall: toCall > 0,
      callAmount: Math.min(toCall, p.stack),
      canRaise,
      raiseTo: target,
      raiseAllIn,
      prompt,
    }
  }

  /** Действие героя. */
  heroAction(kind: 'fold' | 'check' | 'call' | 'raise'): void {
    if (!this.awaitingHeroFlag || this.finishedFlag) return
    const opts = this.heroOptions()
    if (!opts) return
    const p = this.hero()
    const best: { kind: LiveActionKind; reason: string; eq?: number; required?: number } =
      this.street === 'preflop' ? this.heroPreflopGrade(p) : this.heroPostflopGrade(p)
    this.heroTurns++
    const chosenKind: LiveActionKind = kind === 'raise' ? (this.currentBet > 0 ? 'raise' : 'bet') : kind
    const chosenText = chosenKind === 'raise' || chosenKind === 'bet'
      ? actionText(chosenKind, opts.raiseTo)
      : actionText(kind, kind === 'call' ? opts.callAmount : 0)
    const bestText = actionText(best.kind, best.kind === 'raise' || best.kind === 'bet' ? opts.raiseTo : opts.toCall)
    this.decisions.push({
      street: this.street,
      prompt: opts.prompt,
      chosen: chosenText,
      best: bestText,
      correct: chosenKind === best.kind,
      reason: best.reason,
      eqPct: best.eq !== undefined ? Math.round(best.eq * 1000) / 10 : undefined,
      requiredPct: best.required !== undefined ? Math.round(best.required * 1000) / 10 : undefined,
    })
    this.lastVerdict = { correct: chosenKind === best.kind, reason: best.reason }
    this.awaitingHeroFlag = false
    if (kind === 'fold') this.apply(p, 'fold')
    else if (kind === 'check') this.apply(p, 'check')
    else if (kind === 'call') this.apply(p, 'call')
    else this.apply(p, this.currentBet > 0 ? 'raise' : 'bet', opts.raiseTo)
  }

  // ---- шаг анимации ----

  /** Один автоматический шаг: действие бота или авто-действие героя до целевого узла. */
  step(): void {
    if (this.finishedFlag || this.awaitingHeroFlag) return
    const p = this.seats[this.actorPtr]
    if (!p || p.folded || p.allIn) {
      this.awaitNextActor()
      return
    }
    if (p.isHero && !this.needsHeroDecision()) {
      this.heroTurns++
      if (this.street === 'preflop') this.autoHeroPreflop(p)
      else this.autoHeroPostflop(p)
      return
    }
    if (this.street === 'preflop') this.botPreflop(p)
    else this.botPostflop(p)
  }

  private autoHeroPreflop(p: P): void {
    // до целевого узла не фолдим: рейз по чарту, иначе колл/чек
    const facingRaise = this.currentBet > BB || this.betCount > 0
    const situation: 'open' | 'vsraise' = facingRaise ? 'vsraise' : 'open'
    let willRaise = false
    if (this.kind === 'holdem') {
      const chart = holdemPreflop(p.pos, this.players, situation, this.callersExcluding(p), this.raiserPos() ?? undefined)
      willRaise = holdemAction(handClass(p.cards[0], p.cards[1]), chart) === 'raise'
    } else {
      const game = omahaGame(this.game)
      const chart = omahaPreflop(game, p.pos, this.players, situation, this.callersExcluding(p), this.raiserPos() ?? undefined)
      const percent = situation === 'open' ? chart.openPercent : chart.threeBetPercent
      willRaise = handInRange(game, p.cards, percent)
    }
    if (willRaise && this.betCount < 2) {
      this.apply(p, this.betCount > 0 ? 'raise' : 'bet', defaultRaiseTo(this.pot(), this.currentBet, this.lastRaiseSize, true, this.betCount))
    } else {
      this.apply(p, this.toCallFor(p) > 0 ? 'call' : 'check')
    }
  }

  private autoHeroPostflop(p: P): void {
    this.apply(p, this.toCallFor(p) > 0 ? 'call' : 'check')
  }

  /** Промотать до узла героя или конца раздачи. */
  skipToDecision(): void {
    let guard = 0
    while (!this.finishedFlag && !this.awaitingHeroFlag && guard++ < 800) this.step()
  }

  // ---- снимок для UI ----

  snapshot(): LiveSnapshot {
    const seats: SeatView[] = this.seats.map((p) => ({
      idx: p.idx,
      name: p.name,
      seat: p.seat,
      folded: p.folded,
      allIn: p.allIn,
      isHero: p.isHero,
      faceUp: p.isHero || (this.revealed && !p.folded),
      cards: p.cards,
      stack: roundHalf(p.stack),
      totalBet: roundHalf(p.totalBet),
      lastText: p.lastText,
      handLabel: p.handLabel,
    }))
    return {
      street: this.street,
      streetLabel: STREET_NAMES_RU[this.street],
      pot: this.pot(),
      boards: this.boards.map((b) => [...b]),
      dealtPerBoard: this.boards[0].length,
      seats,
      buttonIdx: this.buttonIdx,
      awaitingHero: this.awaitingHeroFlag,
      finished: this.finishedFlag,
      options: this.heroOptions(),
      decisions: this.decisions,
      log: this.log.slice(-8),
      result: this.result,
      lastVerdict: this.lastVerdict,
      heroSeat: this.heroIdx,
      mode: this.mode,
    }
  }
}

// ============ вспомогательные функции ============

function sampleFreq(f: ActionFreq | null, base: 'raise' | 'call' | 'fold', rand: () => number): 'raise' | 'call' | 'fold' {
  if (!f) return base
  const r = rand() * 100
  if (r < f.raise) return 'raise'
  if (r < f.raise + f.call) return 'call'
  return 'fold'
}

function freqDominant(f: ActionFreq): 'raise' | 'call' | 'fold' {
  if (f.raise >= f.call && f.raise >= f.fold) return 'raise'
  if (f.call >= f.fold) return 'call'
  return 'fold'
}

function freqText(f: ActionFreq): string {
  const parts: string[] = []
  if (f.raise > 0) parts.push(`3бет ${Math.round(f.raise)}%`)
  if (f.call > 0) parts.push(`колл ${Math.round(f.call)}%`)
  if (f.fold > 0) parts.push(`фолд ${Math.round(f.fold)}%`)
  return parts.join(' / ')
}

/** Размер ставки/рейза по умолчанию («до»), без капа по стеку — кап делает apply. */
export function defaultRaiseTo(pot: number, currentBet: number, lastRaiseSize: number, preflop: boolean, betCount: number): number {
  let target: number
  if (preflop) {
    if (betCount === 0) target = 2.5
    else if (betCount === 1) target = currentBet * 3
    else target = currentBet * 2.5
  } else {
    if (currentBet === 0) target = Math.max(BB, pot * 0.66)
    else target = currentBet + Math.max(lastRaiseSize, pot * 0.5)
  }
  target = roundHalf(target)
  const minTo = currentBet === 0 ? BB : roundHalf(currentBet + lastRaiseSize)
  return Math.max(target, minTo)
}
