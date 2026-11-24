'use client'

// EV-тренажёр: колл или фолд по ожидаемой стоимости
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import { EvQuestion, genEvQuestion, evFormulaText } from '@/lib/poker/training'

export function EvTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [question, setQuestion] = useState<EvQuestion | null>(null)
  const [answered, setAnswered] = useState<'call' | 'fold' | null>(null)

  function next() {
    setQuestion(genEvQuestion())
    setAnswered(null)
  }

  function answer(a: 'call' | 'fold') {
    if (!question || answered) return
    setAnswered(a)
    record('ev', a === question.correctAction)
  }

  if (!question) {
    return (
      <TrainerShell title="EV-тренажёр" subtitle="Колл или фолд: считайте ожидаемую стоимость" trainerId="ev" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            EV (expected value) — ожидаемая стоимость решения. Колл прибылен, когда EV &gt; 0.
            Вам показывают банк, ставку оппонента и ваше эквити — выберите решение.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>EV(колл) = эквити × (банк + ставка) − (1 − эквити) × колл</li>
            <li>Порог: эквити &gt; колл / (банк + 2 × колл)</li>
          </ul>
          <Button onClick={next} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const correct = answered === question.correctAction
  return (
    <TrainerShell title="EV-тренажёр" subtitle="Колл или фолд: считайте ожидаемую стоимость" trainerId="ev" onBack={onBack}>
      <ScenarioCard>
        <p className="text-sm text-stone-100 font-medium">
          Банк — {question.pot} bb. Оппонент ставит {question.bet} bb.
        </p>
        <p className="text-sm text-stone-300">
          Ваше эквити против диапазона оппонента: <b className="text-amber-400">{question.equityPct}%</b>
        </p>
        {!answered && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => answer('fold')}
              className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700 hover:text-white"
            >
              Фолд
            </Button>
            <Button onClick={() => answer('call')} className="bg-emerald-600 text-white hover:bg-emerald-500 font-semibold">
              Колл {question.bet} bb
            </Button>
          </div>
        )}
      </ScenarioCard>

      {answered && (
        <Feedback
          correct={correct}
          headline={
            correct
              ? `Верно! EV колла = ${question.evCall > 0 ? '+' : ''}${question.evCall} bb`
              : `Ошибка. EV колла = ${question.evCall > 0 ? '+' : ''}${question.evCall} bb — значит ${question.correctAction === 'call' ? 'колл прибылен' : 'колл убыточен'}`
          }
          explanation={
            question.evCall > 0
              ? 'Положительный EV означает прибыль на дистанции: каждый такой колл зарабатывает деньги в среднем.'
              : 'Отрицательный EV — потеря денег на дистанции. Фолд не стоит ничего, поэтому он правилен.'
          }
          detail={[evFormulaText(question)]}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
