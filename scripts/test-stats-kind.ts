// Тест статистики по типам задач в store/stats.ts
import { useStats } from '../src/store/stats'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg)
    process.exit(1)
  }
  console.log('  ' + msg + ' ✓')
}

const s = useStats.getState()

// сброс к чистому состоянию
s.resetAll()
assert(Object.keys(useStats.getState().kindStats).length === 0, 'resetAll очищает kindStats')

// математика: два ответа по potOdds (1 верный), один по mdf (неверный)
s.recordAnswer('math', true, 'math:potOdds')
s.recordAnswer('math', false, 'math:potOdds')
s.recordAnswer('math', false, 'math:mdf')

// аутсы: сценарий с пробелами в названии — ключ и точность
s.recordAnswer('outs', true, 'outs:Флеш-дро')

let ks = useStats.getState().kindStats
assert(ks['math:potOdds'].attempts === 2 && ks['math:potOdds'].correct === 1, 'math:potOdds → 2/1')
assert(ks['math:mdf'].attempts === 1 && ks['math:mdf'].correct === 0, 'math:mdf → 1/0')
assert(ks['outs:Флеш-дро'].attempts === 1 && ks['outs:Флеш-дро'].correct === 1, 'outs:Флеш-дро → 1/1')
assert(useStats.getState().stats.math.attempts === 3, 'общая статистика math тоже растёт (3 попытки)')

// без kind — не ломается и не пишет kindStats
s.recordAnswer('ev', true)
ks = useStats.getState().kindStats
assert(!ks['ev'], 'ответ без типа не создаёт запись в kindStats')

// дневной журнал: каждый ответ попадает в день, суммы сходятся
const dl = useStats.getState().dayLog
const today = Object.keys(dl)[0]!
const d0 = dl[today]!
assert(Object.keys(dl).length === 1, 'все ответы попали в один день (сегодня)')
assert(d0.t.math!.attempts === 3 && d0.t.math!.correct === 1, 'дневная запись math → 3/1')
assert(d0.t.outs!.attempts === 1 && d0.t.outs!.correct === 1, 'дневная запись outs → 1/1')
assert(d0.t.ev!.attempts === 1 && d0.t.ev!.correct === 1, 'дневная запись ev → 1/1')

// экзамен попадает в дневной журнал с процентом
s.recordExam('omaha4sim', 7, 10)
const dl2 = useStats.getState().dayLog[today]
assert(dl2.exams.length === 1 && dl2.exams[0].trainer === 'omaha4sim' && dl2.exams[0].pct === 70, 'экзамен в журнале дня: omaha4sim 70%')

// сброс снова чистит дневник
useStats.getState().resetAll()
assert(Object.keys(useStats.getState().dayLog).length === 0, 'resetAll очищает dayLog')

// resetAll снова всё чистит
useStats.getState().resetAll()
ks = useStats.getState().kindStats
assert(Object.keys(ks).length === 0, 'resetAll после записи — kindStats пуст')

console.log('OK: статистика по типам задач работает')
