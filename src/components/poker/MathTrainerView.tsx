'use client'

// Тренажёр математики: расширенный банк задач — пот-оддсы, правило 2 и 4,
// фолд-эквити блефа, MDF, EV блефа, комбинации и SPR
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard, KindStatsPanel } from './TrainerShell'
import { useStats } from '@/store/stats'
import {
  MathQuestion,
  MathKind,
  genMathQuestion,
  genRatioQuestion,
  genRule24Question,
  genBluffBreakevenQuestion,
  genMdfQuestion,
  genBluffEvQuestion,
  genCombosQuestion,
  genSprQuestion,
  checkMathAnswer,
} from '@/lib/poker/training'

const KIND_LABELS_RU: Record<MathKind, string> = {
  potOdds: 'Пот-оддсы',
  ratio: 'Шансы банка',
  rule24: 'Правило 2 и 4',
  bluffBreakeven: 'Фолд-эквити блефа',
  mdf: 'MDF',
  bluffEv: 'EV блефа',
  combos: 'Комбинации',
  spr: 'SPR',
}

const KIND_EXPLAINERS: Record<MathKind, string> = {
  potOdds: 'Если ваша рука выигрывает чаще этого порога — колл прибылен на дистанции.',
  ratio: 'Чем больше шансы банка, тем меньше эквити требуется для прибыльного колла.',
  rule24: 'Правило 2 и 4 — быстрая оценка: точные вероятности немного ниже, особенно при большом числе аутсов.',
  bluffBreakeven: 'Чистый блеф окупается, когда частота фолдов не ниже ставки / (банк + ставка).',
  mdf: 'Если защищать меньше MDF, блефы оппонента автоматически становятся прибыльными.',
  bluffEv: 'EV = фолд-эквити × банк − (1 − фолд-эквити) × ставка. Отрицательное значение — потеря на дистанции.',
  combos: 'Комбинации считаются из 52 карт: пара — 6, одномастные — 4, разномастные — 12.',
  spr: 'SPR = эффективный стек / банк. Маленький SPR — привязанность к банку, большой — простор для манёвра.',
}

const UNIT_LABELS: Record<MathQuestion['unit'], string> = {
  '%': '%',
  bb: 'bb',
  'шт': 'шт.',
  '': '',
}

function pickQuestion(): MathQuestion {
  const r = Math.random()
  if (r < 0.14) return genMathQuestion()
  if (r < 0.24) return genRatioQuestion()
  if (r < 0.40) return genRule24Question()
  if (r < 0.55) return genBluffBreakevenQuestion()
  if (r < 0.65) return genMdfQuestion()
  if (r < 0.80) return genBluffEvQuestion()
  if (r < 0.92) return genCombosQuestion()
  return genSprQuestion()
}

export function MathTrainerView({ onBack }: { onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const kindStats = useStats((s) => s.kindStats)
  const [question, setQuestion] = useState<MathQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [answeredCorrect, setAnsweredCorrect] = useState<boolean | null>(null)

  function next() {
    setQuestion(pickQuestion())
    setAnswer('')
    setAnsweredCorrect(null)
  }

  function submit() {
    if (!question || answeredCorrect !== null) return
    const val = parseFloat(answer.replace(',', '.'))
    if (isNaN(val)) return
    const correct = checkMathAnswer(question, val)
    setAnsweredCorrect(correct)
    record('math', correct, `math:${question.kind}`)
  }

  if (!question) {
    return (
      <TrainerShell title="Математика покера" subtitle="Пот-оддсы, эквити, правило 2 и 4, MDF, SPR и блефы" trainerId="math" onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Восемь типов задач по покерной математике: от классических пот-оддсов до
            минимальной частоты защиты и EV блефов. Ответ принимается с допуском,
            указанным для каждого типа.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Пот-оддсы: требуемое эквити по размеру ставки (±1.5%)</li>
            <li>Шансы банка a:1 → нужно 1 / (a + 1) (±1.5%)</li>
            <li>Правило 2 и 4: аутсы → шанс улучшения (±2%)</li>
            <li>Фолд-эквити безубыточного блефа (±1.5%)</li>
            <li>MDF — минимальная частота защиты (±1.5%)</li>
            <li>EV чистого блефа при заданном фолд-эквити (±1 bb)</li>
            <li>Комбинации стартовых рук: пары 6, одномастные 4, разномастные 12</li>
            <li>SPR — соотношение эффективного стека к банку (±0.2)</li>
          </ul>
          <KindStatsPanel
            rows={(Object.keys(KIND_LABELS_RU) as MathKind[]).map((k) => ({
              key: k,
              label: KIND_LABELS_RU[k],
              stat: kindStats[`math:${k}`],
            }))}
          />
          <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
            Начать сессию
          </Button>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  return (
    <TrainerShell title="Математика покера" subtitle="Пот-оддсы, эквити, правило 2 и 4, MDF, SPR и блефы" trainerId="math" onBack={onBack}>
      <ScenarioCard>
        <span className="inline-block w-fit text-[11px] uppercase tracking-wider text-emerald-300 border border-neutral-600/60 rounded px-2 py-0.5 bg-neutral-800/70">
          {KIND_LABELS_RU[question.kind]}
        </span>
        <p className="text-sm text-stone-100 font-medium">{question.prompt}</p>
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="Ответ"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={answeredCorrect !== null}
            className="w-40 bg-stone-900 border-stone-700 text-stone-100"
            aria-label="Ваш ответ"
          />
          {question.unit && <span className="text-stone-400 text-sm">{UNIT_LABELS[question.unit]}</span>}
          <Button onClick={submit} disabled={answeredCorrect !== null || answer.trim() === ''} className="bg-emerald-600 text-white hover:bg-emerald-500">
            Ответить
          </Button>
        </div>
        <p className="text-xs text-stone-500">Подсказка на будущее: {question.hint}</p>
      </ScenarioCard>

      {answeredCorrect !== null && (
        <Feedback
          correct={answeredCorrect}
          headline={answeredCorrect ? `Верно! ${question.solutionText}` : `Неверно. Правильный ответ: ${question.solutionText}`}
          explanation={KIND_EXPLAINERS[question.kind]}
          detail={[question.hint]}
          onNext={next}
        />
      )}
    </TrainerShell>
  )
}
