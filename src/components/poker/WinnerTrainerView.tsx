'use client'

// Тренажёр «Кто победил»: определение выигрышной комбинации
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { CardRow } from './PlayingCard'
import { useStats } from '@/store/stats'
import { WinnerQuestion, genWinnerQuestion } from '@/lib/poker/training'

export function WinnerTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [question, setQuestion] = useState<WinnerQuestion | null>(null)
  const [answered, setAnswered] = useState<'hero' | 'villain' | 'tie' | null>(null)

  function next() {
    setQuestion(genWinnerQuestion())
    setAnswered(null)
  }

  function answer(a: 'hero' | 'villain' | 'tie') {
    if (!question || answered) return
    setAnswered(a)
    record('winner', a === question.correct)
  }

  if (!question) {
    return (
      <TrainerShell title="Кто победил?" subtitle="Определяйте выигрышную комбинацию по 5 лучшим картам" trainerId="winner" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Классическая задача новичка: из 7 карт берутся лучшие 5, и сравниваются две руки.
            Тренируйте чтение доски и иерархию комбинаций.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Из 7 карт (2 ваши + 5 доски) составляется лучшая 5-карточная комбинация</li>
            <li>Если лучшие комбинации равны — банк делится (сплит)</li>
          </ul>
          <Button onClick={next} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const streetLabel = question.board.length === 3 ? 'Флоп' : question.board.length === 4 ? 'Терн' : 'Ривер'
  const correct = answered === question.correct

  return (
    <TrainerShell title="Кто победил?" subtitle="Определяйте выигрышную комбинацию по 5 лучшим картам" trainerId="winner" onBack={onBack}>
      <ScenarioCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Игрок 1 (вы)</span>
            <CardRow cards={question.hero} size="md" highlight={answered ? question.heroBest : undefined} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Доска</span>
            <CardRow cards={question.board} size="md" />
            <span className="text-xs text-stone-500">{streetLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Игрок 2</span>
            <CardRow cards={question.villain} size="md" highlight={answered ? question.villainBest : undefined} />
          </div>
        </div>
        <p className="text-sm text-stone-100 font-medium">Кто побеждает в этой раздаче?</p>
        {!answered && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => answer('hero')} className="bg-emerald-600 text-white hover:bg-emerald-500 font-semibold">
              Игрок 1 (вы)
            </Button>
            <Button variant="outline" onClick={() => answer('tie')} className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700">
              Ничья (сплит)
            </Button>
            <Button variant="outline" onClick={() => answer('villain')} className="border-red-600 bg-red-900/40 text-red-100 hover:bg-red-800">
              Игрок 2
            </Button>
          </div>
        )}
      </ScenarioCard>

      {answered && (
        <Feedback
          correct={correct}
          headline={
            question.correct === 'tie'
              ? 'Ничья — банк делится'
              : `Победил Игрок ${question.correct === 'hero' ? '1' : '2'}`
          }
          explanation={
            question.correct === 'tie'
              ? `Обе руки собирают одинаковую комбинацию — банк делится поровну.`
              : `Игрок ${question.correct === 'hero' ? '1' : '2'} показывает ${question.correct === 'hero' ? question.heroHandName : question.villainHandName} против ${question.correct === 'hero' ? question.villainHandName : question.heroHandName}.`
          }
          detail={[
            'Подсвечены лучшие 5 карт каждого игрока — именно они участвуют в сравнении.',
          ]}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
