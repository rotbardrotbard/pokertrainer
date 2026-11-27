// Тест XP-модели, уровней и бейджей (store/stats.ts + lib/achievements.ts)
import { useStats, levelFor, LEVELS, dayEntryTotals, XP_PER_CORRECT, STREAK_DAY_XP, DAILY_GOAL_XP, EXAM_PASS_XP, EXAM_GREAT_XP } from '../src/store/stats'
import { evaluateBadges } from '../src/lib/achievements'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  console.log('  ' + msg + ' ✓')
}

const s = useStats.getState()
s.resetAll()
let st = useStats.getState()

// ===== XP: верный ответ +2, первый ответ дня даёт бонус серии =====
s.recordAnswer('math', true)
st = useStats.getState()
assert(st.xp === XP_PER_CORRECT + STREAK_DAY_XP, `первый верный ответ: +2 XP и +${STREAK_DAY_XP} XP за день серии (= 7)`)
assert(st.answerStreak === 1 && st.bestAnswerStreak === 1, 'серия верных ответов = 1')

// второй верный (не первый за день): только +2
s.recordAnswer('math', true)
st = useStats.getState()
assert(st.xp === 9, 'второй верный: +2 XP (итого 9)')
assert(st.answerStreak === 2, 'серия верных = 2')

// неверный ответ: 0 XP, серия обнуляется, рекорд сохраняется
s.recordAnswer('ev', false)
st = useStats.getState()
assert(st.xp === 9, 'неверный ответ не даёт XP')
assert(st.answerStreak === 0 && st.bestAnswerStreak === 2, 'серия сброшена, рекорд 2 сохранён')

// ===== дневная цель: каждые 10 верных за день +10 XP =====
// сейчас в дне 2 верных; добавим ещё 8 верных подряд — на 10-м сработает бонус
for (let i = 0; i < 7; i++) s.recordAnswer('outs', true)
st = useStats.getState()
assert(st.xp === 9 + 7 * XP_PER_CORRECT, '7 верных по +2 XP без порогов цели')
s.recordAnswer('outs', true) // 10-й верный за день
st = useStats.getState()
assert(st.xp === 9 + 8 * XP_PER_CORRECT + DAILY_GOAL_XP, '10-й верный за день даёт +10 XP дневной цели')
assert(st.bestAnswerStreak === 8, 'рекорд верных подряд = 8 (2 до промаха, 8 после)')

// дневной журнал: сумма за день = 10 верных
const today = Object.keys(st.dayLog)[0]
assert(dayEntryTotals(st.dayLog[today]).correct === 10, 'в дне ровно 10 верных ответов')

// ===== экзамен: >=70% → +30, >=90% → +50, ниже → 0 =====
s.recordExam('omaha4sim', 7, 10) // 70% → +30
st = useStats.getState()
assert(st.xp === 9 + 16 + 10 + EXAM_PASS_XP, 'экзамен 70% даёт +30 XP')
s.recordExam('omaha4sim', 9, 10) // 90% → +50
st = useStats.getState()
assert(st.xp === 9 + 16 + 10 + EXAM_PASS_XP + EXAM_GREAT_XP, 'экзамен 90% даёт +50 XP')
s.recordExam('omaha4sim', 5, 10) // 50% → 0
st = useStats.getState()
assert(st.xp === 9 + 16 + 10 + EXAM_PASS_XP + EXAM_GREAT_XP, 'экзамен 50% не даёт XP')

// ===== уровни: пороги и прогресс =====
assert(LEVELS.length === 10, '10 уровней')
assert(LEVELS.map((l) => l.name).join(',') === 'Фиш,Любитель,Микро-гриндер,Регуляр,TAG-игрок,Шарк,Гриндер,Профи,Мастер,GTO-мастер', 'названия уровней по согласованию')
assert(LEVELS.every((l, i) => i === 0 || l.xp > LEVELS[i - 1].xp), 'пороги возрастают')
assert(levelFor(0).name === 'Фиш' && levelFor(0).index === 0, '0 XP → Фиш')
assert(levelFor(99).name === 'Фиш', '99 XP → ещё Фиш')
assert(levelFor(100).name === 'Любитель' && levelFor(100).progress === 0, '100 XP → Любитель, прогресс 0')
assert(levelFor(700).name === 'Регуляр', '700 XP → Регуляр')
assert(levelFor(1200).name === 'TAG-игрок', '1200 XP → TAG-игрок')
assert(levelFor(3199).name === 'Шарк', '3199 XP → ещё Шарк')
assert(levelFor(3200).name === 'Гриндер' && levelFor(3200).progress === 0, '3200 XP → Гриндер')
assert(levelFor(5000).name === 'Профи', '5000 XP → Профи')
assert(levelFor(8000).name === 'Мастер', '8000 XP → Мастер')
assert(levelFor(12499).name === 'Мастер', '12499 XP → ещё Мастер')
assert(levelFor(12500).name === 'GTO-мастер' && levelFor(12500).next === null && levelFor(12500).progress === 1, '12500 XP → GTO-мастер, максимум')

// ===== бейджи: предикаты на синтетическом снапшоте =====
const snap = {
  stats: { ...st.stats },
  dayLog: st.dayLog,
  bestStreak: 7,
  bestAnswerStreak: 20,
  xp: 500,
}
let badges = evaluateBadges(snap)
const byId = (id: string) => badges.find((b) => b.id === id)!
assert(byId('firstSteps').earned, 'бейдж «Первая раздача» открыт')
assert(byId('answerStreak20').earned, 'бейдж «Без промаха ×20» открыт (рекорд 20)')
assert(byId('weekDiscipline').earned, 'бейдж «Неделя дисциплины» открыт (серия 7)')
assert(byId('marathon').earned === false, 'бейдж «Марафонец» закрыт (серия < 30)')
assert(byId('dayGoal').earned, 'бейдж «Дневная цель» открыт (10 верных за день)')
assert(byId('workhorse').earned === false, 'бейдж «Работяга» закрыт (20 верных за день нет)')
assert(byId('firstExam').earned, 'бейдж «Аттестат» открыт (экзамены есть)')
assert(byId('examGreat').earned, 'бейдж «Отличник» открыт (90%)')
assert(byId('allModes').earned === false, 'бейдж «Все дисциплины» закрыт (не все режимы)')
assert(byId('calendarVeteran').earned === false, 'бейдж «Ветеран календаря» закрыт (< 30 дней)')

// все 11 режимов → «Все дисциплины»
for (const id of ['sim', 'math', 'outs', 'ev', 'winner', 'combo', 'omaha', 'omaha4', 'omaha5', 'omaha4sim', 'omaha5sim'] as const) {
  s.recordAnswer(id, true)
}
st = useStats.getState()
badges = evaluateBadges({ ...snap, stats: st.stats })
assert(badges.find((b) => b.id === 'allModes')!.earned, 'бейдж «Все дисциплины» открыт после ответа в каждом режиме')

// 30 дней с занятиями → «Ветеран календаря»
const log30: typeof st.dayLog = {}
for (let i = 1; i <= 30; i++) {
  const key = `2026-10-${String(i).padStart(2, '0')}`
  log30[key] = { t: { math: { attempts: 3, correct: 3 } }, exams: [] }
}
badges = evaluateBadges({ ...snap, stats: st.stats, dayLog: log30 })
assert(badges.find((b) => b.id === 'calendarVeteran')!.earned, 'бейдж «Ветеран календаря» открыт (30 дней)')

// ===== сброс: XP и серии обнуляются =====
s.resetAll()
st = useStats.getState()
assert(st.xp === 0 && st.answerStreak === 0 && st.bestAnswerStreak === 0 && Object.keys(st.dayLog).length === 0, 'resetAll очищает XP, серии и дневник')

console.log('OK: XP, уровни и бейджи работают')
