'use client'

// Общий каркас тренажёра: шапка, статистика, кнопки действий, разбор ответа
import { ReactNode } from 'react'
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, Flame, Target, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrainerId, useStats, accuracy } from '@/store/stats'
import { cn } from '@/lib/utils'

export interface TrainerShellProps {
  title: string
  subtitle: string
  trainerId?: TrainerId
  onBack: () => void
  children: ReactNode
  accent?: string
}

export function TrainerShell({ title, subtitle, trainerId, onBack, children }: TrainerShellProps) {
  const stats = useStats((s) => (trainerId ? s.stats[trainerId] : null))
  const lifetime = stats ? accuracy(stats.correct, stats.attempts) : null
  const session = stats ? accuracy(stats.sessionCorrect, stats.sessionAttempts) : null

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-10 pt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-stone-300 hover:text-white hover:bg-stone-800/60">
          <ArrowLeft className="w-4 h-4" /> Меню
        </Button>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <Target className="w-3.5 h-3.5" />
            Сессия: {session === null ? '—' : `${session}%`}
          </span>
          <span className="flex items-center gap-1 text-stone-400">
            <Flame className="w-3.5 h-3.5" />
            Всего: {lifetime === null ? '—' : `${lifetime}%`} ({stats ? stats.attempts : 0})
          </span>
          {stats !== null && stats.hints > 0 && (
            <span className="flex items-center gap-1 text-stone-400">
              <Lightbulb className="w-3.5 h-3.5" />
              Подсказки: {stats.hints}
            </span>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-light text-stone-50">{title}</h1>
        <p className="text-sm text-stone-400">{subtitle}</p>
      </div>

      {children}
    </div>
  )
}

export interface FeedbackProps {
  correct: boolean
  headline: string
  explanation: string
  detail?: string[]
  onNext: () => void
  nextLabel?: string
}

export function Feedback({ correct, headline, explanation, detail, onNext, nextLabel = 'Далее' }: FeedbackProps) {
  return (
    <Card className={cn(
      'border-2',
      correct ? 'border-emerald-600/60 bg-emerald-950/30' : 'border-red-600/60 bg-red-950/30',
    )}>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
        <div className={cn('flex items-center gap-2 font-normal text-base', correct ? 'text-emerald-400' : 'text-red-400')}>
          {correct ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {headline}
        </div>
        <p className="text-sm text-stone-200">{explanation}</p>
        {detail && detail.length > 0 && (
          <ul className="text-xs text-stone-400 flex flex-col gap-1 list-disc pl-4">
            {detail.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        )}
        <Button onClick={onNext} className="bg-emerald-600 text-white hover:bg-emerald-500 mt-1">
          <RotateCcw className="w-4 h-4" /> {nextLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

/** Карточка-сценарий вопроса */
export function ScenarioCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className="border-stone-800 bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 shadow-lg shadow-black/30">
      <CardContent className="p-4 sm:p-6 flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}
