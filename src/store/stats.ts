// Глобальная статистика тренировок с сохранением в localStorage.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TrainerId = 'sim' | 'math' | 'outs' | 'ev' | 'winner' | 'combo' | 'omaha' | 'omaha4' | 'omaha5' | 'omaha4sim' | 'omaha5sim'

export interface TrainerStats {
  attempts: number
  correct: number
  hints: number // использованные подсказки (не идут в точность)
  sessionAttempts: number
  sessionCorrect: number
}

interface StatsState {
  stats: Record<TrainerId, TrainerStats>
  streak: number
  bestStreak: number
  lastPlayedDate: string | null
  recordAnswer: (trainer: TrainerId, correct: boolean) => void
  recordHint: (trainer: TrainerId) => void
  resetSession: (trainer: TrainerId) => void
  resetAll: () => void
}

function emptyStats(): Record<TrainerId, TrainerStats> {
  return {
    sim: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    math: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    outs: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    ev: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    winner: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    combo: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    omaha: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    omaha4: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    omaha5: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    omaha4sim: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
    omaha5sim: { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 },
  }
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
      streak: 0,
      bestStreak: 0,
      lastPlayedDate: null,
      recordAnswer: (trainer, correct) => {
        const s = get()
        // защита от старых сохранений без новых режимов
        const t = s.stats[trainer] ?? { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 }
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
              ...t, // сохраняем прочие поля (например, hints)
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
      },
      recordHint: (trainer) => {
        const s = get()
        const t = s.stats[trainer] ?? { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 }
        set({
          stats: { ...s.stats, [trainer]: { ...t, hints: t.hints + 1 } },
        })
      },
      resetSession: (trainer) => {
        const s = get()
        const t = s.stats[trainer] ?? { attempts: 0, correct: 0, hints: 0, sessionAttempts: 0, sessionCorrect: 0 }
        set({
          stats: { ...s.stats, [trainer]: { ...t, sessionAttempts: 0, sessionCorrect: 0 } },
        })
      },
      resetAll: () => set({ stats: emptyStats(), streak: 0, lastPlayedDate: null }),
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
        return { ...current, ...p, stats: merged }
      },
    },
  ),
)

export function accuracy(correct: number, attempts: number): number | null {
  if (attempts === 0) return null
  return Math.round((correct / attempts) * 100)
}
