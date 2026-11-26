'use client'

// Тренажёр аутсов: сколько карт улучшают руку до победной
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard, KindStatsPanel } from './TrainerShell'
import { PlayingCard, CardRow } from './PlayingCard'
import { useStats } from '@/store/stats'
import { OutsQuestion, genOutsQuestion, describeOuts, OUTS_SCENARIOS } from '@/lib/poker/training'

export function OutsTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const kindStats = useStats((s) => s.kindStats)
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
    record('outs', correct, `outs:${question.scenario}`)
  }

  if (!question) {
    return (
      <TrainerShell title="Аутсы и эквити" subtitle="Считайте карты, которые делают руку победной" trainerId="outs" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Аутс — карта, которая превращает вашу руку в победную. Вы видите свои карты,
            доску и руку оппонента. Посчитайте аутсы — банк из {OUTS_SCENARIOS.length} типов сценариев.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Флеш-дро: 9, двусторонний стрит-дро: 8, гатшот: 4, двойной гатшот: 6</li>
            <li>Комбо-дро: стрит + флеш до 15 аутсов, флеш + гатшот — 12</li>
            <li>Оверкарты против карманной пары: 3–6 аутсов</li>
            <li>Сет → фулл-хаус: 7, две пары → фулл-хаус: 4, пара → сет: 2</li>
            <li>Отравленные аутсы: карта, усиливающая оппонента сильнее вас, не считается</li>
            <li>Правило 2 и 4: аутсы × 2 на следующей улице, × 4 на двух улицах</li>
          </ul>
          <KindStatsPanel
            title="Точность по сценариям"
            rows={OUTS_SCENARIOS.map((s) => ({
              key: s.scenario,
              label: s.scenario,
              stat: kindStats[`outs:${s.scenario}`],
            }))}
          />
          <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
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
        <span className="inline-block w-fit text-[11px] uppercase tracking-wider text-emerald-300 border border-neutral-600/60 rounded px-2 py-0.5 bg-neutral-800/70">
          {question.scenario}
        </span>
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
          <Button onClick={submit} disabled={answeredCorrect !== null || answer.trim() === ''} className="bg-emerald-600 text-white hover:bg-emerald-500">
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
            ...(question.note ? [question.note] : []),
            'Аутсы считаются ровно: карта считается, только если она делает вашу руку лучше руки оппонента.',
            'Карта, дающая оппоненту улучшение сильнее вашего (например, его флеш), не является вашим аутсом.',
          ]}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
