'use client'

// GTO-чарты: выбираем стол, позицию, число соперников и раунд —
// видим, что играть (рейз/колл), а что сбрасывать.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrainerShell, ScenarioCard } from './TrainerShell'
import { RangeGrid } from './RangeGrid'
import { GAME_NAMES_RU, HOLE_COUNT, sampleRangeHands, omahaRangeComposition, handToSymbols } from '@/lib/poker/handRanges'
import type { GameKind } from '@/lib/poker/handRanges'
import {
  STREET_NAMES_RU, seatsForTable, SEAT_NAMES_RU, basePos,
  holdemPreflop, holdemAction, omahaPreflop,
  postflopGuide, preflopNotes,
} from '@/lib/poker/gto'
import type { Street } from '@/lib/poker/gto'
import type { Card as PokerCard } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

const GAMES: GameKind[] = ['holdem', 'omaha4', 'omaha5']
const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river']

/** Параметры для предустановки чартов (например, переход из симулятора раздач). */
export interface GtoInitial {
  game?: GameKind
  players?: number
  seat?: string // базовая позиция (UTG/MP/CO/BTN/SB/BB)
  street?: Street
  situation?: 'open' | 'vsraise'
  opponents?: number
}

const ACTION_STYLES: Record<'raise' | 'call' | 'fold', string> = {
  raise: 'bg-emerald-500/90 text-stone-950',
  call: 'bg-sky-700/90 text-stone-50',
  fold: 'bg-stone-800/70 text-stone-500',
}

const TIER_DOT: Record<'bet' | 'call' | 'fold', string> = {
  bet: 'bg-emerald-500',
  call: 'bg-sky-500',
  fold: 'bg-red-500',
}

export function GtoView({ onBack, initial }: { onBack: () => void; initial?: GtoInitial | null }) {
  // предустановка из симулятора: валидируем место за столом под размер стола
  const [game, setGame] = useState<GameKind>(initial?.game ?? 'holdem')
  const [players, setPlayers] = useState(initial?.players ?? 6)
  const [seat, setSeat] = useState(() => {
    const p = initial?.players ?? 6
    const seats = seatsForTable(p)
    if (initial?.seat) {
      const bp = basePos(initial.seat)
      const match = seats.find((s) => basePos(s) === bp)
      if (match) return match
    }
    return seats.includes('CO') ? 'CO' : seats[0]
  })
  const [opponents, setOpponents] = useState(initial?.opponents ?? 0) // 0 только для «открытия» на префлопе
  const [street, setStreet] = useState<Street>(initial?.street ?? 'preflop')
  const [situation, setSituation] = useState<'open' | 'vsraise'>(initial?.situation ?? 'open')

  const seats = seatsForTable(players)
  const maxOpp = Math.min(players - 1, 8)

  function changePlayers(n: number) {
    setPlayers(n)
    if (!seatsForTable(n).includes(seat)) setSeat(n === 2 ? 'BTN' : 'CO')
    setOpponents((o) => Math.min(o, Math.min(n - 1, 8)))
  }

  function changeStreet(s: Street) {
    setStreet(s)
    if (s !== 'preflop' && opponents < 1) setOpponents(1)
    if (s !== 'preflop') setSituation('open')
  }

  function changeSituation(s: 'open' | 'vsraise') {
    setSituation(s)
    if (s === 'vsraise' && opponents < 1) setOpponents(1)
  }

  const pos = basePos(seat)
  const callers = situation === 'vsraise' && street === 'preflop' ? Math.max(0, opponents - 1) : 0

  const holdemChart = useMemo(() => (street === 'preflop'
    ? holdemPreflop(pos, players, situation, callers)
    : null), [street, pos, players, situation, callers])

  const omahaChart = useMemo(() => (street === 'preflop' && game !== 'holdem'
    ? omahaPreflop(game as 'omaha4' | 'omaha5', pos, players, situation, callers)
    : null), [street, game, pos, players, situation, callers])

  const guide = useMemo(() => (street !== 'preflop'
    ? postflopGuide(game, street, opponents, seat)
    : null), [game, street, opponents, seat])

  const notes = useMemo(() => (street === 'preflop'
    ? preflopNotes(game, pos, situation, callers)
    : []), [game, street, pos, situation, callers])

  const omahaOpenHands = useMemo(() => {
    if (street !== 'preflop' || game === 'holdem' || !omahaChart) return null
    if (situation === 'open') return sampleRangeHands(game as 'omaha4' | 'omaha5', omahaChart.openPercent, 8, 31)
    return sampleRangeHands(game as 'omaha4' | 'omaha5', omahaChart.threeBetPercent, 5, 17)
  }, [street, game, omahaChart, situation])

  const omahaCallHands = useMemo(() => {
    if (street !== 'preflop' || game === 'holdem' || !omahaChart || situation === 'open') return null
    return sampleRangeHands(game as 'omaha4' | 'omaha5', omahaChart.callPercent, 5, 23)
  }, [street, game, omahaChart, situation])

  const omahaComposition = useMemo(() => {
    if (street !== 'preflop' || game === 'holdem' || !omahaChart) return null
    const percent = situation === 'open' ? omahaChart.openPercent : omahaChart.callPercent
    return omahaRangeComposition(game as 'omaha4' | 'omaha5', percent, 2500)
  }, [street, game, omahaChart, situation])

  // демонстрационная рука Омахи для сетки действий «рейз/колл/фолд» не нужна:
  // вместо сетки показываем примеры и состав диапазона

  return (
    <TrainerShell
      title="GTO-чарты"
      subtitle="Стол, позиция, соперники и раунд — что играть, а что сбрасывать"
      onBack={onBack}
    >
      <ScenarioCard>
        {/* Игра */}
        <SelectorRow label="Игра">
          {GAMES.map((g) => (
            <button key={g} type="button" onClick={() => setGame(g)} className={btnCls(game === g)}>
              {GAME_NAMES_RU[g]}
            </button>
          ))}
        </SelectorRow>

        {/* Стол */}
        <SelectorRow label="Стол">
          {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" onClick={() => changePlayers(n)} className={cn(btnCls(players === n), 'w-12')}>
              {n} игр.
            </button>
          ))}
        </SelectorRow>

        {/* Позиция */}
        <SelectorRow label="Позиция">
          {seats.map((s) => (
            <button key={s} type="button" onClick={() => setSeat(s)} className={btnCls(seat === s)} title={SEAT_NAMES_RU[s] ?? s}>
              {s}
            </button>
          ))}
        </SelectorRow>

        {/* Раунд */}
        <SelectorRow label="Раунд">
          {STREETS.map((s) => (
            <button key={s} type="button" onClick={() => changeStreet(s)} className={btnCls(street === s)}>
              {STREET_NAMES_RU[s]}
            </button>
          ))}
        </SelectorRow>

        {/* Ситуация (только префлоп) */}
        {street === 'preflop' && (
          <SelectorRow label="Ситуация">
            <button type="button" onClick={() => changeSituation('open')} className={btnCls(situation === 'open')}>
              Все сбросили — открытие
            </button>
            <button type="button" onClick={() => changeSituation('vsraise')} className={btnCls(situation === 'vsraise')}>
              Против рейза
            </button>
          </SelectorRow>
        )}

        {/* Соперники */}
        <SelectorRow label={street === 'preflop' && situation === 'open' ? 'Лимпов до вас' : 'Соперников в банке'}>
          {Array.from({ length: (street === 'preflop' && situation === 'open' ? maxOpp + 1 : maxOpp) }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpponents(i)}
              className={cn(btnCls(opponents === i), 'w-8')}
              disabled={street !== 'preflop' && i === 0}
            >
              {i}
            </button>
          ))}
          <span className="text-xs text-stone-500 ml-1">
            {street === 'preflop' && situation === 'open'
              ? '(0 — вы действуете первым)'
              : situation === 'vsraise'
                ? `(рейзер + ${Math.max(0, opponents - 1)} колл${Math.max(0, opponents - 1) === 1 ? '' : Math.max(0, opponents - 1) >= 2 && Math.max(0, opponents - 1) <= 4 ? 'а' : 'ов'})`
                : `(до ${maxOpp} — стол ${players}-max)`}
          </span>
        </SelectorRow>
      </ScenarioCard>

      {/* Результат: префлоп */}
      {street === 'preflop' && game === 'holdem' && holdemChart && (
        <PreflopHoldem chart={holdemChart} pos={pos} players={players} situation={situation} opponents={opponents} notes={notes} />
      )}

      {street === 'preflop' && game !== 'holdem' && omahaChart && (
        <PreflopOmaha
          game={game as 'omaha4' | 'omaha5'}
          chart={omahaChart}
          pos={pos}
          situation={situation}
          opponents={opponents}
          notes={notes}
          openHands={omahaOpenHands}
          callHands={omahaCallHands}
          composition={omahaComposition}
        />
      )}

      {/* Результат: постфлоп */}
      {street !== 'preflop' && guide && (
        <Card className="border-stone-800 bg-stone-900/60">
          <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
            <h2 className="text-sm font-normal text-stone-100">{guide.intro}</h2>
            <p className="text-xs text-stone-400">{guide.gameNote}</p>

            <div className="flex flex-col gap-2">
              {guide.tiers.map((t) => (
                <div key={t.tier} className="rounded-lg border border-stone-800 bg-stone-900/80 p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', TIER_DOT[t.action])} />
                    <span className="text-sm font-normal text-stone-100">{t.tier}</span>
                    <span className="text-xs text-stone-500">{t.examples}</span>
                  </div>
                  <p className="text-xs text-stone-300 pl-4"><span className="text-emerald-400">На инициативе:</span> {t.aggressive}</p>
                  <p className="text-xs text-stone-300 pl-4"><span className="text-sky-400">Против ставки:</span> {t.facingBet}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-stone-800 bg-neutral-900/50 p-3">
              <p className="text-xs text-stone-200">{guide.multiwayNote}</p>
            </div>
            <p className="text-xs text-stone-400">{guide.positionNote}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-stone-500 leading-relaxed">
        Чарты упрощены для обучения: GTO-стратегии в реальности зависят от стеков, тендеров доски, типов
        оппонентов и динамики раздачи. Диапазоны Омахи оцениваются по структуре руки (тузы, мастевость,
        связки, пары) и заданы как «топ N%» стартовых рук.
      </p>
    </TrainerShell>
  )
}

// ---------- Подкомпоненты ----------

function btnCls(active: boolean): string {
  return cn(
    'px-3 h-8 rounded-md text-xs sm:text-sm font-normal transition',
    active ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700',
  )
}

function SelectorRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <span className="text-xs text-stone-400 sm:w-32 shrink-0">{label}:</span>
      <div className="flex flex-wrap gap-1.5 items-center">{children}</div>
    </div>
  )
}

function SummaryLine({ items }: { items: Array<{ text: string; action?: 'raise' | 'call' | 'fold' }> }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {items.map((it, i) => (
        <span
          key={i}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-normal',
            it.action ? ACTION_STYLES[it.action] : 'bg-stone-800 text-stone-200',
          )}
        >
          {it.text}
        </span>
      ))}
    </div>
  )
}

function NotesList({ notes }: { notes: string[] }) {
  return (
    <ul className="text-xs text-stone-300 flex flex-col gap-1 list-disc pl-4">
      {notes.map((n, i) => <li key={i}>{n}</li>)}
    </ul>
  )
}

function PreflopHoldem({
  chart, pos, players, situation, opponents, notes,
}: {
  chart: ReturnType<typeof holdemPreflop>
  pos: string
  players: number
  situation: 'open' | 'vsraise'
  opponents: number
  notes: string[]
}) {
  return (
    <Card className="border-stone-800 bg-stone-900/60">
      <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
        <SummaryLine
          items={situation === 'open'
            ? [
                { text: `Рейз: топ ${chart.raisePct.toFixed(0)}% рук`, action: 'raise' },
                { text: 'Фолд: остальное', action: 'fold' },
              ]
            : [
                { text: `3бет: топ ${chart.raisePct.toFixed(0)}%`, action: 'raise' },
                { text: `Колл: топ ${chart.callPct.toFixed(0)}%`, action: 'call' },
                { text: 'Фолд: остальное', action: 'fold' },
              ]}
        />
        <RangeGrid getAction={(cls) => holdemAction(cls, chart)} />
        <LegendHoldem situation={situation} />
        <p className="text-xs text-stone-400">
          {situation === 'open'
            ? `Открытие с ${pos} за столом ${players}-max${opponents > 0 ? ` против ${opponents} лимпов: рейз чуть тайтовее` : ''}.`
            : `Против рейза с ${pos}${opponents > 1 ? ` и ${opponents - 1} колл${opponents - 1 === 1 ? 'ом' : 'ами'}` : ''}.`}
        </p>
        <NotesList notes={notes} />
      </CardContent>
    </Card>
  )
}

function LegendHoldem({ situation }: { situation: 'open' | 'vsraise' }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500/90 inline-block" /> {situation === 'open' ? 'Рейз (открытие)' : '3бет'}
      </span>
      {situation === 'vsraise' && (
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm bg-sky-700/90 inline-block" /> Колл
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-stone-800/70 border border-stone-700 inline-block" /> Фолд
      </span>
    </div>
  )
}

function PreflopOmaha({
  game, chart, pos, situation, opponents, notes, openHands, callHands, composition,
}: {
  game: 'omaha4' | 'omaha5'
  chart: ReturnType<typeof omahaPreflop>
  pos: string
  situation: 'open' | 'vsraise'
  opponents: number
  notes: string[]
  openHands: PokerCard[][] | null
  callHands: PokerCard[][] | null
  composition: Array<{ label: string; pct: number }> | null
}) {
  const hc = HOLE_COUNT[game]
  return (
    <Card className="border-stone-800 bg-stone-900/60">
      <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
        <SummaryLine
          items={situation === 'open'
            ? [
                { text: `Рейз: топ ${chart.openPercent.toFixed(0)}% рук (оценка ≥ ${chart.openThreshold.toFixed(0)})`, action: 'raise' },
                { text: 'Фолд: слабее', action: 'fold' },
              ]
            : [
                { text: `3бет: топ ${chart.threeBetPercent.toFixed(0)}% (≥ ${chart.threeBetThreshold.toFixed(0)})`, action: 'raise' },
                { text: `Колл: топ ${chart.callPercent.toFixed(0)}% (≥ ${chart.callThreshold.toFixed(0)})`, action: 'call' },
                { text: 'Фолд: слабее', action: 'fold' },
              ]}
        />

        {openHands && openHands.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-400">
              {situation === 'open' ? 'Примеры рук на рейз:' : 'Примеры рук на 3бет:'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {openHands.map((h, i) => (
                <span key={i} className="px-2 py-1.5 rounded-md bg-stone-900 border border-stone-700 text-xs text-stone-100 text-center">
                  {handToSymbols(h)}
                </span>
              ))}
            </div>
          </div>
        )}

        {callHands && callHands.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-400">Примеры рук на колл:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {callHands.map((h, i) => (
                <span key={i} className="px-2 py-1.5 rounded-md bg-stone-900 border border-sky-800 text-xs text-stone-100 text-center">
                  {handToSymbols(h)}
                </span>
              ))}
            </div>
          </div>
        )}

        {composition && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-400">
              Состав диапазона ({situation === 'open' ? 'рейз' : 'колл'}, {hc} карт):
            </span>
            {composition.filter((c) => c.pct > 0).map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <span className="w-40 text-stone-400 shrink-0">{c.label}</span>
                <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div className="bg-emerald-500/80 h-full" style={{ width: `${Math.min(100, c.pct)}%` }} />
                </div>
                <span className="w-10 text-right text-stone-300">{c.pct}%</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-stone-400">
          {situation === 'open'
            ? `Открытие с ${pos} (${game === 'omaha4' ? 'PLO4' : 'PLO5'})${opponents > 0 ? ` против ${opponents} лимп${opponents === 1 ? 'а' : 'ов'}: чуть тайтовее` : ''}.`
            : `Против рейза с ${pos}${opponents > 1 ? ` и ${opponents - 1} колл${opponents - 1 === 1 ? 'ом' : 'ами'}` : ''}.`}
        </p>
        <NotesList notes={notes} />
      </CardContent>
    </Card>
  )
}

