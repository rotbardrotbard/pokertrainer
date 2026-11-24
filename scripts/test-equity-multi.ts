// Проверка мультиигрового мультиоппонентского Monte-Carlo (Холдем + Омаха, 1–8 оппонентов, диапазоны)
import { parseCard, Card } from '../src/lib/poker/cards'
import { simulateEquity, recommendedIterations } from '../src/lib/poker/equity'
import { handInRange, omahaRangeThreshold, ploRangeScore, omahaRangeComposition } from '../src/lib/poker/handRanges'

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
const eq = (r: { win: number; tie: number }) => r.win + r.tie / 2

// 1. Непобедимые руки против 8 оппонентов = 100%
{
  const r = simulateEquity({
    game: 'omaha4',
    hero: [pc('Ah'), pc('Kh'), pc('Qh'), pc('Jh')],
    board: [pc('Th'), pc('9h'), pc('8h'), pc('2c'), pc('3d')],
    opponents: 8,
    iterations: 400,
  })
  assert(Math.abs(eq(r) - 1) < 1e-9, `omaha4 королевский флеш vs 8 = 100%, получено ${(eq(r) * 100).toFixed(1)}%`)
}
{
  // настоящий натс: королевский флеш = AsKs в руке + QsJsTs на доске
  const r2 = simulateEquity({
    game: 'omaha5',
    hero: [pc('As'), pc('Ks'), pc('Qd'), pc('Jd'), pc('2c')],
    board: [pc('Qs'), pc('Js'), pc('Ts'), pc('3d'), pc('8c')],
    opponents: 8,
    iterations: 400,
  })
  assert(Math.abs(r2.win + r2.tie / 2 - 1) < 1e-9, `omaha5 королевский флеш vs 8 = 100%, получено ${((r2.win + r2.tie / 2) * 100).toFixed(1)}%`)
}
{
  const r = simulateEquity({
    game: 'holdem',
    hero: [pc('As'), pc('Ks')],
    board: [pc('Qs'), pc('Js'), pc('Ts'), pc('2c'), pc('3d')],
    opponents: 8,
    iterations: 300,
  })
  assert(Math.abs(eq(r) - 1) < 1e-9, `holdem королевский флеш vs 8 = 100%, получено ${(eq(r) * 100).toFixed(1)}%`)
}

// 2. Монотонность по числу оппонентов (AA префлоп)
{
  const e1 = eq(simulateEquity({ hero: [pc('As'), pc('Ad')], board: [], opponents: 1, iterations: 8000 }))
  const e4 = eq(simulateEquity({ hero: [pc('As'), pc('Ad')], board: [], opponents: 4, iterations: 8000 }))
  const e8 = eq(simulateEquity({ hero: [pc('As'), pc('Ad')], board: [], opponents: 8, iterations: 8000 }))
  console.log(`AA holdem: vs1 ${e1.toFixed(3)}, vs4 ${e4.toFixed(3)}, vs8 ${e8.toFixed(3)}`)
  assert(e1 > e4 && e4 > e8, 'эквити падает с ростом числа оппонентов')
  assert(e8 > 0.14 && e8 < 0.4, `AA vs 8 разумно, получено ${e8.toFixed(3)}`)
}

// 3. Омаха: монотонность и разумность
{
  const hero = [pc('Ah'), pc('Kh'), pc('Qd'), pc('Jd')]
  const e1 = eq(simulateEquity({ game: 'omaha4', hero, board: [], opponents: 1, iterations: 3000 }))
  const e8 = eq(simulateEquity({ game: 'omaha4', hero, board: [], opponents: 8, iterations: 3000 }))
  console.log(`A high ds omaha4: vs1 ${e1.toFixed(3)}, vs8 ${e8.toFixed(3)}`)
  assert(e1 > e8, 'omaha4: vs1 > vs8')
  assert(e8 > 0.1 && e8 < 0.5, `omaha4 AA-рука vs 8 разумно, получено ${e8.toFixed(3)}`)
}

// 4. Диапазоны: против премиум-диапазона эквити сильной руки ниже, чем против случайных
{
  const hero = [pc('Ah'), pc('Kh'), pc('Qd'), pc('Jd')]
  const vsRandom = eq(simulateEquity({ game: 'omaha4', hero, board: [], opponents: 1, iterations: 3000 }))
  const vsPremium = eq(simulateEquity({
    game: 'omaha4', hero, board: [], opponents: 1, iterations: 3000,
    villainFilter: (h) => handInRange('omaha4', h, 8),
  }))
  console.log(`omaha4 A ds: vs random ${vsRandom.toFixed(3)}, vs premium(8%) ${vsPremium.toFixed(3)}`)
  assert(vsPremium < vsRandom - 0.05, 'против премиум-диапазона эквити ниже, чем против случайных')

  const h = [pc('As'), pc('Ad')]
  const hRandom = eq(simulateEquity({ hero: h, board: [], opponents: 1, iterations: 8000 }))
  const hPremium = eq(simulateEquity({
    hero: h, board: [], opponents: 1, iterations: 8000,
    villainFilter: (x) => handInRange('holdem', x, 10),
  }))
  console.log(`holdem AA: vs random ${hRandom.toFixed(3)}, vs top10% ${hPremium.toFixed(3)}`)
  assert(hPremium < hRandom, 'holdem: против топ-диапазона эквити AA ниже')
}

// 5. Калибровка порогов Омахи: доля случайных рук в «топ N%» ≈ N
{
  for (const pct of [5, 15, 30, 50]) {
    const th = omahaRangeThreshold('omaha4', pct)
    let pass = 0
    const N = 20000
    let seed = 555
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < N; i++) {
      const idx: number[] = []
      while (idx.length < 4) {
        const v = Math.floor(rnd() * 52)
        if (idx.indexOf(v) < 0) idx.push(v)
      }
      const hand = idx.map((v) => ({ r: (v % 13) + 2, s: Math.floor(v / 13) }))
      if (ploRangeScore(hand) >= th) pass++
    }
    const frac = (pass / N) * 100
    console.log(`omaha4 порог ${pct}%: фактическая доля ${frac.toFixed(1)}% (порог ${th.toFixed(1)})`)
    assert(Math.abs(frac - pct) < 2, `калибровка ${pct}% в пределах ±2 п.п.`)
  }
}

// 6. Композиция диапазона Омахи (для GTO) считается и в разумных пределах
{
  const comp = omahaRangeComposition('omaha4', 20, 2000)
  const aces = comp.find((c) => c.label === 'с тузом')!
  const ds = comp.find((c) => c.label === 'двойномастные')!
  const runs = comp.filter((c) => c.label.startsWith('связка')).reduce((a, c) => a + c.pct, 0)
  console.log(`omaha4 топ-20%: с тузом ${aces.pct}%, двойномастные ${ds.pct}%, связки ${runs}%`)
  assert(aces.pct > 25, `в топ-20% заметная доля рук с тузом (${aces.pct}%)`)
  assert(ds.pct >= 18, `в топ-20% существенная доля двойномастных (${ds.pct}%)`)
  assert(runs >= 15, `в топ-20% заметная доля связок (${runs}%)`)
}

// 7. Мультвей с диапазонами у 8 оппонентов: валидность + производительность
{
  const hero = [pc('Ah'), pc('Kh'), pc('Qd'), pc('Jd')]
  const iters = recommendedIterations('omaha4', 8)
  const t0 = Date.now()
  const r = simulateEquity({
    game: 'omaha4', hero, board: [pc('Th'), pc('6s'), pc('2d')],
    opponents: 8, iterations: iters,
    villainFilter: (x) => handInRange('omaha4', x, 25),
  })
  const dt = Date.now() - t0
  console.log(`omaha4 vs 8 (топ-25%, ${iters} итераций): ${(eq(r) * 100).toFixed(1)}% за ${dt} мс`)
  assert(Math.abs(r.win + r.tie + r.lose - 1) < 1e-9, 'вероятности суммируются в 1')
  assert(!isNaN(eq(r)), 'нет NaN')
  assert(dt < 5000, `производительность omaha4 8 оппонентов с диапазоном (${dt} мс)`)
}

// 8. omaha5 river 8 оппонентов без NaN
{
  const r = simulateEquity({
    game: 'omaha5',
    hero: [pc('Ah'), pc('Kh'), pc('Qh'), pc('Jd'), pc('Jc')],
    board: [pc('Th'), pc('6h'), pc('2s'), pc('9c'), pc('4d')],
    opponents: 8,
    iterations: 2000,
  })
  assert(Math.abs(r.win + r.tie + r.lose - 1) < 1e-9, `omaha5 river vs 8: сумма 1, эквити ${(eq(r) * 100).toFixed(1)}%`)
}

// 9. Обратная совместимость: старый вызов без game (Холдем) + villainFilter
{
  const r = simulateEquity({
    hero: [pc('Ah'), pc('Kh')],
    board: [pc('Qh'), pc('Jh'), pc('2s')],
    opponents: 1,
    iterations: 2000,
    villainFilter: (x) => handInRange('holdem', x, 30),
  })
  assert(Math.abs(r.win + r.tie + r.lose - 1) < 1e-9, 'старый API работает')
  assert(eq(r) > 0.35, `стрит+флеш-дро vs топ-30% имеет высокое эквити, получено ${eq(r).toFixed(3)}`)
}

// 10. Фиксированный оппонент (villainCards) по-прежнему работает
{
  const r = simulateEquity({
    game: 'holdem',
    hero: [pc('As'), pc('Ad')],
    board: [],
    opponents: 1,
    iterations: 3000,
    villainCards: [pc('Kh'), pc('Qh')],
  })
  console.log(`AA vs KQs: ${(eq(r) * 100).toFixed(1)}%`)
  assert(eq(r) > 0.78 && eq(r) < 0.86, `AA vs KQs ≈ 82%, получено ${(eq(r) * 100).toFixed(1)}%`)
}

if (failures === 0) {
  console.log('\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
} else {
  console.error(`\nПровалено проверок: ${failures}`)
  process.exit(1)
}
