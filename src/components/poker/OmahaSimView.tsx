'use client'

// Симулятор раздач для Омахи с двумя досками: 4-card и 5-card.
// Префлоп: решения по GTO-чартам позиции (как в разделе GTO-чарты).
// Постфлоп: решения по эквити двух досок. После ответа — чарт позиции и переход в GTO.
import { useState } from 'react'
import { Compass, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CardRow } from './PlayingCard'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import {
  OmahaSimScenario,
  OmahaSimAction,
  genOmahaSimScenario,
} from '@/lib/poker/omahaSim'
import { POSITION_NAMES_RU } from '@/lib/poker/ranges'
import type { GameKind } from '@/lib/poker/handRanges'
import type { Street } from '@/lib/poker/gto'
import type { GtoInitial } from './GtoView'
import { cn } from '@/lib/utils'

type DoubleVariant = 'double4' | 'double5'

const TRAINER_BY_VARIANT: Record<DoubleVariant, 'omaha4sim' | 'omaha5sim'> = {
  double4: 'omaha4sim',
  double5: 'omaha5sim',
}

const META: Record<DoubleVariant, { title: string; subtitle: string; badge: string }> = {
  double4: {
    title: 'Симулятор раздач · 4-card Омаха',
    subtitle: 'Двойной борд: фолд, колл или рейз — как за реальным столом',
    badge: '4 карты руки · 2 доски',
  },
  double5: {
    title: 'Симулятор раздач · 5-card Омаха',
    subtitle: 'Пять карт руки на двух досках: решения с разбором эквити',
    badge: '5 карт руки · 2 доски',
  },
}

const CHIP_STYLES: Record<'raise' | 'call' | 'fold', string> = {
  raise: 'bg-emerald-500/90 text-stone-950',
  call: 'bg-sky-700/90 text-stone-50',
  fold: 'bg-stone-800/70 text-stone-500',
}

const ACTION_RU: Record<OmahaSimAction, string> = {
  raise: 'рейз',
  call: 'колл',
  fold: 'фолд',
}

function boardStreetLabel(n: number): string {
  return n === 3 ? 'Флоп' : n === 4 ? 'Терн' : 'Ривер'
}

/** Параметры GTO-чартов для текущей ситуации (переход из симулятора). */
function gtoInitFor(scenario: OmahaSimScenario): GtoInitial {
  const game: GameKind = scenario.holeCount === 4 ? 'omaha4' : 'omaha5'
  if (scenario.kind === 'postflop') {
    const [n1, n2] = scenario.boardStreets!
    const street: Street = n1 === n2 ? (n1 === 3 ? 'flop' : 'turn') : 'flop'
    return { game, street, seat: 'BB', opponents: 1 }
  }
  return {
    game,
    players: scenario.players,
    seat: scenario.position,
    street: 'preflop',
    situation: scenario.kind === 'open' ? 'open' : 'vsraise',
    opponents: scenario.kind === 'open' ? 0 : 1,
  }
}

function OpenGtoButton({ scenario, onOpenGto }: { scenario: OmahaSimScenario; onOpenGto?: (init: GtoInitial) => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onOpenGto?.(gtoInitFor(scenario))}
      disabled={!onOpenGto}
      className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/40 hover:text-emerald-200 h-8 shrink-0"
    >
      Открыть в GTO-чартах
      <ArrowUpRight className="w-3.5 h-3.5" />
    </Button>
  )
}

/** Панель GTO-чарта позиции (префлоп): диапазон рейза/колла и место руки. */
function GtoChartPanel({ scenario, onOpenGto }: { scenario: OmahaSimScenario; onOpenGto?: (init: GtoInitial) => void }) {
  const chart = scenario.chart!
  const chips: Array<{ text: string; action: 'raise' | 'call' | 'fold' }> = scenario.kind === 'open'
    ? [
        { text: `Рейз: топ ~${Math.round(chart.openPercent)}% рук`, action: 'raise' },
        { text: 'Фолд: остальное', action: 'fold' },
      ]
    : [
        { text: `3бет: топ ~${Math.round(chart.threeBetPercent)}%`, action: 'raise' },
        { text: `Колл: топ ~${Math.round(chart.callPercent)}%`, action: 'call' },
        { text: 'Фолд: остальное', action: 'fold' },
      ]
  return (
    <Card className="border-emerald-800/60 bg-emerald-950/40">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-normal text-stone-100 flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              GTO-чарт · {POSITION_NAMES_RU[scenario.position]} · стол {scenario.players}-max
            </span>
          </h3>
          <OpenGtoButton scenario={scenario} onOpenGto={onOpenGto} />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <span key={i} className={cn('px-3 py-1.5 rounded-md text-xs font-normal', CHIP_STYLES[c.action])}>
              {c.text}
            </span>
          ))}
        </div>
        <p className="text-xs text-stone-300">
          Ваша рука — топ ~{scenario.handPct}% всех стартовых рук {scenario.holeCount}-card Омахи: по чарту это{' '}
          <b className="text-stone-100 font-normal">{ACTION_RU[scenario.correctAction]}</b>.
        </p>
      </CardContent>
    </Card>
  )
}

/** Панель GTO-ориентира (постфлоп): тир руки и рекомендация. */
function GtoPostflopPanel({ scenario, streetLabel, onOpenGto }: { scenario: OmahaSimScenario; streetLabel: string; onOpenGto?: (init: GtoInitial) => void }) {
  return (
    <Card className="border-emerald-800/60 bg-emerald-950/40">
      <CardContent className="p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-normal text-stone-100 flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">GTO-ориентир · {streetLabel} · 1 оппонент</span>
          </h3>
          <OpenGtoButton scenario={scenario} onOpenGto={onOpenGto} />
        </div>
        <p className="text-xs text-stone-300">
          Тир руки по чарту: <b className="text-stone-100 font-normal">{scenario.gtoHint}</b>.
        </p>
      </CardContent>
    </Card>
  )
}

export function OmahaSimView({ variant, onBack, onOpenGto }: { variant: DoubleVariant; onBack: () => void; onOpenGto?: (init: GtoInitial) => void }) {
  const record = useStats((s) => s.recordAnswer)
  const trainerId = TRAINER_BY_VARIANT[variant]
  const meta = META[variant]
  const holeCount: 4 | 5 = variant === 'double4' ? 4 : 5

  const [scenario, setScenario] = useState<OmahaSimScenario | null>(null)
  const [answered, setAnswered] = useState<OmahaSimAction | null>(null)

  function next() {
    setScenario(genOmahaSimScenario(holeCount))
    setAnswered(null)
  }

  function answer(a: OmahaSimAction) {
    if (!scenario || answered) return
    setAnswered(a)
    record(trainerId, a === scenario.correctAction)
  }

  if (!scenario) {
    return (
      <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Симулятор раздач {holeCount}-card Омахи на двух досках. Каждая раздача — реальные
            решения: открыть, защищаться против рейза, играть постфлоп на двух бордах.
            После ответа — разбор с GTO-чартом позиции и эквити по каждой доске.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Комбинация — ровно 2 карты руки + 3 с доски</li>
            <li>Каждая доска — отдельная половина банка, эквити усредняется</li>
            <li>Префлоп — по GTO-чартам позиции: диапазон зависит от позиции и размера стола (2–9 max)</li>
            <li>После ответа — чарт позиции и переход в раздел GTO с вашими параметрами</li>
          </ul>
          <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const correct = answered !== null && answered === scenario.correctAction
  const isPostflop = scenario.kind === 'postflop'

  const boardBlocks = (qi: 0 | 1) => {
    const b = scenario.boards![qi]
    const best = scenario.heroBest?.[qi] ?? []
    const boardUsed = b.filter((c) => best.some((h) => h.r === c.r && h.s === c.s))
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-stone-400 w-16 shrink-0">Доска {qi + 1}</span>
        <CardRow cards={b} size="md" highlight={answered ? boardUsed : undefined} />
        <span className="text-xs text-stone-500">{boardStreetLabel(b.length)}</span>
      </div>
    )
  }

  const heroHighlight = answered && scenario.heroBest
    ? [...scenario.heroBest[0], ...scenario.heroBest[1]].filter((c) =>
        scenario.hero.some((h) => h.r === c.r && h.s === c.s))
    : undefined

  return (
    <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
      <ScenarioCard>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
            {meta.badge}
          </Badge>
          <Badge variant="outline" className="border-stone-600 text-stone-300">
            {scenario.kind === 'open'
              ? 'Префлоп · открытие'
              : scenario.kind === 'vsRaise'
                ? 'Префлоп · против рейза'
                : 'Постфлоп · 2 доски'}
          </Badge>
          <Badge variant="outline" className="border-stone-600 text-stone-300">
            {POSITION_NAMES_RU[scenario.position]}
          </Badge>
          {scenario.kind !== 'postflop' && (
            <Badge variant="outline" className="border-stone-600 text-stone-400">
              Стол {scenario.players}-max
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-16 shrink-0">Ваши карты</span>
            <CardRow cards={scenario.hero} size="md" highlight={heroHighlight} />
          </div>
          {isPostflop && boardBlocks(0)}
          {isPostflop && boardBlocks(1)}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-300">
          <span>Банк: <b className="text-stone-100">{scenario.pot} bb</b></span>
          {scenario.bet > 0 && <span>Нужно уравнять: <b className="text-stone-100">{scenario.bet} bb</b></span>}
          <span>Стек: <b>{scenario.stack} bb</b></span>
        </div>

        <p className="text-sm text-stone-100 font-medium">{scenario.prompt}</p>

        {!answered && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => answer('fold')}
              className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700 hover:text-white"
            >
              {scenario.actionLabels.fold}
            </Button>
            {scenario.actionLabels.call && (
              <Button
                variant="outline"
                onClick={() => answer('call')}
                className="border-emerald-600 bg-emerald-800/50 text-emerald-100 hover:bg-emerald-700 hover:text-white"
              >
                {scenario.actionLabels.call}
              </Button>
            )}
            <Button onClick={() => answer('raise')} className="bg-emerald-600 text-white hover:bg-emerald-500">
              {scenario.actionLabels.raise}
            </Button>
          </div>
        )}
      </ScenarioCard>

      {answered && (
        <>
          <Feedback
            correct={correct}
            headline={correct ? 'Верно!' : 'Ошибка'}
            explanation={scenario.explanation}
            detail={scenario.detail}
            onNext={next}
            nextLabel="Следующая раздача"
          />
          {isPostflop && scenario.sim && (
            <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs')}>
              <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
                <p className="text-stone-500">Эквити · Доска 1</p>
                <p className="text-lg text-stone-100 font-normal">{(scenario.sim.eq1 * 100).toFixed(0)}%</p>
              </div>
              <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
                <p className="text-stone-500">Эквити · Доска 2</p>
                <p className="text-lg text-stone-100 font-normal">{(scenario.sim.eq2 * 100).toFixed(0)}%</p>
              </div>
              <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
                <p className="text-stone-500">Эквити по банку</p>
                <p className="text-lg text-emerald-400 font-normal">{(scenario.sim.total * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
                <p className="text-stone-500">Требуемые пот-оддсы</p>
                <p className="text-lg text-stone-100 font-normal">{scenario.requiredPct}%</p>
              </div>
            </div>
          )}
          {!isPostflop && scenario.chart && (
            <GtoChartPanel scenario={scenario} onOpenGto={onOpenGto} />
          )}
          {isPostflop && scenario.gtoHint && (
            <GtoPostflopPanel
              scenario={scenario}
              streetLabel={boardStreetLabel(scenario.boardStreets![0])}
              onOpenGto={onOpenGto}
            />
          )}
        </>
      )}
    </TrainerShell>
  )
}
