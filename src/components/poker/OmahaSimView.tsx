'use client'

// Симулятор раздач для Омахи с двумя досками: 4-card и 5-card.
// Префлоп: открытие и защита по профилю руки. Постфлоп: решения по эквити двух досок.
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardRow } from './PlayingCard'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import {
  OmahaSimScenario,
  OmahaSimAction,
  genOmahaSimScenario,
} from '@/lib/poker/omahaSim'
import { POSITION_NAMES_RU } from '@/lib/poker/ranges'
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

function boardStreetLabel(n: number): string {
  return n === 3 ? 'Флоп' : n === 4 ? 'Терн' : 'Ривер'
}

export function OmahaSimView({ variant, onBack }: { variant: DoubleVariant; onBack: () => void }) {
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
            После ответа — разбор с эквити по каждой доске.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Комбинация — ровно 2 карты руки + 3 с доски</li>
            <li>Каждая доска — отдельная половина банка, эквити усредняется</li>
            <li>Префлоп оценивается по профилю: масти, связки, тузы</li>
            <li>Постфлоп — Monte-Carlo эквити против случайной руки Омахи</li>
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
        </>
      )}
    </TrainerShell>
  )
}
