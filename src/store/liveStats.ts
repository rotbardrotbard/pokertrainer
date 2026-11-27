// Отдельная статистика живой игры (раздачи, решения) — не влияет на XP и календарь.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LiveGame } from '@/lib/poker/live'

export interface LiveGameStat {
  hands: number
  decisions: number
  correct: number
}

interface LiveStatsState {
  hands: number
  decisions: number
  correct: number
  byGame: Record<LiveGame, LiveGameStat>
  recordHand: (game: LiveGame, decisions: number, correct: number) => void
  resetAll: () => void
}

function emptyStat(): LiveGameStat {
  return { hands: 0, decisions: 0, correct: 0 }
}

function emptyAll(): Record<LiveGame, LiveGameStat> {
  return { holdem: emptyStat(), omaha4: emptyStat(), omaha4x2: emptyStat(), omaha5x2: emptyStat() }
}

export const useLiveStats = create<LiveStatsState>()(
  persist(
    (set, get) => ({
      hands: 0,
      decisions: 0,
      correct: 0,
      byGame: emptyAll(),
      recordHand: (game, decisions, correct) => {
        const s = get()
        const bg = { ...emptyAll(), ...(s.byGame ?? {}) }
        const g = bg[game] ?? emptyStat()
        set({
          hands: (s.hands ?? 0) + 1,
          decisions: (s.decisions ?? 0) + decisions,
          correct: (s.correct ?? 0) + correct,
          byGame: {
            ...bg,
            [game]: { hands: g.hands + 1, decisions: g.decisions + decisions, correct: g.correct + correct },
          },
        })
      },
      resetAll: () => set({ hands: 0, decisions: 0, correct: 0, byGame: emptyAll() }),
    }),
    {
      name: 'poker-live-stats',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LiveStatsState>
        return {
          ...current,
          ...p,
          byGame: { ...emptyAll(), ...(p.byGame ?? {}) },
        }
      },
    },
  ),
)
