// Достижения-бейджи: вычисляются из снапшота статистики (без отдельного persisted-состояния).
import { TrainerId, TrainerStats, DayEntry, dayEntryTotals, TRAINER_IDS } from '@/store/stats'

export interface StatsSnapshot {
  stats: Record<TrainerId, TrainerStats>
  dayLog: Record<string, DayEntry>
  bestStreak: number
  bestAnswerStreak: number
  xp: number
}

export interface BadgeDef {
  id: string
  title: string
  desc: string
  earned: (s: StatsSnapshot) => boolean
}

function totalCorrect(s: StatsSnapshot): number {
  return Object.values(s.stats).reduce((a, t) => a + t.correct, 0)
}

function activeDays(s: StatsSnapshot): number {
  return Object.values(s.dayLog).filter((e) => dayEntryTotals(e).attempts > 0).length
}

function maxDayCorrect(s: StatsSnapshot): number {
  return Object.values(s.dayLog).reduce((a, e) => Math.max(a, dayEntryTotals(e).correct), 0)
}

function examsTaken(s: StatsSnapshot): number {
  return Object.values(s.stats).reduce((a, t) => a + (t.exams ?? 0), 0)
}

function bestExam(s: StatsSnapshot): number {
  return Object.values(s.stats).reduce((a, t) => Math.max(a, t.examBest ?? 0), 0)
}

function modesCovered(s: StatsSnapshot): number {
  return TRAINER_IDS.filter((id) => s.stats[id].correct > 0).length
}

export const BADGES: BadgeDef[] = [
  { id: 'firstSteps', title: 'Первая раздача', desc: 'Первый верный ответ в любом режиме', earned: (s) => totalCorrect(s) >= 1 },
  { id: 'hundred', title: 'Сотня', desc: '100 верных ответов всего', earned: (s) => totalCorrect(s) >= 100 },
  { id: 'fiveHundred', title: 'Полтысячи', desc: '500 верных ответов всего', earned: (s) => totalCorrect(s) >= 500 },
  { id: 'answerStreak10', title: 'Без промаха ×10', desc: '10 верных ответов подряд', earned: (s) => s.bestAnswerStreak >= 10 },
  { id: 'answerStreak20', title: 'Без промаха ×20', desc: '20 верных ответов подряд', earned: (s) => s.bestAnswerStreak >= 20 },
  { id: 'dayGoal', title: 'Дневная цель', desc: '10 верных ответов за один день', earned: (s) => maxDayCorrect(s) >= 10 },
  { id: 'workhorse', title: 'Работяга', desc: '20 верных ответов за один день', earned: (s) => maxDayCorrect(s) >= 20 },
  { id: 'weekDiscipline', title: 'Неделя дисциплины', desc: 'Серия занятий 7 дней без пропуска', earned: (s) => s.bestStreak >= 7 },
  { id: 'marathon', title: 'Марафонец', desc: 'Серия занятий 30 дней без пропуска', earned: (s) => s.bestStreak >= 30 },
  { id: 'firstExam', title: 'Аттестат', desc: 'Первый сданный экзамен', earned: (s) => examsTaken(s) >= 1 },
  { id: 'examGreat', title: 'Отличник', desc: 'Экзамен на 90% и выше', earned: (s) => bestExam(s) >= 90 },
  { id: 'allModes', title: 'Все дисциплины', desc: 'Верный ответ в каждом режиме тренировок', earned: (s) => modesCovered(s) >= TRAINER_IDS.length },
  { id: 'calendarVeteran', title: 'Ветеран календаря', desc: '30 дней с занятиями за всё время', earned: (s) => activeDays(s) >= 30 },
]

/** Бейдж с вычисленным статусом получения */
export interface EarnedBadge {
  id: string
  title: string
  desc: string
  earned: boolean
}

export function evaluateBadges(s: StatsSnapshot): EarnedBadge[] {
  return BADGES.map(({ earned, ...rest }) => ({ ...rest, earned: earned(s) }))
}
