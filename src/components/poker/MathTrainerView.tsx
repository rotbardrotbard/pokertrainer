'use client'

// Тренажёр математики: пот-оддсы и шансы банка
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import { MathQuestion, genMathQuestion, genRatioQuestion, checkMathAnswer } from '@/lib/poker/training'

export function MathTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [question, setQuestion] = useState<MathQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [answeredCorrect, setAnsweredCorrect] = useState<boolean | null>(null)

  function next() {
    setQuestion(Math.random() < 0.7 ? genMathQuestion() : genRatioQuestion())
    setAnswer('')
    setAnsweredCorrect(null)
  }

  function submit() {
    if (!question || answeredCorrect !== null) return
    const val = parseFloat(answer.replace(',', '.'))
    if (isNaN(val)) return
    const correct = checkMathAnswer(question, val)
    setAnsweredCorrect(correct)
    record('math', correct)
  }

  if (!question) {
    return (
      <TrainerShell title="Математика: пот-оддсы" subtitle="Считайте требуемое эквити для колла" trainerId="math" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Пот-оддсы — фундамент прибыльного покера. Вы научитесь за секунды определять,
            какой процент эквити нужен, чтобы колл был плюсовым.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Требуемое эквити = сумма колла / (банк + ставка + колл)</li>
            <li>Шансы банка a:1 → нужно 1 / (a + 1)</li>
            <li>Ответ принимается с точностью ±1.5%</li>
          </ul>
          <Button onClick={next} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  return (
    <TrainerShell title="Математика: пот-оддсы" subtitle="Считайте требуемое эквити для колла" trainerId="math" onBack={onBack}>
      <ScenarioCard>
        <p className="text-sm text-stone-100 font-medium">{question.prompt}</p>
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="Ответ в %"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={answeredCorrect !== null}
            className="w-40 bg-stone-900 border-stone-700 text-stone-100"
            aria-label="Ваш ответ в процентах"
          />
          <span className="text-stone-400 text-sm">%</span>
          <Button onClick={submit} disabled={answeredCorrect !== null || answer.trim() === ''} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Ответить
          </Button>
        </div>
        <p className="text-xs text-stone-500">Подсказка на будущее: {question.hint}</p>
      </ScenarioCard>

      {answeredCorrect !== null && (
        <Feedback
          correct={answeredCorrect}
          headline={answeredCorrect ? `Верно! Нужно ≈ ${question.requiredPct}%` : `Неверно. Правильный ответ: ≈ ${question.requiredPct}%`}
          explanation={`Шансы банка здесь ${question.ratioText}. Требуемое эквити = ${question.requiredPct}%. Если ваша рука выигрывает чаще этого порога — колл прибылен.`}
          detail={[question.hint]}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
