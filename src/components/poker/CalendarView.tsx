'use client'

// Календарь занятий: статистика прохождения упражнений в привязке к дням.
// Тепловая сетка месяца, сводка за месяц, детали выбранного дня и серия занятий.
import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Info, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrainerId, useStats, accuracy, DayTrainerStat, dayEntryTotals } from '@/store/stats'
import { cn } from '@/lib/utils'

// русские подписи режимов — те же названия, что и на главной
const TRAINER_LABELS: Record<TrainerId, string> = {
  sim: 'Симулятор раздач',
  math: 'Математика',
  outs: 'Аутсы и эквити',
  ev: 'EV-тренажёр',
  winner: 'Кто победил?',
  combo: 'Какая комбинация?',
  omaha: 'Омаха классическая',
  omaha4: '4-card Омаха · 2 доски',
  omaha5: '5-card Омаха · 2 доски',
  omaha4sim: 'Симулятор · 4-card Омаха',
  omaha5sim: 'Симулятор · 5-card Омаха',
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

function todayKey(): string {
  const d = new Date()
  return keyOf(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10))
  return { y, m: m - 1, d }
}

function formatDateRu(sel: { y: number; m: number; d: number }): string {
  const s = new Date(sel.y, sel.m, sel.d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Цвет ячейки по числу ответов за день */
function intensityClass(attempts: number): string {
  if (attempts <= 0) return 'bg-stone-900/50 border-stone-800 text-stone-600'
  if (attempts < 10) return 'bg-emerald-900/70 border-emerald-800 text-stone-100'
  if (attempts < 25) return 'bg-emerald-800 border-emerald-600 text-stone-50'
  return 'bg-emerald-600 border-emerald-500 text-white'
}

interface DayCellInfo {
  d: number
  key: string
  attempts: number
  isToday: boolean
  isFuture: boolean
}

export function CalendarView({ onBack }: { onBack: () => void }) {
  const dayLog = useStats((s) => s.dayLog ?? {})
  const streak = useStats((s) => s.streak)
  const bestStreak = useStats((s) => s.bestStreak)

  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState<string>(() => todayKey())

  const today = todayKey()
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth()

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  // ячейки месяца: неделя начинается с понедельника, края добиваются пустыми
  const cells: DayCellInfo[] = useMemo(() => {
    const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7
    const totalDays = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const out: DayCellInfo[] = []
    for (let i = 0; i < lead; i++) out.push({ d: -1, key: '', attempts: 0, isToday: false, isFuture: false })
    for (let d = 1; d <= totalDays; d++) {
      const key = keyOf(cursor.y, cursor.m, d)
      const { attempts } = dayEntryTotals(dayLog[key])
      const isFuture = new Date(cursor.y, cursor.m, d).getTime() > new Date().getTime()
      out.push({ d, key, attempts, isToday: key === today, isFuture })
    }
    while (out.length % 7 !== 0) out.push({ d: -1, key: '', attempts: 0, isToday: false, isFuture: false })
    return out
  }, [dayLog, cursor, today])

  // сводка за показанный месяц
  const monthSummary = useMemo(() => {
    const totalDays = new Date(cursor.y, cursor.m + 1, 0).getDate()
    let attempts = 0
    let correct = 0
    let activeDays = 0
    let best: { day: number; attempts: number } | null = null
    for (let d = 1; d <= totalDays; d++) {
      const { attempts: a, correct: c } = dayEntryTotals(dayLog[keyOf(cursor.y, cursor.m, d)])
      if (a > 0) {
        activeDays++
        attempts += a
        correct += c
        if (!best || a > best.attempts) best = { day: d, attempts: a }
      }
    }
    return { totalDays, attempts, acc: accuracy(correct, attempts), activeDays, best }
  }, [dayLog, cursor])

  const hasAnyData = Object.values(dayLog).some((e) => dayEntryTotals(e).attempts > 0)

  // детали выбранного дня
  const sel = parseKey(selected)
  const selEntry = dayLog[selected]
  const selTotals = dayEntryTotals(selEntry)
  const selAcc = accuracy(selTotals.correct, selTotals.attempts)
  const selTrainers: [TrainerId, DayTrainerStat][] = selEntry
    ? (Object.entries(selEntry.t) as [TrainerId, DayTrainerStat][])
        .filter(([, v]) => v && v.attempts > 0)
        .sort((a, b) => b[1].attempts - a[1].attempts)
    : []

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-10 pt-4 flex flex-col gap-4">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-stone-300 hover:text-white hover:bg-stone-800/60">
          <ArrowLeft className="w-4 h-4" /> Меню
        </Button>
        <span className="flex items-center gap-1 text-xs text-orange-400">
          <Flame className="w-3.5 h-3.5" />
          Серия: {streak} дн. · рекорд: {bestStreak} дн.
        </span>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-light text-stone-50">Календарь занятий</h1>
        <p className="text-sm text-stone-400">Статистика прохождения упражнений по дням: нажмите на день, чтобы увидеть подробности</p>
      </div>

      {!hasAnyData && (
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-stone-400 leading-relaxed">
              Дневная статистика копится с момента этого обновления — раньше ответы сохранялись только общими итогами.
              Пройдите любую тренировку, и день закрасится в календаре.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Сетка месяца */}
      <Card className="border-stone-800 bg-stone-900/50">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftMonth(-1)}
              aria-label="Предыдущий месяц"
              className="border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-base font-normal text-stone-100">
              {MONTHS_RU[cursor.m]} {cursor.y}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              aria-label="Следующий месяц"
              className="border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700 px-2 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS_RU.map((w) => (
              <div key={w} className="text-center text-[10px] text-stone-500 pb-1">{w}</div>
            ))}
            {cells.map((c, i) =>
              c.d < 0 ? (
                <div key={`e${i}`} className="aspect-square rounded-md" />
              ) : (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelected(c.key)}
                  aria-label={`${c.d} ${MONTHS_RU[cursor.m].toLowerCase()}: ${c.attempts === 0 ? 'нет занятий' : `${c.attempts} ответов`}`}
                  className={cn(
                    'aspect-square rounded-md border text-xs flex items-center justify-center transition',
                    intensityClass(c.attempts),
                    c.attempts > 0 && 'hover:ring-1 hover:ring-emerald-400/60',
                    c.isToday && 'ring-1 ring-emerald-400/80',
                    selected === c.key && 'ring-2 ring-emerald-400',
                    c.isFuture && 'opacity-40',
                  )}
                >
                  {c.d}
                </button>
              ),
            )}
          </div>

          {/* Легенда */}
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-stone-500">
            <span>меньше</span>
            {[0, 5, 15, 30].map((n) => (
              <span key={n} className={cn('w-3.5 h-3.5 rounded-sm border', intensityClass(n))} />
            ))}
            <span>больше</span>
          </div>
        </CardContent>
      </Card>

      {/* Сводка за месяц */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-3 flex flex-col gap-0.5">
            <span className="text-xl font-normal text-stone-50">{monthSummary.attempts}</span>
            <span className="text-[11px] text-stone-400">ответов за месяц</span>
          </CardContent>
        </Card>
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-3 flex flex-col gap-0.5">
            <span className={cn('text-xl font-normal', monthSummary.acc !== null && monthSummary.acc >= 70 ? 'text-emerald-400' : 'text-stone-50')}>
              {monthSummary.acc === null ? '—' : `${monthSummary.acc}%`}
            </span>
            <span className="text-[11px] text-stone-400">точность за месяц</span>
          </CardContent>
        </Card>
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-3 flex flex-col gap-0.5">
            <span className="text-xl font-normal text-stone-50">
              {monthSummary.activeDays}<span className="text-sm text-stone-500">/{monthSummary.totalDays}</span>
            </span>
            <span className="text-[11px] text-stone-400">дней с занятиями</span>
          </CardContent>
        </Card>
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-3 flex flex-col gap-0.5">
            <span className="text-xl font-normal text-stone-50">
              {monthSummary.best ? monthSummary.best.attempts : '—'}
            </span>
            <span className="text-[11px] text-stone-400">
              {monthSummary.best ? `рекорд дня: ${monthSummary.best.day} число` : 'рекорд дня'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Детали выбранного дня */}
      <Card className="border-stone-800 bg-stone-900/50">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-normal text-stone-100">{formatDateRu(sel)}</h2>
            {selected === today && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">сегодня</span>
            )}
          </div>

          {selTotals.attempts === 0 && !selEntry?.exams.length && (
            <p className="text-xs text-stone-500">В этот день занятий не было.</p>
          )}

          {selTotals.attempts > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-stone-300">
                  Ответов: <b className="text-stone-100 font-normal">{selTotals.attempts}</b>
                </span>
                {selAcc !== null && (
                  <span className={cn('font-normal', selAcc >= 70 ? 'text-emerald-400' : selAcc >= 50 ? 'text-amber-400' : 'text-red-400')}>
                    Точность: {selAcc}%
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {selTrainers.map(([id, v]) => {
                  const acc = accuracy(v.correct, v.attempts)
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-stone-400 truncate">{TRAINER_LABELS[id]}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-stone-500">{v.attempts} отв.</span>
                        <span className={cn('w-11 text-right font-normal', acc !== null && acc >= 70 ? 'text-emerald-400' : acc !== null && acc >= 50 ? 'text-amber-400' : 'text-red-400')}>
                          {acc === null ? '—' : `${acc}%`}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {selEntry && selEntry.exams.length > 0 && (
            <div className="flex flex-col gap-1 pt-1 border-t border-stone-800">
              {selEntry.exams.map((ex, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-stone-300 truncate">
                    <Trophy className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    Экзамен · {TRAINER_LABELS[ex.trainer]}
                  </span>
                  <span className={cn('font-normal shrink-0', ex.pct >= 70 ? 'text-emerald-400' : 'text-amber-400')}>{ex.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
