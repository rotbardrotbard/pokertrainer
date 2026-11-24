'use client'

// Симулятор покерных решений: префлоп и постфлоп сценарии
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PlayingCard, CardRow } from './PlayingCard'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import { SimScenarioBase, SimAction, genSimScenario } from '@/lib/poker/training'
import { POSITION_NAMES_RU } from '@/lib/poker/ranges'

export function SimulatorView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [scenario, setScenario] = useState<SimScenarioBase | null>(null)
  const [answered, setAnswered] = useState<SimAction | null>(null)

  function next() {
    setScenario(genSimScenario())
    setAnswered(null)
  }

  function answer(a: SimAction) {
    if (!scenario || answered) return
    setAnswered(a)
    record('sim', a === scenario.correctAction)
  }

  // стартовый сценарий создаётся при первом рендере
  if (!scenario) {
    return (
      <TrainerShell title="Симулятор раздач" subtitle="Принимайте решения, как за реальным столом" trainerId="sim" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Тренируйте решения на префлопе и постфлопе: открытие рейза, защита против рейза, коллы по пот-оддсам.
            После каждого ответа — подробный разбор с эквити и диапазонами.
          </p>
          <Button onClick={next} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const correct = answered !== null && answered === scenario.correctAction
  const boardShown = scenario.kind === 'postflop' ? scenario.board ?? [] : null

  return (
    <TrainerShell title="Симулятор раздач" subtitle="Принимайте решения, как за реальным столом" trainerId="sim" onBack={onBack}>
      <ScenarioCard>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            {scenario.kind === 'open' ? 'Префлоп · открытие' : scenario.kind === 'vsRaise' ? 'Префлоп · против рейза' : 'Постфлоп'}
          </Badge>
          {scenario.kind !== 'postflop' && (
            <Badge variant="outline" className="border-stone-600 text-stone-300">
              {POSITION_NAMES_RU[scenario.position]}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-16">Ваши карты</span>
            <CardRow cards={scenario.hero} size="md" />
          </div>
          {boardShown && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400 w-16">Доска</span>
              <CardRow cards={boardShown} size="md" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-300">
          <span>Банк: <b className="text-amber-400">{scenario.pot} bb</b></span>
          {scenario.bet > 0 && <span>Нужно уравнять: <b className="text-amber-400">{scenario.bet} bb</b></span>}
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
            <Button onClick={() => answer('raise')} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
              {scenario.actionLabels.raise}
            </Button>
          </div>
        )}
      </ScenarioCard>

      {answered && (
        <Feedback
          correct={correct}
          headline={correct ? 'Верно!' : 'Ошибка'}
          explanation={scenario.explanation}
          detail={scenario.detail}
          onNext={next}
          nextLabel="Следующая раздача"
        />
      )}
    </TrainerShell>
  )
}
