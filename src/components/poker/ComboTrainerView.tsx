'use client'

// Квиз «Какая комбинация»: определение категории собранной руки
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { CardRow } from './PlayingCard'
import { useStats } from '@/store/stats'
import { ComboQuestion, genComboQuestion, comboCategoryLabel, COMBO_CATEGORIES } from '@/lib/poker/training'

export function ComboTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const [question, setQuestion] = useState<ComboQuestion | null>(null)
  const [answered, setAnswered] = useState<number | null>(null)

  function next() {
    setQuestion(genComboQuestion())
    setAnswered(null)
  }

  function answer(cat: number) {
    if (!question || answered !== null) return
    setAnswered(cat)
    record('combo', cat === question.correctCat)
  }

  if (!question) {
    return (
      <TrainerShell title="Какая комбинация?" subtitle="Быстро узнавайте силу собранной руки" trainerId="combo" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Из 7 карт нужно мгновенно определять лучшую 5-карточную комбинацию.
            Этот навык нужен для чтения доски и принятия решений на постфлопе.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Иерархия: старшая карта → пара → две пары → сет → стрит → флеш → фулл-хаус → каре → стрит-флеш</li>
            <li>Из 7 карт всегда берутся только лучшие 5</li>
          </ul>
          <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  const correct = answered === question.correctCat
  const categories = Array.from({ length: COMBO_CATEGORIES }, (_, i) => i)

  return (
    <TrainerShell title="Какая комбинация?" subtitle="Быстро узнавайте силу собранной руки" trainerId="combo" onBack={onBack}>
      <ScenarioCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Ваши карты</span>
            <CardRow cards={question.hero} size="md" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20">Доска</span>
            <CardRow cards={question.board} size="md" />
          </div>
        </div>
        <p className="text-sm text-stone-100 font-medium">Какая лучшая комбинация у вас на руках?</p>
        {!answered && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant="outline"
                onClick={() => answer(cat)}
                className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700 hover:text-white text-xs sm:text-sm h-auto py-2.5"
              >
                {comboCategoryLabel(cat)}
              </Button>
            ))}
          </div>
        )}
      </ScenarioCard>

      {answered !== null && (
        <Feedback
          correct={correct}
          headline={correct ? `Верно! ${question.correctName}` : `Это ${question.correctName}`}
          explanation={correct ? 'Комбинация определена правильно.' : 'Смотрите на лучшие 5 карт из семи: сначала ищите пары и сеты, затем стриты и флеши.'}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
