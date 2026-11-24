// Проверка simulateEquity на 8 оппонентах: валидность и производительность
import { parseCard, Card } from '../src/lib/poker/cards'
import { simulateEquity } from '../src/lib/poker/equity'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}
const pc = (s: string) => parseCard(s) as Card

// 1. AA против 8 случайных оппонентов (префлоп)
{
  const t0 = Date.now()
  const sim = simulateEquity({ hero: [pc('As'), pc('Ad')], board: [], opponents: 8, iterations: 5000 })
  const dt = Date.now() - t0
  console.log(`AA vs 8 оппонентов: win ${sim.win.toFixed(3)}, tie ${sim.tie.toFixed(3)} (${dt} мс на 5000 итераций)`)
  assert(Math.abs(sim.win + sim.tie + sim.lose - 1) < 1e-9, 'probabilities sum to 1')
  assert(sim.win + sim.tie / 2 > 0.15 && sim.win + sim.tie / 2 < 0.45, `AA vs 8 equity sane, got ${sim.win + sim.tie / 2}`)
  assert(dt < 3000, '8 opponents performance')

  // сравнение: AA vs 1 — эквити должно быть заметно выше
  const sim1 = simulateEquity({ hero: [pc('As'), pc('Ad')], board: [], opponents: 1, iterations: 5000 })
  assert(sim.win + sim.tie / 2 < sim1.win + sim1.tie / 2, 'equity decreases with more opponents')
  console.log(`AA vs 1 оппонент: win ${sim1.win.toFixed(3)}`)
}

// 2. Постфлоп с 8 оппонентами и заполненной доской
{
  const hero = [pc('Ah'), pc('Kh')]
  const board = [pc('Qh'), pc('Jh'), pc('Ts')]
  const t0 = Date.now()
  const sim = simulateEquity({ hero, board, opponents: 8, iterations: 5000 })
  const dt = Date.now() - t0
  console.log(`Бродвей-флеш-дро vs 8: win ${sim.win.toFixed(3)} (${dt} мс)`)
  assert(Math.abs(sim.win + sim.tie + sim.lose - 1) < 1e-9, 'postflop probabilities sum to 1')
  // на этом борде герой уже имеет стрит/флеш-дро — эквити против случайных рук высокое
  assert(sim.win + sim.tie / 2 > 0.35, `strong hand high equity vs randoms, got ${sim.win + sim.tie / 2}`)
}

// 3. Максимальный стол: 2 героя + 8×2 оппонентов + 5 доска = 23 карты — выборка валидна
{
  let bad = 0
  for (let t = 0; t < 30; t++) {
    const sim = simulateEquity({ hero: [pc('2c'), pc('3d')], board: [pc('4h'), pc('5s'), pc('6c')], opponents: 8, iterations: 300 })
    if (!isFinite(sim.win) || !isFinite(sim.tie) || !isFinite(sim.lose)) bad++
  }
  assert(bad === 0, 'no NaN with 8 opponents')
  console.log('30 повторных прогонов с 8 оппонентами: NaN не обнаружено')
}

if (failures === 0) {
  console.log('OK: simulateEquity корректно работает с 8 оппонентами')
} else {
  console.error(`Провалено проверок: ${failures}`)
  process.exit(1)
}
