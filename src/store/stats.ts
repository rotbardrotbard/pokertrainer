// Глобальная статистика тренировок с сохранением в localStorage.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TrainerId = 'sim' | 'omahaSim' | 'math' | 'outs' | 'ev' | 'winner' | 'combo' | 'omaha' | 'omaha4' | 'omaha5' | 'omaha4sim' | 'omaha5sim'

export const TRAINER_IDS: TrainerId[] = ['sim', 'omahaSim', 'math', 'outs', 'ev', 'winner', 'combo', 'omaha', 'omaha4', 'omaha5', 'omaha4sim', 'omaha5sim']

// ===== Модель XP (уровни достижений) =====
// XP строится на трёх факторах: верные ответы, серия дней без пропуска,
// верные ответы внутри дня (дневная цель).
export const XP_PER_CORRECT = 2 // за каждый верный ответ
export const STREAK_DAY_XP = 5 // за каждый день активной серии
export const STREAK_DAY_CAP = 7 // максимум дней серии, за которые даётся бонус (+35 XP/день)
export const DAILY_GOAL_STEP = 10 // размер шага дневной цели, верных ответов
export const DAILY_GOAL_XP = 10 // бонус за каждые 10 верных ответов за день
export const EXAM_PASS_XP = 30 // экзамен сдан (>= 70%)
export const EXAM_GREAT_XP = 50 // экзамен >= 90%

/** Уровень достижений: имя и порог XP */
export interface Level {
  name: string
  xp: number
}

export const LEVELS: Level[] = [
  { name: 'Фиш', xp: 0 },
  { name: 'Любитель', xp: 100 },
  { name: 'Микро-гриндер', xp: 300 },
  { name: 'Регуляр', xp: 700 },
  { name: 'TAG-игрок', xp: 1200 },
  { name: 'Шарк', xp: 2000 },
  { name: 'Гриндер', xp: 3200 },
  { name: 'Профи', xp: 5000 },
  { name: 'Мастер', xp: 8000 },
  { name: 'GTO-мастер', xp: 12500 },
]

/** Текущий уровень по накопленному XP */
export function levelFor(xp: number): { index: number; name: string; next: Level | null; progress: number } {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) idx = i
  }
  const cur = LEVELS[idx]
  const next = idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1
  return { index: idx, name: cur.name, next, progress: Math.max(0, Math.min(1, progress)) }
}

export interface TrainerStats {
  attempts: number
  correct: number
  hints: number // использованные подсказки (не идут в точность)
  exams: number // сдано экзаменов (симулятор раздач)
  examBest: number // лучший результат экзамена, %
  sessionAttempts: number
  sessionCorrect: number
}

/** Ответы одного режима за день (для календаря занятий) */
export interface DayTrainerStat {
  attempts: number
  correct: number
}

/** Экзамен, завершённый в этот день */
export interface DayExamResult {
  trainer: TrainerId
  pct: number
}

/** Всё, что произошло в тренировках за конкретный день (ключ 'YYYY-MM-DD') */
export interface DayEntry {
  t: Partial<Record<TrainerId, DayTrainerStat>>
  exams: DayExamResult[]
}

export function emptyDayEntry(): DayEntry {
  return { t: {}, exams: [] }
}

/** Сумма ответов дня по всем режимам */
export function dayEntryTotals(e?: DayEntry): { attempts: number; correct: number } {
  let attempts = 0
  let correct = 0
  if (e) {
    for (const t of Object.values(e.t)) {
      if (!t) continue
      attempts += t.attempts
      correct += t.correct
    }
  }
  return { attempts, correct }
}

function emptyT(): TrainerStats {
  return { attempts: 0, correct: 0, hints: 0, exams: 0, examBest: 0, sessionAttempts: 0, sessionCorrect: 0 }
}

interface StatsState {
  stats: Record<TrainerId, TrainerStats>
  /** статистика по типам задач: ключ 'math:potOdds', 'outs:Флеш-дро' и т.п. */
  kindStats: Record<string, { attempts: number; correct: number }>
  /** дневной журнал: ключ 'YYYY-MM-DD' → ответы по режимам и экзамены этого дня */
  dayLog: Record<string, DayEntry>
  /** накопленный XP для уровней достижений */
  xp: number
  /** серия верных ответов подряд (без неверных) */
  answerStreak: number
  /** лучший рекорд верных ответов подряд */
  bestAnswerStreak: number
  streak: number
  bestStreak: number
  lastPlayedDate: string | null
  recordAnswer: (trainer: TrainerId, correct: boolean, kind?: string) => void
  recordHint: (trainer: TrainerId) => void
  recordExam: (trainer: TrainerId, correct: number, total: number) => void
  resetSession: (trainer: TrainerId) => void
  resetAll: () => void
}

function emptyStats(): Record<TrainerId, TrainerStats> {
  const out = {} as Record<TrainerId, TrainerStats>
  for (const id of TRAINER_IDS) out[id] = emptyT()
  return out
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayDiff(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export const useStats = create<StatsState>()(
  persist(
    (set, get) => ({
      stats: emptyStats(),
      kindStats: {},
      dayLog: {},
      xp: 0,
      answerStreak: 0,
      bestAnswerStreak: 0,
      streak: 0,
      bestStreak: 0,
      lastPlayedDate: null,
      recordAnswer: (trainer, correct, kind) => {
        const s = get()
        // защита от старых сохранений без новых режимов
        const t = s.stats[trainer] ?? emptyT()
        const today = todayStr()
        let streak = s.streak
        let bestStreak = s.bestStreak
        if (s.lastPlayedDate !== today) {
          const diff = s.lastPlayedDate ? dayDiff(s.lastPlayedDate, today) : 999
          streak = diff === 1 ? s.streak + 1 : 1
          bestStreak = Math.max(bestStreak, streak)
        }
        // дневной журнал для календаря занятий
        const day = s.dayLog?.[today] ?? emptyDayEntry()
        const dayBefore = dayEntryTotals(day)
        const dt = day.t[trainer] ?? { attempts: 0, correct: 0 }

        // XP: верные ответы + бонус за день серии + дневная цель
        const isFirstAnswerOfDay = dayBefore.attempts === 0
        const streakBonus = isFirstAnswerOfDay && correct ? STREAK_DAY_XP * Math.min(streak, STREAK_DAY_CAP) : 0
        const newDayCorrect = dayBefore.correct + (correct ? 1 : 0)
        const goalBonus = correct && Math.floor(newDayCorrect / DAILY_GOAL_STEP) > Math.floor(dayBefore.correct / DAILY_GOAL_STEP) ? DAILY_GOAL_XP : 0
        const gainedXp = (correct ? XP_PER_CORRECT : 0) + streakBonus + goalBonus

        const answerStreak = correct ? (s.answerStreak ?? 0) + 1 : 0
        const bestAnswerStreak = Math.max(s.bestAnswerStreak ?? 0, answerStreak)

        set({
          stats: {
            ...s.stats,
            [trainer]: {
              ...t, // сохраняем прочие поля (например, hints, exams)
              attempts: t.attempts + 1,
              correct: t.correct + (correct ? 1 : 0),
              sessionAttempts: t.sessionAttempts + 1,
              sessionCorrect: t.sessionCorrect + (correct ? 1 : 0),
            },
          },
          dayLog: {
            ...s.dayLog,
            [today]: {
              ...day,
              t: {
                ...day.t,
                [trainer]: {
                  attempts: dt.attempts + 1,
                  correct: dt.correct + (correct ? 1 : 0),
                },
              },
            },
          },
          xp: (s.xp ?? 0) + gainedXp,
          answerStreak,
          bestAnswerStreak,
          streak,
          bestStreak,
          lastPlayedDate: today,
        })
        // статистика по типу задачи (математика: вид; аутсы: сценарий)
        if (kind) {
          const cur = get().kindStats[kind] ?? { attempts: 0, correct: 0 }
          set({
            kindStats: {
              ...get().kindStats,
              [kind]: {
                attempts: cur.attempts + 1,
                correct: cur.correct + (correct ? 1 : 0),
              },
            },
          })
        }
      },
      recordHint: (trainer) => {
        const s = get()
        const t = s.stats[trainer] ?? emptyT()
        set({
          stats: { ...s.stats, [trainer]: { ...t, hints: t.hints + 1 } },
        })
      },
      recordExam: (trainer, correct, total) => {
        const s = get()
        const t = s.stats[trainer] ?? emptyT()
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0
        // результат экзамена попадает и в дневной журнал; за сданный экзамен — бонус XP
        const examXp = pct >= 90 ? EXAM_GREAT_XP : pct >= 70 ? EXAM_PASS_XP : 0
        const today = todayStr()
        const day = s.dayLog?.[today] ?? emptyDayEntry()
        set({
          stats: {
            ...s.stats,
            [trainer]: {
              ...t,
              exams: (t.exams ?? 0) + 1,
              examBest: Math.max(t.examBest ?? 0, pct),
            },
          },
          dayLog: {
            ...s.dayLog,
            [today]: { ...day, exams: [...day.exams, { trainer, pct }].slice(-20) },
          },
          xp: (s.xp ?? 0) + examXp,
        })
      },
      resetSession: (trainer) => {
        const s = get()
        const t = s.stats[trainer] ?? emptyT()
        set({
          stats: { ...s.stats, [trainer]: { ...t, sessionAttempts: 0, sessionCorrect: 0 } },
        })
      },
      resetAll: () => set({
        stats: emptyStats(),
        kindStats: {},
        dayLog: {},
        xp: 0,
        answerStreak: 0,
        bestAnswerStreak: 0,
        streak: 0,
        lastPlayedDate: null,
      }),
    }),
    {
      name: 'poker-trainer-stats',
      // мержим сохранение с актуальной схемой, чтобы новые режимы не ломали старые данные
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StatsState>
        const merged = emptyStats()
        for (const k of Object.keys(merged) as TrainerId[]) {
          merged[k] = { ...merged[k], ...(p.stats?.[k] ?? {}) }
        }
        // миграция: у пользователей без XP начисляем его за накопленные верные ответы,
        // чтобы уровень не сбросился в ноль после обновления
        const backfillXp = Object.values(merged).reduce((a, t) => a + t.correct, 0) * XP_PER_CORRECT
        return {
          ...current,
          ...p,
          stats: merged,
          kindStats: p.kindStats ?? {},
          dayLog: p.dayLog ?? {},
          xp: p.xp ?? backfillXp,
          answerStreak: p.answerStreak ?? 0,
          bestAnswerStreak: p.bestAnswerStreak ?? 0,
        }
      },
    },
  ),
)

export function accuracy(correct: number, attempts: number): number | null {
  if (attempts === 0) return null
  return Math.round((correct / attempts) * 100)
}
