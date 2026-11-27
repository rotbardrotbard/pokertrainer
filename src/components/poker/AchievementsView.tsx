'use client'

// Достижения: уровни XP (верные ответы + серии дней + дневные цели) и бейджи-милстоуны
import { ArrowLeft, Medal, Lock, Zap, Flame, Trophy, GraduationCap, Sparkles, Target, Star, Swords, CalendarCheck, CalendarRange, CalendarDays, Award, Layers } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useStats, levelFor, LEVELS, XP_PER_CORRECT, STREAK_DAY_XP, STREAK_DAY_CAP, DAILY_GOAL_STEP, DAILY_GOAL_XP, EXAM_PASS_XP, EXAM_GREAT_XP } from '@/store/stats'
import { evaluateBadges } from '@/lib/achievements'
import { cn } from '@/lib/utils'

// иконка каждого бейджа (по id из BADGES)
const BADGE_ICONS: Record<string, LucideIcon> = {
  firstSteps: Sparkles,
  hundred: Target,
  fiveHundred: Star,
  answerStreak10: Zap,
  answerStreak20: Swords,
  dayGoal: CalendarCheck,
  workhorse: Flame,
  weekDiscipline: CalendarRange,
  marathon: Trophy,
  firstExam: GraduationCap,
  examGreat: Award,
  allModes: Layers,
  calendarVeteran: CalendarDays,
}

const XP_RULES = [
  `+${XP_PER_CORRECT} XP за каждый верный ответ в любом режиме`,
  `+${STREAK_DAY_XP} XP × день серии за первый верный ответ дня (серия 7+ дней — максимум +${STREAK_DAY_XP * STREAK_DAY_CAP} XP за день)`,
  `+${DAILY_GOAL_XP} XP за каждые ${DAILY_GOAL_STEP} верных ответов за один день (дневная цель)`,
  `+${EXAM_PASS_XP} XP за сданный экзамен (от 70%), +${EXAM_GREAT_XP} XP за экзамен от 90%`,
]

export function AchievementsView({ onBack }: { onBack: () => void }) {
  const xp = useStats((s) => s.xp ?? 0)
  const bestStreak = useStats((s) => s.bestStreak)
  const bestAnswerStreak = useStats((s) => s.bestAnswerStreak)
  const stats = useStats((s) => s.stats)
  const dayLog = useStats((s) => s.dayLog ?? {})

  const lvl = levelFor(xp)
  const badges = evaluateBadges({ stats, dayLog, bestStreak, bestAnswerStreak, xp })
  const earnedCount = badges.filter((b) => b.earned).length
  const toNext = lvl.next ? lvl.next.xp - xp : 0
  const pct = Math.round(lvl.progress * 100)

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-10 pt-4 flex flex-col gap-4">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-stone-300 hover:text-white hover:bg-stone-800/60">
          <ArrowLeft className="w-4 h-4" /> Меню
        </Button>
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <Medal className="w-3.5 h-3.5" />
          {xp} XP
        </span>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-light text-stone-50">Достижения</h1>
        <p className="text-sm text-stone-400">Уровни и бейджи: рост за верные ответы, серии дней без пропуска и дневные цели</p>
      </div>

      {/* Уровень */}
      <Card className="border-emerald-600/40 bg-gradient-to-b from-emerald-950/40 to-neutral-900/80">
        <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <Medal className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-stone-400">Текущий уровень · уровень {lvl.index + 1} из {LEVELS.length}</p>
            <h2 className="text-2xl sm:text-3xl font-normal text-emerald-400">{lvl.name}</h2>
            <p className="text-sm text-stone-300 mt-1">{xp} XP</p>
          </div>
          <div className="w-full max-w-md flex flex-col gap-1.5 mt-1">
            <div className="h-2.5 rounded-full bg-stone-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-stone-400">
              {lvl.next
                ? <>До уровня «{lvl.next.name}»: <b className="text-stone-200 font-normal">{toNext} XP</b> ({pct}%)</>
                : 'Максимальный уровень достигнут — легенда трейнера'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Как зарабатывать XP */}
      <Card className="border-stone-800 bg-stone-900/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <h2 className="text-sm font-normal text-stone-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            Как зарабатывать XP
          </h2>
          <ul className="text-xs text-stone-400 flex flex-col gap-1.5 list-disc pl-4">
            {XP_RULES.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </CardContent>
      </Card>

      {/* Бейджи */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-normal text-stone-200 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-500" />
          Бейджи · открыто {earnedCount} из {badges.length}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {badges.map((b) => {
            const Icon = BADGE_ICONS[b.id] ?? Medal
            return (
              <Card
                key={b.id}
                className={cn(
                  'h-full transition',
                  b.earned ? 'border-emerald-600/40 bg-emerald-950/25' : 'border-stone-800 bg-stone-900/50',
                )}
              >
                <CardContent className={cn('p-3.5 flex flex-col gap-1.5 h-full', !b.earned && 'opacity-60')}>
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      'w-9 h-9 rounded-lg border flex items-center justify-center',
                      b.earned ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-stone-800 border-stone-700',
                    )}>
                      {b.earned
                        ? <Icon className="w-4.5 h-4.5 text-emerald-400" />
                        : <Lock className="w-4 h-4 text-stone-500" />}
                    </div>
                  </div>
                  <h3 className={cn('text-sm font-normal leading-snug', b.earned ? 'text-stone-100' : 'text-stone-400')}>{b.title}</h3>
                  <p className="text-[11px] text-stone-500 leading-snug">{b.desc}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
