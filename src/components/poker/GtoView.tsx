'use client'

// GTO-чарты: стол, позиция, рейзер (для защиты), раунд; постфлоп — с текстурой
// доски, размерами ставок, смешанными частотами и границами против ставок.
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
  postflopPlan, preflopNotes,
} from '@/lib/poker/gto'
import type { Street, TierPlan } from '@/lib/poker/gto'
import type { Position } from '@/lib/poker/ranges'
import { parseCard } from '@/lib/poker/cards'
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
  raiser?: string // базовая позиция рейзера (для ситуации «против рейза»)
}

// предустановки текстуры доски (флоп из 3 карт)
const TEXTURE_PRESETS: Array<{ id: string; label: string; codes: string[] }> = [
  { id: 'dry', label: 'Сухая радуга', codes: ['9h', '4s', '2d'] },
  { id: 'wet', label: 'Связанная', codes: ['9s', '8d', '5h'] },
  { id: 'twotone', label: 'Двухмастная', codes: ['Kd', '9d', '4c'] },
  { id: 'twotoneStr', label: 'Двухмастная связанная', codes: ['Qs', 'Js', 'Td'] },
  { id: 'mono', label: 'Моно-масть', codes: ['8h', '5h', '2h'] },
  { id: 'paired', label: 'Спаренная', codes: ['Ks', 'Kd', '7c'] },
]

const FACING_OPTIONS: Array<{ pct: number; label: string }> = [
  { pct: 0, label: 'Нет ставки' },
  { pct: 33, label: 'Малая 33%' },
  { pct: 66, label: 'Средняя 66%' },
  { pct: 100, label: 'Крупная 100%' },
]

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

const MIX_CHIP: Record<string, string> = {
  bet: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  raise: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  check: 'bg-stone-700/60 text-stone-200 border border-stone-600',
  call: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  fold: 'bg-stone-800 text-stone-400 border border-stone-700',
}

const VERDICT_CHIP: Record<string, string> = {
  call: 'bg-sky-600/80 text-white',
  fold: 'bg-red-800/80 text-stone-100',
  raise: 'bg-emerald-600/90 text-white',
  mix: 'bg-amber-600/80 text-white',
}

const VERDICT_LABEL: Record<string, string> = {
  call: 'Колл',
  fold: 'Фолд',
  raise: 'Рейз',
  mix: 'Микс',
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
  const [raiser, setRaiser] = useState<string>(() => (initial?.raiser ? basePos(initial.raiser) : 'CO'))
  const [textureId, setTextureId] = useState('dry')
  const [facing, setFacing] = useState<number>(0)

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

  // позиции рейзера, против которых защита валидна
  const raiserOptions = useMemo(() => {
    if (pos === 'UTG') return ['UTG'] // UTG1/UTG2 за 9-max — та же базовая позиция
    const order = ['UTG', 'MP', 'CO', 'BTN', 'SB']
    if (pos === 'BB') return order // BB защищается против любых рейзеров
    return order.slice(0, order.indexOf(pos))
  }, [pos])

  const effectiveRaiser = (raiserOptions.includes(raiser) ? raiser : raiserOptions[raiserOptions.length - 1] ?? 'CO') as Position

  const holdemChart = useMemo(() => (street === 'preflop'
    ? holdemPreflop(pos, players, situation, callers, effectiveRaiser)
    : null), [street, pos, players, situation, callers, effectiveRaiser])

  const omahaChart = useMemo(() => (street === 'preflop' && game !== 'holdem'
    ? omahaPreflop(game as 'omaha4' | 'omaha5', pos, players, situation, callers, effectiveRaiser)
    : null), [street, game, pos, players, situation, callers, effectiveRaiser])

  const plan = useMemo(() => (street !== 'preflop'
    ? postflopPlan(game, street, TEXTURE_PRESETS.find((p) => p.id === textureId)?.codes.map((code) => parseCard(code) as PokerCard) ?? [], opponents, seat, facing > 0 ? facing : null)
    : null), [game, street, opponents, seat, textureId, facing])

  const notes = useMemo(() => (street === 'preflop'
    ? preflopNotes(game, pos, situation, callers, effectiveRaiser, players)
    : []), [game, street, pos, situation, callers, effectiveRaiser, players])

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

  return (
    <TrainerShell
      title="GTO-чарты"
      subtitle="Отдельные чарты для столов 2–9-max; защита против рейза — с учётом позиции рейзера"
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

        {/* Позиция рейзера (префлоп, против рейза) */}
        {street === 'preflop' && situation === 'vsraise' && (
          <SelectorRow label="Кто рейзил">
            {raiserOptions.map((r) => (
              <button key={r} type="button" onClick={() => setRaiser(r)} className={btnCls(effectiveRaiser === r)} title={SEAT_NAMES_RU[r] ?? r}>
                {r}
              </button>
            ))}
            <span className="text-xs text-stone-500 ml-1">
              чем позже рейзер, тем шире защита
            </span>
          </SelectorRow>
        )}

        {/* Текстура доски (постфлоп) */}
        {street !== 'preflop' && (
          <SelectorRow label="Доска">
            {TEXTURE_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setTextureId(p.id)} className={btnCls(textureId === p.id)}>
                {p.label}
              </button>
            ))}
          </SelectorRow>
        )}

        {/* Размер ставки оппонента (постфлоп) */}
        {street !== 'preflop' && (
          <SelectorRow label="Ставка оппонента">
            {FACING_OPTIONS.map((o) => (
              <button key={o.pct} type="button" onClick={() => setFacing(o.pct)} className={btnCls(facing === o.pct)}>
                {o.label}
              </button>
            ))}
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
        <PreflopHoldem chart={holdemChart} pos={pos} players={players} situation={situation} raiser={effectiveRaiser} opponents={opponents} notes={notes} />
      )}

      {street === 'preflop' && game !== 'holdem' && omahaChart && (
        <PreflopOmaha
          game={game as 'omaha4' | 'omaha5'}
          chart={omahaChart}
          pos={pos}
          situation={situation}
          raiser={effectiveRaiser}
          players={players}
          opponents={opponents}
          notes={notes}
          openHands={omahaOpenHands}
          callHands={omahaCallHands}
          composition={omahaComposition}
        />
      )}

      {/* Результат: постфлоп */}
      {street !== 'preflop' && plan && (
        <Card className="border-stone-800 bg-stone-900/60">
          <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
            <h2 className="text-sm font-normal text-stone-100">{plan.intro}</h2>
            <div className="rounded-lg border border-stone-800 bg-neutral-900/50 p-3 flex flex-col gap-1">
              <p className="text-xs font-normal text-amber-200">{plan.textureLabel}</p>
              <p className="text-xs text-stone-300">{plan.textureNote}</p>
            </div>
            {plan.facingLabel && (
              <p className="text-xs text-sky-300">Сценарий: {plan.facingLabel.toLowerCase()} — ниже вердикты и границы по каждому тиру</p>
            )}

            <div className="flex flex-col gap-2">
              {plan.tiers.map((t) => (
                <TierCard key={t.tier} t={t} facingPct={facing > 0 ? facing : null} />
              ))}
            </div>

            <div className="rounded-lg border border-stone-800 bg-neutral-900/50 p-3">
              <p className="text-xs text-stone-200">{plan.multiwayNote}</p>
            </div>
            <p className="text-xs text-stone-400">{plan.positionNote}</p>
            <p className="text-xs text-stone-500">{plan.gameNote}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-stone-500 leading-relaxed">
        Чарты упрощены для обучения: для каждого размера стола 2–9-max задан свой диапазон открытия; ширина
        защиты против рейза зависит от позиции рейзера. Постфлоп-план учитывает текстуру доски, размер ставки
        оппонента и смешанные частоты, но в реальной GTO-стратегии значения ещё зависят от стеков, тендеров и
        типов оппонентов. Диапазоны Омахи оцениваются по структуре руки (тузы, мастевость, связки, пары).
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

function TierCard({ t, facingPct }: { t: TierPlan; facingPct: number | null }) {
  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/80 p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', TIER_DOT[t.action])} />
        <span className="text-sm font-normal text-stone-100">{t.tier}</span>
        <span className="text-xs text-stone-500">{t.examples}</span>
      </div>
      <p className="text-xs text-stone-300 pl-4"><span className="text-emerald-400">На инициативе:</span> {t.line}</p>
      <div className="flex flex-wrap gap-1.5 pl-4">
        {t.mix.map((m, i) => (
          <span key={i} className={cn('px-2 py-0.5 rounded text-[11px] font-normal', MIX_CHIP[m.action] ?? MIX_CHIP.fold)}>
            {m.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-stone-400 pl-4">{t.sizeNote}</p>
      {facingPct != null && t.verdict && (
        <div className="pl-4 flex items-center gap-2 flex-wrap">
          <span className={cn('px-2 py-0.5 rounded text-[11px] font-normal', VERDICT_CHIP[t.verdict.verdict])}>
            {VERDICT_LABEL[t.verdict.verdict]}
          </span>
          <span className="text-xs text-stone-300">{t.verdict.note}</span>
        </div>
      )}
      <p className="text-xs text-stone-400 pl-4"><span className="text-sky-400">Границы:</span> {t.vsBetNote}</p>
      {t.textureNote && <p className="text-xs text-amber-300/70 pl-4">Текстура: {t.textureNote}</p>}
    </div>
  )
}

function PreflopHoldem({
  chart, pos, players, situation, raiser, opponents, notes,
}: {
  chart: ReturnType<typeof holdemPreflop>
  pos: string
  players: number
  situation: 'open' | 'vsraise'
  raiser: string
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
            ? `Открытие с ${pos} за столом ${players}-max${opponents > 0 ? ` против ${opponents} лимпов: рейз чуть тайтовее` : ''} — отдельный чарт под этот размер стола.`
            : `Защита ${pos} против открытия с ${raiser} за столом ${players}-max${opponents > 1 ? ` и ${opponents - 1} колл${opponents - 1 === 1 ? 'ом' : 'ами'}` : ''}.`}
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
  game, chart, pos, situation, raiser, players, opponents, notes, openHands, callHands, composition,
}: {
  game: 'omaha4' | 'omaha5'
  chart: ReturnType<typeof omahaPreflop>
  pos: string
  situation: 'open' | 'vsraise'
  raiser: string
  players: number
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
            ? `Открытие с ${pos} (${game === 'omaha4' ? 'PLO4' : 'PLO5'}) за столом ${players}-max${opponents > 0 ? ` против ${opponents} лимп${opponents === 1 ? 'а' : 'ов'}: чуть тайтовее` : ''} — отдельный чарт под этот размер стола.`
            : `Защита ${pos} против открытия с ${raiser} (${game === 'omaha4' ? 'PLO4' : 'PLO5'}, стол ${players}-max)${opponents > 1 ? ` и ${opponents - 1} колл${opponents - 1 === 1 ? 'ом' : 'ами'}` : ''}.`}
        </p>
        <NotesList notes={notes} />
      </CardContent>
    </Card>
  )
}
