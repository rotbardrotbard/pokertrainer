// Проверка GTO-чартов: позиции, масштаб по столу, префлоп-действия, постфлоп-гайды
import { parseCard, Card } from '../src/lib/poker/cards'
import {
  seatsForTable, basePos, tableScale, holdemPreflop, holdemAction,
  omahaPreflop, omahaAction, postflopGuide, preflopNotes, multiwayNote,
} from '../src/lib/poker/gto'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  } else {
    console.log('ok:', msg)
  }
}
const pc = (s: string) => parseCard(s) as Card
const hand = (codes: string[]) => codes.map(pc)

// 1. Позиции по размеру стола
{
  const s2 = seatsForTable(2)
  const s6 = seatsForTable(6)
  const s9 = seatsForTable(9)
  assert(s2.length === 2 && s2[0] === 'BTN' && s2[1] === 'BB', `хедз-ап: ${s2.join(', ')}`)
  assert(s6.length === 6 && s6[3] === 'BTN', `6-max: ${s6.join(', ')}`)
  assert(s9.length === 9 && s9[6] === 'BTN' && s9[5] === 'CO', `9-max: ${s9.join(', ')}`)
  assert(basePos('MP2') === 'MP' && basePos('HJ') === 'MP' && basePos('UTG1') === 'UTG' && basePos('BTN') === 'BTN', 'basePos корректно маппится')
}

// 2. Масштаб по столу: больше игроков — тайтовее
{
  assert(tableScale(4) > tableScale(6) && tableScale(6) > tableScale(9), 'tableScale убывает с ростом стола')
  const utg6 = holdemPreflop('UTG', 6, 'open', 0)
  const utg9 = holdemPreflop('UTG', 9, 'open', 0)
  console.log(`UTG open: 6-max ${utg6.raisePct.toFixed(1)}%, 9-max ${utg9.raisePct.toFixed(1)}%`)
  assert(utg9.raisePct < utg6.raisePct, 'открытие UTG на 9-max тайтовее, чем на 6-max')
  assert(utg6.raisePct < holdemPreflop('MP', 6, 'open', 0).raisePct, 'UTG тайтовее MP')
  assert(holdemPreflop('MP', 6, 'open', 0).raisePct < holdemPreflop('CO', 6, 'open', 0).raisePct, 'MP тайтовее CO')
  assert(holdemPreflop('CO', 6, 'open', 0).raisePct < holdemPreflop('BTN', 6, 'open', 0).raisePct, 'CO тайтовее BTN')
}

// 3. Действия Холдем: конкретные руки
{
  const utg = holdemPreflop('UTG', 6, 'open', 0)
  assert(holdemAction('AA', utg) === 'raise', 'AA с UTG — рейз')
  assert(holdemAction('AKs', utg) === 'raise', 'AKs с UTG — рейз')
  assert(holdemAction('72o', utg) === 'fold', '72o с UTG — фолд')
  const btn = holdemPreflop('BTN', 6, 'open', 0)
  assert(holdemAction('K2s', btn) === 'raise', 'K2s с BTN — рейз')
  assert(holdemAction('32o', btn) === 'fold', '32o с BTN — фолд')

  const vs = holdemPreflop('BB', 6, 'vsraise', 0)
  console.log(`BB vs raise: 3бет ${vs.raisePct.toFixed(0)}%, колл ${vs.callPct.toFixed(0)}%`)
  assert(holdemAction('AA', vs) === 'raise', 'AA против рейза — 3бет')
  assert(holdemAction('76s', vs) === 'call', '76s против рейза с BB — колл')
  assert(holdemAction('32o', vs) === 'fold', '32o против рейза — фолд')

  const vsMulti = holdemPreflop('BB', 6, 'vsraise', 3)
  assert(vsMulti.callPct < vs.callPct, 'в мультпоте колл-диапазон уже')
}

// 4. Действия Омахи
{
  const chart = omahaPreflop('omaha4', 'UTG', 6, 'open', 0)
  const btn = omahaPreflop('omaha4', 'BTN', 6, 'open', 0)
  console.log(`omaha4 open: UTG ${chart.openPercent.toFixed(0)}%, BTN ${btn.openPercent.toFixed(0)}%`)
  assert(chart.openPercent < btn.openPercent, 'открытие UTG в Омахе тайтовее BTN')

  const aakq = hand(['Ah', 'Ad', 'Kh', 'Qd'])
  const weak = hand(['2c', '3d', '7h', '9s'])
  assert(omahaAction('omaha4', aakq, chart, 'open') === 'raise', 'AAKQ ds с UTG — рейз')
  assert(omahaAction('omaha4', weak, chart, 'open') === 'fold', 'мусор с UTG — фолд')

  const vs = omahaPreflop('omaha4', 'BB', 6, 'vsraise', 0)
  console.log(`omaha4 BB vs raise: 3бет ${vs.threeBetPercent.toFixed(0)}%, колл ${vs.callPercent.toFixed(0)}%`)
  assert(omahaAction('omaha4', aakq, vs, 'vsraise') === 'raise', 'AAKQ ds против рейза — 3бет')
  const mid = hand(['Kh', 'Qh', 'Jd', '9d'])
  const midAction = omahaAction('omaha4', mid, vs, 'vsraise')
  assert(midAction === 'call' || midAction === 'raise', `KQJ9 ds против рейза — колл/3бет (${midAction})`)
  assert(omahaAction('omaha4', weak, vs, 'vsraise') === 'fold', 'мусор против рейза — фолд')

  // PLO5 шире PLO4
  const p5 = omahaPreflop('omaha5', 'UTG', 6, 'open', 0)
  assert(p5.openPercent > chart.openPercent, 'PLO5 открывается шире PLO4')
}

// 5. Постфлоп-гайды
{
  for (const street of ['flop', 'turn', 'river'] as const) {
    for (const game of ['holdem', 'omaha4', 'omaha5'] as const) {
      const g = postflopGuide(game, street, 1, 'BTN')
      assert(g.tiers.length >= 4, `${game}:${street}: ${g.tiers.length} уровней силы`)
      assert(g.intro.length > 0 && g.gameNote.length > 0, `${game}:${street}: тексты заполнены`)
    }
  }
  const g1 = postflopGuide('holdem', 'flop', 1, 'BTN')
  const g4 = postflopGuide('holdem', 'flop', 5, 'BTN')
  assert(g4.multiwayNote.includes('5') && g4.multiwayNote !== g1.multiwayNote, 'мультпот-примечание зависит от числа оппонентов')
  assert(multiwayNote(1).includes('одного'), 'хедз-ап примечание')

  const gBB = postflopGuide('omaha4', 'flop', 2, 'BB')
  assert(gBB.positionNote.includes('без позиции'), 'примечание о позиции (BB — OOP)')
}

// 6. Принципы префлопа
{
  const nOpen = preflopNotes('holdem', 'UTG', 'open', 0)
  const nVs = preflopNotes('omaha4', 'BTN', 'vsraise', 2)
  assert(nOpen.length >= 1 && nVs.length >= 1, 'принципы префлопа генерируются')
  assert(nVs.some((s) => s.includes('колл')), 'в принципах vs-рейза упоминаются коллы')
}

if (failures === 0) {
  console.log('\nВСЕ ПРОВЕРКИ GTO ПРОЙДЕНЫ')
} else {
  console.error(`\nПровалено проверок: ${failures}`)
  process.exit(1)
}
