// Проверка GTO-чартов: позиции, отдельные чарты под каждый размер стола,
// позиционная защита против рейза, постфлоп-план (текстура, сайзинги, частоты, границы)
import { parseCard, Card } from '../src/lib/poker/cards'
import {
  seatsForTable, basePos, holdemPreflop, holdemAction,
  omahaPreflop, omahaAction, omahaActionFreqs, postflopPlan, preflopNotes, multiwayNote,
  analyzeBoardTexture,
} from '../src/lib/poker/gto'
import { openPercentFor, vsRaiseCharts, validRaisersFor, holdemActionFrequencies, freqAggregate, dominantAction, secondaryAction, mixExamples, isMixed } from '../src/lib/poker/ranges'
import { isSimActionCorrect } from '../src/lib/poker/training'

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
const betFreqOf = (t: { mix: Array<{ action: string; freq: number }> }) => t.mix.find((m) => m.action === 'bet')?.freq ?? 0
const sizeOf = (note: string) => Number(/(\d+)%/.exec(note)?.[1] ?? 0)

// 1. Позиции по размеру стола
{
  const s2 = seatsForTable(2)
  const s6 = seatsForTable(6)
  const s9 = seatsForTable(9)
  assert(s2.length === 2 && s2[0] === 'BTN' && s2[1] === 'BB', `хедз-ап: ${s2.join(', ')}`)
  assert(s6.length === 6 && s6[3] === 'BTN', `6-max: ${s6.join(', ')}`)
  assert(s9.length === 9 && s9[6] === 'BTN' && s9[5] === 'CO', `9-max: ${s9.join(', ')}`)
  assert(basePos('MP2') === 'MP' && basePos('HJ') === 'MP' && basePos('UTG1') === 'UTG' && basePos('BTN') === 'BTN', 'basePos корректно маппится')
  for (const n of [3, 4, 5, 7, 8]) {
    assert(seatsForTable(n).length === n, `${n}-max: ${seatsForTable(n).length} мест`)
  }
}

// 2. Отдельные чарты открытия: монотонность по размерам стола 2..9
{
  for (const pos of ['UTG', 'MP', 'CO', 'BTN', 'SB'] as const) {
    const pcts = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => openPercentFor(pos, n))
    let monotonic = true
    for (let i = 1; i < pcts.length; i++) if (pcts[i] >= pcts[i - 1]) monotonic = false
    assert(monotonic, `${pos}: открытие сужается с ростом стола (${pcts.map((p) => p.toFixed(0)).join(' → ')})`)
  }
  assert(holdemPreflop('BTN', 2, 'open', 0).raisePct >= 70, 'HU: BTN открывается шире 70%')
  assert(holdemPreflop('BTN', 9, 'open', 0).raisePct < holdemPreflop('BTN', 6, 'open', 0).raisePct, '9-max BTN тайтовее 6-max')
  assert(holdemPreflop('UTG', 9, 'open', 0).raisePct < holdemPreflop('UTG', 6, 'open', 0).raisePct, '9-max UTG тайтовее 6-max')
  assert(holdemPreflop('MP', 6, 'open', 0).raisePct > holdemPreflop('UTG', 6, 'open', 0).raisePct, 'UTG тайтовее MP')
  assert(holdemPreflop('CO', 6, 'open', 0).raisePct > holdemPreflop('MP', 6, 'open', 0).raisePct, 'MP тайтовее CO')
}

// 3. Холдем: конкретные руки на открытии
{
  const utg = holdemPreflop('UTG', 6, 'open', 0)
  assert(holdemAction('AA', utg) === 'raise', 'AA с UTG — рейз')
  assert(holdemAction('AKs', utg) === 'raise', 'AKs с UTG — рейз')
  assert(holdemAction('72o', utg) === 'fold', '72o с UTG — фолд')
  const btn = holdemPreflop('BTN', 6, 'open', 0)
  assert(holdemAction('K2s', btn) === 'raise', 'K2s с BTN — рейз')
  assert(holdemAction('32o', btn) === 'fold', '32o с BTN — фолд')
  assert(holdemAction('KTo', btn) === 'raise', 'KTo с BTN — рейз (широкий чарт баттона)')
}

// 4. Защита против рейза: позиция рейзера имеет значение
{
  const vsUTG = holdemPreflop('BB', 6, 'vsraise', 0, 'UTG')
  const vsCO = holdemPreflop('BB', 6, 'vsraise', 0, 'CO')
  const vsBTN = holdemPreflop('BB', 6, 'vsraise', 0, 'BTN')
  const vsSB = holdemPreflop('BB', 6, 'vsraise', 0, 'SB')
  console.log(
    `BB против рейзера: колл UTG ${vsUTG.callPct.toFixed(1)}% → CO ${vsCO.callPct.toFixed(1)}% → BTN ${vsBTN.callPct.toFixed(1)}% → SB ${vsSB.callPct.toFixed(1)}%`,
  )
  assert(vsBTN.callPct >= 1.5 * vsUTG.callPct, 'BB против BTN коллит в ≥1.5 раза шире, чем против UTG')
  assert(vsSB.callPct > vsBTN.callPct, 'BB против SB коллит шире, чем против BTN')
  assert(holdemAction('AA', vsUTG) === 'raise', 'AA против рейза — 3бет')
  assert(holdemAction('76s', vsUTG) === 'call', '76s против рейза с BB — колл')
  assert(holdemAction('32o', vsUTG) === 'fold', '32o против рейза — фолд')
  assert(vsBTN.raise.has('A2s') && !vsUTG.raise.has('A2s'), 'A2s — блеф-3бет против BTN, но не против UTG')
  assert(vsSB.raisePct > vsUTG.raisePct, '3бет BB против SB шире, чем против UTG')
  assert(holdemAction('KTo', vsBTN) === 'call' && holdemAction('KTo', vsUTG) === 'fold', 'KTo: колл против BTN, фолд против UTG')
  assert(vsRaiseCharts('MP', 'BTN', 6) === null, 'MP не может защищаться против открытия BTN (недопустимая пара)')
  const vsMulti = holdemPreflop('BB', 6, 'vsraise', 3, 'CO')
  assert(vsMulti.callPct < vsCO.callPct, 'в мультпоте колл-диапазон уже')
  assert(vsRaiseCharts('BB', 'BTN', 2)!.callPct > vsBTN.callPct, 'HU: защита BB шире, чем 6-max')
  // UTG против UTG1 (9-max)
  const utgVs = holdemPreflop('UTG', 9, 'vsraise', 0, 'UTG')
  assert(holdemAction('AA', utgVs) === 'raise' && holdemAction('72o', utgVs) === 'fold', 'UTG против UTG1: AA — 3бет, мусор — фолд')
  // Регрессия ATs: сильные руки не должны фолдить против рейза ни в одном сочетании защитник × рейзер
  const strongHands = ['AQs', 'AJs', 'ATs', 'JJ', 'TT', '99', '88']
  for (const def of ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'] as const) {
    for (const raiser of validRaisersFor(def)) {
      const chart = holdemPreflop(def, 6, 'vsraise', 0, raiser)
      if (!chart.call.size && !chart.raise.size) continue
      for (const cls of strongHands) {
        assert(holdemAction(cls, chart) !== 'fold', `${cls} не фолдит: ${def} против ${raiser}`)
      }
    }
  }
  assert(holdemAction('ATs', vsUTG) === 'call', 'ATs против UTG — колл')
  assert(holdemAction('ATs', vsBTN) === 'call', 'ATs против BTN — колл')
  assert(holdemAction('ATs', holdemPreflop('BB', 2, 'vsraise', 0, 'BTN')) === 'call', 'ATs на HU против BTN — колл')
  assert(holdemAction('AJs', vsUTG) === 'call', 'AJs против UTG — колл')
  assert(holdemAction('AQs', vsBTN) === 'raise', 'AQs против BTN — 3бет')
  assert(holdemAction('AQs', vsUTG) === 'call', 'AQs против UTG — колл')
}

// 4b. Частотные смеси (как в GTO-солвере)
{
  const bbUtg = holdemActionFrequencies('BB', 'UTG', 6)
  const qq = bbUtg?.get('QQ')
  assert(!!qq && qq.raise === 55 && qq.call === 45 && qq.fold === 0, `QQ против UTG (BB): микс 55/45 (${qq?.raise}/${qq?.call}/${qq?.fold})`)
  const ats = bbUtg?.get('ATs')
  assert(!!ats && ats.call >= 80 && ats.raise > 0 && ats.raise < 50, `ATs против UTG (BB): колл-доминантный микс (${ats?.raise}/${ats?.call})`)
  const ajo = bbUtg?.get('AJo')
  assert(!!ajo && ajo.call > 0 && ajo.fold > 0 && ajo.raise === 0, `AJo против UTG (BB): микс колл/фолд (${ajo?.call}/${ajo?.fold})`)
  // суммы частот = 100 во всех допустимых парах защитник × рейзер и размерах стола
  let badSum = 0
  let mixedFound = 0
  for (const def of ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'] as const) {
    for (const r of validRaisersFor(def)) {
      for (const n of [2, 6, 9]) {
        const m = holdemActionFrequencies(def, r, n)
        if (!m) continue
        for (const [, f] of m) {
          if (f.raise + f.call + f.fold !== 100) badSum++
          if (isMixed(f)) mixedFound++
        }
      }
    }
  }
  assert(badSum === 0, 'суммы частот = 100 во всех парах и размерах стола')
  assert(mixedFound > 100, `смешанные руки реально присутствуют в чартах (${mixedFound} миксов)`)
  // агрегат: соотношение 3бет/колл/фолд по диапазону
  const agg = freqAggregate(holdemActionFrequencies('BB', 'BTN', 6)!)
  assert(Math.abs(agg.raise + agg.call + agg.fold - 100) < 0.2, `агрегат BB vs BTN: сумма ~100 (${agg.raise}/${agg.call}/${agg.fold})`)
  assert(agg.raise >= 3 && agg.call > 15 && agg.fold > 55, 'агрегат BB vs BTN: реалистичные доли (3бет ≥3%, колл >15%, фолд >55%)')
  assert(agg.call > freqAggregate(holdemActionFrequencies('BB', 'UTG', 6)!).call, 'агрегат: колл против BTN шире, чем против UTG')
  // микс-примеры: только действительно смешанные руки
  const ex = mixExamples(holdemActionFrequencies('BB', 'UTG', 6)!, 3)
  assert(ex.length >= 2 && ex.every((e) => isMixed(e.f)), `микс-примеры: только смешанные руки (${ex.map((e) => e.cls).join(', ')})`)
  // доминантное и альтернативное действие
  assert(dominantAction({ raise: 55, call: 45, fold: 0 }) === 'raise', 'доминанта 55/45 → рейз')
  assert(dominantAction({ raise: 20, call: 80, fold: 0 }) === 'call', 'доминанта 20/80 → колл')
  const sec = secondaryAction({ raise: 55, call: 45, fold: 0 }, 25)
  assert(sec?.action === 'call' && sec.freq === 45, 'альтернатива 55/45 → колл 45%')
  assert(secondaryAction({ raise: 100, call: 0, fold: 0 }, 25) === null, 'чистый рейз — без альтернативы')
  const sec2 = secondaryAction({ raise: 40, call: 30, fold: 30 }, 25)
  assert(sec2?.action === 'call' && sec2.freq === 30, 'тройной микс: альтернатива — колл 30%')
  // засчитывание микс-альтернативы в симуляторе
  assert(isSimActionCorrect({ correctAction: 'raise', altAction: 'call' }, 'call'), 'микс-альтернатива засчитывается')
  assert(!isSimActionCorrect({ correctAction: 'raise', altAction: 'call' }, 'fold'), 'не-альтернатива не засчитывается')
  assert(!isSimActionCorrect({ correctAction: 'raise' }, 'call'), 'без альтернативы — только основное действие')

  // Омаха: плавные смеси у границ
  const oChart = omahaPreflop('omaha4', 'BB', 6, 'vsraise', 0, 'UTG')
  const strong = omahaActionFreqs('omaha4', hand(['Ah', 'Ad', 'Kh', 'Qd']), oChart, 'vsraise')
  assert(strong.raise === 100 && strong.call === 0, `AAKQ ds: чистый 3бет (${strong.raise}/${strong.call}/${strong.fold})`)
  const mid = omahaActionFreqs('omaha4', hand(['Kh', 'Qh', 'Jd', '9d']), oChart, 'vsraise')
  assert(mid.raise + mid.call + mid.fold === 100 && mid.fold === 0, `KQJ9 ds: сумма 100, без фолда (${mid.raise}/${mid.call}/${mid.fold})`)
  const trash = omahaActionFreqs('omaha4', hand(['9h', '8d', '6c', '4s']), oChart, 'vsraise')
  assert(trash.fold >= 50, `слабая рука: фолд-доминанта (${trash.fold}% фолд)`)
  // монотонность: чем сильнее рука, тем выше частота рейза
  const eq1 = omahaActionFreqs('omaha4', hand(['Ah', 'Ad', 'Kh', 'Qd']), oChart, 'vsraise').raise
  const eq2 = omahaActionFreqs('omaha4', hand(['Kh', 'Qh', 'Jd', '9d']), oChart, 'vsraise').raise
  assert(eq1 >= eq2, 'сильнейшая рука — не меньшая частота рейза')
}

// 5. Омаха: размеры стола и позиционность защиты
{
  const chart = omahaPreflop('omaha4', 'UTG', 6, 'open', 0)
  const btn = omahaPreflop('omaha4', 'BTN', 6, 'open', 0)
  console.log(`omaha4 open: UTG 6-max ${chart.openPercent.toFixed(0)}%, BTN 6-max ${btn.openPercent.toFixed(0)}%, BTN HU ${omahaPreflop('omaha4', 'BTN', 2, 'open', 0).openPercent.toFixed(0)}%`)
  assert(chart.openPercent < btn.openPercent, 'открытие UTG в Омахе тайтовее BTN')
  assert(omahaPreflop('omaha4', 'BTN', 2, 'open', 0).openPercent > btn.openPercent, 'PLO4: открытие BTN на HU шире 6-max')
  assert(omahaPreflop('omaha4', 'UTG', 9, 'open', 0).openPercent < chart.openPercent, 'PLO4: открытие UTG на 9-max тайтовее 6-max')

  const aakq = hand(['Ah', 'Ad', 'Kh', 'Qd'])
  const weak = hand(['2c', '3d', '7h', '9s'])
  assert(omahaAction('omaha4', aakq, chart, 'open') === 'raise', 'AAKQ ds с UTG — рейз')
  assert(omahaAction('omaha4', weak, chart, 'open') === 'fold', 'мусор с UTG — фолд')

  const vsUTG = omahaPreflop('omaha4', 'BB', 6, 'vsraise', 0, 'UTG')
  const vsBTN = omahaPreflop('omaha4', 'BB', 6, 'vsraise', 0, 'BTN')
  console.log(`omaha4 BB vs рейзер: колл UTG ${vsUTG.callPercent.toFixed(0)}%, BTN ${vsBTN.callPercent.toFixed(0)}%`)
  assert(vsBTN.callPercent >= 1.5 * vsUTG.callPercent, 'PLO4: BB против BTN коллит в ≥1.5 раза шире, чем против UTG')
  assert(omahaAction('omaha4', aakq, vsBTN, 'vsraise') === 'raise', 'AAKQ ds против рейза — 3бет')
  const mid = hand(['Kh', 'Qh', 'Jd', '9d'])
  const midAction = omahaAction('omaha4', mid, vsBTN, 'vsraise')
  assert(midAction === 'call' || midAction === 'raise', `KQJ9 ds против рейза — колл/3бет (${midAction})`)
  assert(omahaAction('omaha4', weak, vsBTN, 'vsraise') === 'fold', 'мусор против рейза — фолд')

  const p5 = omahaPreflop('omaha5', 'UTG', 6, 'open', 0)
  assert(p5.openPercent > chart.openPercent, 'PLO5 открывается шире PLO4')
}

// 6. Постфлоп-план: текстура, сайзинги, частоты, границы
{
  const boardDry = ['9h', '4s', '2d'].map(pc)
  const boardMono = ['8h', '5h', '2h'].map(pc)
  const boardPaired = ['Ks', 'Kd', '7c'].map(pc)

  const g = postflopPlan('holdem', 'flop', boardDry, 1, 'BTN', null)
  assert(g.tiers.length >= 4, `постфлоп-план: ${g.tiers.length} уровней силы`)
  assert(g.textureLabel.includes('радуга'), 'текстура распознана: радуга')
  for (const t of g.tiers) {
    const sum = t.mix.reduce((a, m) => a + m.freq, 0)
    assert(sum === 100, `${t.tier}: частоты суммируются в 100 (получено ${sum})`)
  }

  // сайзинг зависит от текстуры: на моно/спаренной доске ставки мельче
  const gm = postflopPlan('holdem', 'flop', boardMono, 1, 'BTN', null)
  const gp = postflopPlan('holdem', 'flop', boardPaired, 1, 'BTN', null)
  const dry = sizeOf(g.tiers[0].sizeNote)
  const mono = sizeOf(gm.tiers[0].sizeNote)
  const paired = sizeOf(gp.tiers[0].sizeNote)
  console.log(`сайзинг натсов: сухая ${dry}%, моно ${mono}%, спаренная ${paired}%`)
  assert(mono < dry && mono <= 50, 'моно-доска: натс-бет мельче и не крупнее 50%')
  assert(paired < dry && paired <= 40, 'спаренная доска: натс-бет мельче и не крупнее 40%')

  // частота блефа: сухая доска — больше, моно — меньше
  const airDry = g.tiers.find((t) => t.tier === 'Воздух')!
  const airMono = gm.tiers.find((t) => t.tier === 'Воздух')!
  assert(betFreqOf(airDry) > betFreqOf(airMono), `сухая доска: блефов больше (${betFreqOf(airDry)}% > ${betFreqOf(airMono)}%)`)

  // вердикты против ставок заданного размера
  const gFacing66 = postflopPlan('holdem', 'flop', boardDry, 1, 'BTN', 66)
  const mid66 = gFacing66.tiers.find((t) => t.tier === 'Средние руки')!
  assert(mid66.verdict?.verdict === 'fold', 'средние руки: фолд против ставки 66% банка')
  const gFacing33 = postflopPlan('holdem', 'flop', boardDry, 1, 'BTN', 33)
  const mid33 = gFacing33.tiers.find((t) => t.tier === 'Средние руки')!
  assert(mid33.verdict?.verdict === 'call', 'средние руки: колл против ставки 33% банка')
  assert(gFacing66.tiers[0].verdict?.verdict === 'raise', 'натсы: рейз против любой ставки')
  const air100 = postflopPlan('holdem', 'flop', boardDry, 1, 'BTN', 100).tiers.find((t) => t.tier === 'Воздух')!
  assert(air100.verdict?.verdict === 'fold', 'воздух: фолд против крупной ставки')

  // мультпот: блефы реже, границы ниже
  const gMulti = postflopPlan('holdem', 'flop', boardDry, 4, 'BTN', null)
  const airMulti = gMulti.tiers.find((t) => t.tier === 'Воздух')!
  assert(betFreqOf(airMulti) < betFreqOf(airDry), 'мультпот: блефов меньше')

  // омаха: план и примечания
  const go = postflopPlan('omaha4', 'flop', boardDry, 2, 'BB', 100)
  assert(go.tiers.length >= 4, 'омаха: план построен')
  assert(go.positionNote.includes('без позиции'), 'примечание о позиции (BB — OOP)')
  assert(!!go.facingLabel?.includes('100'), 'сценарий ставки отображается')

  // анализ текстуры
  assert(analyzeBoardTexture(boardMono).monotone, 'моно-масть распознана')
  assert(analyzeBoardTexture(boardPaired).paired, 'спаренность распознана')
  assert(analyzeBoardTexture(['Kd', '9d', '4c'].map(pc)).twoTone, 'двухмастность распознана')
  assert(analyzeBoardTexture(['Qs', 'Js', 'Td'].map(pc)).straightPossible, 'стрит-возможность распознана')
  assert(analyzeBoardTexture([]).empty, 'пустая доска — нейтральная текстура')
  assert(multiwayNote(1).includes('одного'), 'хедз-ап примечание')
}

// 7. Принципы префлопа
{
  const nOpen = preflopNotes('holdem', 'UTG', 'open', 0, undefined, 6)
  const nVs = preflopNotes('omaha4', 'BTN', 'vsraise', 2, 'CO', 6)
  assert(nOpen.length >= 2 && nVs.length >= 2, 'принципы префлопа генерируются')
  assert(nOpen.some((s) => s.includes('6-max')), 'в принципах открытия указан размер стола')
  assert(nOpen.some((s) => s.includes('открытие с UTG')), 'в принципах указана ширина открытия')
  assert(nVs.some((s) => s.includes('колл')), 'в принципах vs-рейза упоминаются коллы')
  assert(nVs.some((s) => s.includes('CO')), 'в принципах vs-рейза указан рейзер')
}

if (failures === 0) {
  console.log('\nВСЕ ПРОВЕРКИ GTO ПРОЙДЕНЫ')
} else {
  console.error(`\nПровалено проверок: ${failures}`)
  process.exit(1)
}
