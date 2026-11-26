// Глобальная статистика тренировок с сохранением в localStorage.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TrainerId = 'sim' | 'math' | 'outs' | 'ev' | 'winner' | 'combo' | 'omaha' | 'omaha4' | 'omaha5' | 'omaha4sim' | 'omaha5sim'

export interface TrainerStats {
  attempts: number
  correct: number
  hints: number // использованные подсказки (не идут в точность)
  exams: number // сдано экзаменов (симулятор раздач)
  examBest: number // лучший результат экзамена, %
  sessionAttempts: number
  sessionCorrect: number
}

function emptyT(): TrainerStats {
  return { attempts: 0, correct: 0, hints: 0, exams: 0, examBest: 0, sessionAttempts: 0, sessionCorrect: 0 }
}

interface StatsState {
  stats: Record<TrainerId, TrainerStats>
  /** статистика по типам задач: ключ 'math:potOdds', 'outs:Флеш-дро' и т.п. */
  kindStats: Record<string, { attempts: number; correct: number }>
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
  const ids: TrainerId[] = ['sim', 'math', 'outs', 'ev', 'winner', 'combo', 'omaha', 'omaha4', 'omaha5', 'omaha4sim', 'omaha5sim']
  const out = {} as Record<TrainerId, TrainerStats>
  for (const id of ids) out[id] = emptyT()
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
        set({
          stats: {
            ...s.stats,
            [trainer]: {
              ...t,
              exams: (t.exams ?? 0) + 1,
              examBest: Math.max(t.examBest ?? 0, pct),
            },
          },
        })
      },
      resetSession: (trainer) => {
        const s = get()
        const t = s.stats[trainer] ?? emptyT()
        set({
          stats: { ...s.stats, [trainer]: { ...t, sessionAttempts: 0, sessionCorrect: 0 } },
        })
      },
      resetAll: () => set({ stats: emptyStats(), kindStats: {}, streak: 0, lastPlayedDate: null }),
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
        return { ...current, ...p, stats: merged, kindStats: p.kindStats ?? {} }
      },
    },
  ),
)

export function accuracy(correct: number, attempts: number): number | null {
  if (attempts === 0) return null
  return Math.round((correct / attempts) * 100)
}
