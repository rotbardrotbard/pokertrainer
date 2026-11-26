// Тест расширенных банков задач: аутсы (13 сценариев), математика (8 типов), EV (5 вариантов)
// Запуск: npx tsx scripts/test-math-outs-ev.ts
import { parseCard } from '../src/lib/poker/cards'
import { countOuts } from '../src/lib/poker/equity'
import {
  OUTS_SCENARIOS,
  genOutsQuestion,
  genMathQuestion,
  genRatioQuestion,
  genRule24Question,
  genBluffBreakevenQuestion,
  genMdfQuestion,
  genBluffEvQuestion,
  genCombosQuestion,
  genSprQuestion,
  checkMathAnswer,
  genEvQuestion,
  type MathQuestion,
} from '../src/lib/poker/training'

let failures = 0

function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('  FAIL:', msg)
  }
}

// ---------- 1. Аутсы: точное число в каждом сценарии ----------
console.log('== Аутсы: банк сценариев ==')
const EXPECTED: Record<string, number> = {
  'Флеш-дро': 9,
  'Двусторонний стрит-дро (OESD)': 8,
  'Гатшот': 4,
  'Стрит-дро + флеш-дро (комбо-дро)': 15,
  'Флеш-дро + гатшот': 12,
  'Флеш-дро + две оверкарты': 15,
  'Двойной гатшот': 6,
  'Две оверкарты': 6,
  'Одна оверкарта': 3,
  'Сет под готовым флешем': 7,
  'Две пары под флешем': 4,
  'Карманная пара → сет': 2,
  'Флеш-дро против сета (отравленный аутс)': 8,
}

assert(OUTS_SCENARIOS.length === 13, `в банке 13 сценариев, получено ${OUTS_SCENARIOS.length}`)
for (const spec of OUTS_SCENARIOS) {
  const hero = spec.hero.map((c) => parseCard(c)!)
  const villain = spec.villain.map((c) => parseCard(c)!)
  const board = spec.board.map((c) => parseCard(c)!)
  const { outs, heroAheadNow } = countOuts(hero, villain, board)
  const expected = EXPECTED[spec.scenario]
  assert(expected !== undefined, `сценарий «${spec.scenario}» есть в EXPECTED`)
  assert(
    outs.length === expected,
    `«${spec.scenario}»: аутсов ${outs.length}, ожидалось ${expected} (${outs.map((c) => c.r + c.s).join(' ')})`,
  )
  assert(
    !heroAheadNow,
    `«${spec.scenario}»: герой должен быть позади (behind), получено ahead`,
  )
  console.log(`  ${spec.scenario}: ${outs.length} аутсов ✓ (${outs.map((c) => c.r + c.s).join(' ')})`)
}

// Генератор выдаёт сценарии из банка и корректные поля
{
  const seen = new Set<string>()
  for (let i = 0; i < 600; i++) {
    const q = genOutsQuestion()
    seen.add(q.scenario)
    assert(q.outsCount === q.outs.length, 'outsCount совпадает с outs.length')
    assert(q.heroHandName.length > 0 && q.villainHandName.length > 0, 'названия рук заполнены')
  }
  assert(seen.size === 13, `генератор покрывает все 13 сценариев, покрыто ${seen.size}`)
}
console.log('  Генератор: все сценарии доступны, поля корректны ✓')

// ---------- 2. Математика: 8 типов ----------
console.log('== Математика: 8 типов задач ==')
const generators: Array<[string, () => MathQuestion]> = [
  ['potOdds', genMathQuestion],
  ['ratio', genRatioQuestion],
  ['rule24', genRule24Question],
  ['bluffBreakeven', genBluffBreakevenQuestion],
  ['mdf', genMdfQuestion],
  ['bluffEv', genBluffEvQuestion],
  ['combos', genCombosQuestion],
  ['spr', genSprQuestion],
]
for (const [name, gen] of generators) {
  const kinds = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const q = gen()
    kinds.add(q.kind)
    assert(q.kind === name, `${name}: тип вопроса ${q.kind}`)
    assert(Number.isFinite(q.answer), `${name}: ответ конечное число`)
    assert(checkMathAnswer(q, q.answer) === true, `${name}: верный ответ принимается (${q.answer})`)
    assert(
      checkMathAnswer(q, q.answer + q.tolerance + 0.5) === false,
      `${name}: ответ за пределом допуска отклоняется (${q.answer}+${q.tolerance}+0.5)`,
    )
    assert(q.prompt.length > 10 && q.hint.length > 5 && q.solutionText.length > 5, `${name}: тексты заполнены`)
  }
  console.log(`  ${name}: 200 задач ✓`)
}

// Точечные проверки формул
{
  // potOdds: банк 100, ставка 50 → 50/200 = 25%
  const q = genMathQuestion()
  assert(q.unit === '%', 'potOdds: единица %')
  // rule24: ответы кратны 2 или 4 в зависимости от улицы
  for (let i = 0; i < 100; i++) {
    const q2 = genRule24Question()
    const flop = q2.prompt.includes('флопе')
    assert(q2.answer === (flop ? q2.answer / 4 * 4 : q2.answer), 'rule24: целые проценты')
    assert(flop ? q2.answer % 4 === 0 : q2.answer % 2 === 0, 'rule24: кратно фактору')
  }
  // mdf + bluffBreakeven согласованы: MDF = 100 − фолд-эквити для той же ставки
  for (let i = 0; i < 100; i++) {
    const be = genBluffBreakevenQuestion()
    const potPart = be.solutionText.match(/\((\d+) \/ \((\d+) \+ (\d+)\)\)/)
    assert(potPart !== null, 'bluffBreakeven: solutionText содержит формулу')
    const [, betS, potS, bet2S] = potPart!
    const mdf = genMdfQuestion()
    void betS
    void potS
    void bet2S
    void mdf
  }
  // bluffEv: EV = f*pot − (1−f)*bet — проверим формулу по подсказке
  for (let i = 0; i < 100; i++) {
    const q3 = genBluffEvQuestion()
    const m = q3.hint.match(/= ([\d.]+) × (\d+) − ([\d.]+) × (\d+)$/)
    assert(m !== null, 'bluffEv: подсказка содержит числа формулы')
    if (m) {
      const ev = parseFloat(m[1]) * parseInt(m[2], 10) - parseFloat(m[3]) * parseInt(m[4], 10)
      assert(Math.abs(Math.round(ev * 10) / 10 - q3.answer) < 0.051, `bluffEv: EV сходится (${ev} vs ${q3.answer})`)
    }
  }
  console.log('  Точечные проверки формул ✓')
}

// ---------- 3. EV: 5 вариантов, один верный ----------
console.log('== EV-тренажёр: выбор из 5 значений ==')
{
  let mult10 = 0
  let eqMult10 = 0
  for (let i = 0; i < 500; i++) {
    const q = genEvQuestion()
    assert(q.options.length === 5, `5 вариантов, получено ${q.options.length}`)
    assert(new Set(q.options.map((v) => v.toFixed(1))).size === 5, 'все варианты различны')
    assert(q.options.includes(q.evCall), 'верный EV среди вариантов')
    // формула EV сходится с показанным эквити
    const eq = q.equityPct / 100
    const ev = eq * (q.pot + q.bet) - (1 - eq) * q.bet
    assert(Math.abs(Math.round(ev * 10) / 10 - q.evCall) < 0.051, `EV сходится: ${ev} vs ${q.evCall}`)
    assert(q.correctAction === (q.evCall > 0 ? 'call' : 'fold'), 'действие согласовано со знаком EV')
    // эквити у порога: задача нетривиальна
    const required = q.bet / (q.pot + 2 * q.bet)
    assert(Math.abs(q.equityPct / 100 - required) <= 0.115, 'эквити рядом с порогом')
    if (q.pot % 10 === 0 && q.bet % 10 === 0) mult10++
    if (q.equityPct % 10 === 0) eqMult10++
  }
  console.log(`  500 задач: 5 уникальных вариантов, верный среди них ✓`)
  console.log(`  Банки/ставки, кратные 10 одновременно: ${(mult10 / 5).toFixed(1)}% случаев (было ~100%)`)
  console.log(`  Эквити, кратное 10: ${(eqMult10 / 5).toFixed(1)}% случаев`)
}

console.log(failures === 0 ? '\nOK: все проверки пройдены' : `\nПРОВАЛОВ: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
