'use client'

// Тренажёр аутсов: сколько карт улучшают руку до победной
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { PlayingCard, CardRow } from './PlayingCard'
import { useStats } from '@/store/stats'
import { OutsQuestion, genOutsQuestion, describeOuts } from '@/lib/poker/training'

export function OutsTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [question, setQuestion] = useState<OutsQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [answeredCorrect, setAnsweredCorrect] = useState<boolean | null>(null)

  function next() {
    setQuestion(genOutsQuestion())
    setAnswer('')
    setAnsweredCorrect(null)
  }

  function submit() {
    if (!question || answeredCorrect !== null) return
    const val = parseInt(answer, 10)
    if (isNaN(val)) return
    const correct = val === question.outsCount
    setAnsweredCorrect(correct)
    record('outs', correct)
  }

  if (!question) {
    return (
      <TrainerShell title="Аутсы и эквити" subtitle="Считайте карты, которые делают руку победной" trainerId="outs" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Аутс — карта, которая превращает вашу руку в победную. Вы видите свои карты,
            доску и руку оппонента. Посчитайте аутсы.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Флеш-дро: 9 аутсов (13 карт масти − 4 видимых)</li>
            <li>Двусторонний стрит-дро: 8 аутсов</li>
            <li>Гатшот (внутренний стрит-дро): 4 аутса</li>
            <li>Правило 2 и 4: аутсы × 2 на следующей улице, × 4 на двух улицах</li>
          </ul>
          <Button onClick={next} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const probTurn = Math.round((question.outsCount * 2 * 10)) / 10
  const probRiver = Math.round((question.outsCount * 4 * 10)) / 10

  return (
    <TrainerShell title="Аутсы и эквити" subtitle="Считайте карты, которые делают руку победной" trainerId="outs" onBack={onBack}>
      <ScenarioCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Ваши карты</span>
            <CardRow cards={question.hero} size="md" />
            <span className="text-xs text-stone-500">{question.heroHandName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Доска</span>
            <CardRow cards={question.board} size="md" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Оппонент</span>
            <CardRow cards={question.villain} size="md" />
            <span className="text-xs text-stone-500">{question.villainHandName}</span>
          </div>
        </div>
        <p className="text-sm text-stone-100 font-medium">
          Сколько аутсов у вас — карт, которые дадут победную руку на следующей улице?
        </p>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            placeholder="Число"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={answeredCorrect !== null}
            className="w-32 bg-stone-900 border-stone-700 text-stone-100"
            aria-label="Количество аутсов"
          />
          <Button onClick={submit} disabled={answeredCorrect !== null || answer.trim() === ''} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Ответить
          </Button>
        </div>
      </ScenarioCard>

      {answeredCorrect !== null && (
        <Feedback
          correct={answeredCorrect}
          headline={answeredCorrect ? `Верно! Аутсов: ${question.outsCount}` : `Неверно. Аутсов: ${question.outsCount}`}
          explanation={`Ваши аутсы: ${describeOuts(question.outs)}. Правило 2 и 4: шанс улучшиться ≈ ${probTurn}% на следующей карте или ≈ ${probRiver}% до ривера (с учётом двух улиц).`}
          detail={[
            'Аутсы считаются ровно: карта считается, только если она делает вашу руку лучше руки оппонента.',
            'Карта, дающая оппоненту улучшение сильнее вашего (например, его флеш), не является вашим аутсом.',
          ]}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
