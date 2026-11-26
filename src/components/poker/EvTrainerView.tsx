'use client'

// EV-тренажёр: вычислите EV колла и выберите верное значение из пяти вариантов
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import { EvQuestion, genEvQuestion, evFormulaText } from '@/lib/poker/training'

function evLabel(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} bb`
}

export function EvTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [question, setQuestion] = useState<EvQuestion | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)

  function next() {
    setQuestion(genEvQuestion())
    setChosen(null)
  }

  function choose(v: number) {
    if (!question || chosen !== null) return
    setChosen(v)
    record('ev', v === question.evCall)
  }

  if (!question) {
    return (
      <TrainerShell title="EV-тренажёр" subtitle="Найдите точный EV колла среди пяти вариантов" trainerId="ev" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            EV (expected value) — ожидаемая стоимость решения в среднем за раздачу.
            Вам показывают банк, ставку оппонента и ваше эквити — вычислите EV колла
            и выберите верное значение из пяти вариантов.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>EV(колл) = эквити × (банк + ставка) − (1 − эквити) × колл</li>
            <li>EV &gt; 0 — колл прибылен, EV &lt; 0 — фолд правильнее</li>
            <li>Порог: эквити &gt; колл / (банк + 2 × колл)</li>
          </ul>
          <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const correct = chosen === question.evCall
  return (
    <TrainerShell title="EV-тренажёр" subtitle="Найдите точный EV колла среди пяти вариантов" trainerId="ev" onBack={onBack}>
      <ScenarioCard>
        <p className="text-sm text-stone-100 font-medium">
          Банк — {question.pot} bb. Оппонент ставит {question.bet} bb.
        </p>
        <p className="text-sm text-stone-300">
          Ваше эквити против диапазона оппонента: <b className="text-stone-100">{question.equityPct}%</b>
        </p>
        <p className="text-sm text-stone-100 font-medium">Чему равен EV колла?</p>
        <div className="flex flex-wrap gap-2">
          {question.options.map((v) => {
            const isCorrect = v === question.evCall
            const isChosen = chosen === v
            let cls = 'border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700 hover:text-white'
            if (chosen !== null) {
              if (isCorrect) cls = 'border-emerald-500 bg-emerald-900/50 text-emerald-100'
              else if (isChosen) cls = 'border-red-500 bg-red-900/40 text-red-100'
            }
            return (
              <Button
                key={v}
                variant="outline"
                disabled={chosen !== null}
                onClick={() => choose(v)}
                className={cls}
                aria-label={`EV ${evLabel(v)}`}
              >
                {evLabel(v)}
              </Button>
            )
          })}
        </div>
      </ScenarioCard>

      {chosen !== null && (
        <Feedback
          correct={correct}
          headline={
            correct
              ? `Верно! EV колла = ${evLabel(question.evCall)} — ${question.correctAction === 'call' ? 'колл прибылен' : 'колл убыточен, фолд правильнее'}`
              : `Ошибка. EV колла = ${evLabel(question.evCall)} — ${question.correctAction === 'call' ? 'колл прибылен' : 'колл убыточен, фолд правильнее'}`
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
