// Тест движка живой игры: целостность раздачи, сохранение стека, сайд-поты,
// две доски (у каждой свои карты), узловой режим, размеры рейзов.
import { LiveHand, MAX_BOTS, defaultRaiseTo, roundHalf, BB } from '../src/lib/poker/live'
import type { LiveGame } from '../src/lib/poker/live'

let failed = 0
function check(cond: boolean, name: string) {
  if (cond) {
    console.log(`  ${name} ✓`)
  } else {
    failed++
    console.error(`  ${name} ✗`)
  }
}

function eps(a: number, b: number, e = 0.01): boolean {
  return Math.abs(a - b) <= e
}

function playFullHand(game: LiveGame, bots: number): { ok: boolean; err?: string } {
  const hand = new LiveHand({ game, bots, mode: 'full' })
  try {
    let guard = 0
    while (!hand.snapshot().finished && guard++ < 2000) {
      hand.skipToDecision()
      const snap = hand.snapshot()
      if (snap.awaitingHero && snap.options) {
        const o = snap.options
        const r = Math.random()
        if (o.canCheck && r < 0.4) hand.heroAction('check')
        else if (o.canRaise && r < 0.25) hand.heroAction('raise')
        else if (o.canCall && r < 0.85) hand.heroAction('call')
        else if (o.canCheck) hand.heroAction('check')
        else hand.heroAction('fold')
      }
    }
    const snap = hand.snapshot()
    if (!snap.finished) return { ok: false, err: 'раздача не завершилась' }
    const total = snap.seats.reduce((a, s) => a + s.stack, 0)
    const expect = (bots + 1) * 100
    if (!eps(total, expect)) return { ok: false, err: `стеки: ${total} != ${expect}` }
    if (snap.seats.some((s) => s.stack < -0.001)) return { ok: false, err: 'отрицательный стек' }
    for (const d of snap.decisions) {
      if (!d.prompt || !d.reason || !d.best || !d.chosen) return { ok: false, err: 'пустое поле решения' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, err: String(e) }
  }
}

console.log('=== 1. Целостность раздачи (Hold\'em, 4 игрока) ===')
{
  const hand = new LiveHand({ game: 'holdem', bots: 3, mode: 'full' })
  const snap = hand.snapshot()
  const seats = snap.seats
  check(seats.length === 4, 'столов 4 места')
  check(seats.some((s) => s.isHero), 'герой за столом')
  check(seats[seats.length - 1].seat === 'BB' && seats[seats.length - 2].seat === 'SB', 'блайнды на местах SB/BB')
  const codes = seats.flatMap((s) => s.cards.map((c) => c.r + '-' + c.s))
  check(new Set(codes).size === codes.length, 'карты уникальны')
  check(eps(snap.pot, 1.5), `блайнды в банке (1.5), факт ${snap.pot}`)
  check(seats.every((s) => eps(s.stack, 100 - s.totalBet)), 'стеки уменьшились на блайнды')
}

console.log('=== 2. Кап оппонентов для Омахи 5-card × 2 доски ===')
{
  const hand = new LiveHand({ game: 'omaha5x2', bots: 8, mode: 'full' })
  check(hand.players === 8, `максимум 8 игроков (7 ботов), факт ${hand.players}`)
  check(MAX_BOTS.omaha5x2 === 7, 'MAX_BOTS.omaha5x2 = 7')
}

console.log('=== 3. Две доски — разные карты ===')
{
  // играем узловую раздачу до конца и проверяем доски
  const hand = new LiveHand({ game: 'omaha4x2', bots: 2, mode: 'node' })
  let guard = 0
  while (!hand.snapshot().finished && guard++ < 1500) {
    hand.skipToDecision()
    const s = hand.snapshot()
    if (s.awaitingHero && s.options) hand.heroAction(s.options.canCheck ? 'check' : 'call')
  }
  const snap = hand.snapshot()
  if (snap.dealtPerBoard === 5) {
    const a = snap.boards[0].map((c) => c.r + c.s).sort().join()
    const b = snap.boards[1].map((c) => c.r + c.s).sort().join()
    check(a !== b, 'доски получили разные карты')
    const all = [...snap.boards[0], ...snap.boards[1]]
    check(new Set(all.map((c) => c.r + '-' + c.s)).size === all.length, 'нет пересечений карт досок')
  } else {
    check(false, `доски не доиграны до ривера (сдано ${snap.dealtPerBoard})`)
  }
}

console.log('=== 4. Размеры рейзов по умолчанию ===')
{
  check(eps(defaultRaiseTo(1.5, 1, 1, true, 0), 2.5), `открытие 2.5, факт ${defaultRaiseTo(1.5, 1, 1, true, 0)}`)
  check(eps(defaultRaiseTo(4, 2.5, 1.5, true, 1), 7.5), `3бет 7.5, факт ${defaultRaiseTo(4, 2.5, 1.5, true, 1)}`)
  const bet4bet = defaultRaiseTo(10, 7.5, 5, true, 2)
  check(bet4bet >= 7.5 + 5, `4бет не ниже минимального (${bet4bet})`)
  const postBet = defaultRaiseTo(10, 0, 1, false, 0)
  check(eps(postBet, roundHalf(10 * 0.66)), `постфлоп-бет 0.66 банка (${postBet})`)
  const postRaise = defaultRaiseTo(10, 5, 1, false, 1)
  check(postRaise >= 5 + Math.max(1, 5), `постфлоп-рейз >= ставка + полбанка (${postRaise})`)
  check(eps(BB, 1), 'BB = 1')
}

console.log('=== 5. Соак: полные раздачи (инварианты банка) ===')
{
  const games: LiveGame[] = ['holdem', 'omaha4', 'omaha4x2', 'omaha5x2']
  const perGame = 100
  for (const game of games) {
    let bad = 0
    let worst = ''
    const t0 = Date.now()
    for (let k = 0; k < perGame; k++) {
      const bots = 1 + Math.floor(Math.random() * MAX_BOTS[game])
      const r = playFullHand(game, bots)
      if (!r.ok) {
        bad++
        if (!worst) worst = `${game} bots=${bots}: ${r.err}`
      }
    }
    check(bad === 0, `${game}: ${perGame} раздач без ошибок (${Date.now() - t0}мс)${bad ? ' — ' + worst : ''}`)
  }
}

console.log('=== 6. Соак: узловой режим (одно решение) ===')
{
  const games: LiveGame[] = ['holdem', 'omaha4', 'omaha4x2', 'omaha5x2']
  let bad = 0
  let decisionsSeen = 0
  for (const game of games) {
    for (let k = 0; k < 25; k++) {
      try {
        const hand = new LiveHand({ game, bots: 1 + Math.floor(Math.random() * 4), mode: 'node' })
        let guard = 0
        while (!hand.snapshot().finished && guard++ < 1500) {
          hand.skipToDecision()
          const snap = hand.snapshot()
          if (snap.awaitingHero && snap.options) hand.heroAction(Math.random() < 0.5 && snap.options.canCall ? 'call' : 'check')
        }
        const snap = hand.snapshot()
        if (!snap.finished) throw new Error('не завершилась')
        if (snap.decisions.length > 1) throw new Error(`решений ${snap.decisions.length} > 1`)
        decisionsSeen += snap.decisions.length
        const total = snap.seats.reduce((a, s) => a + s.stack, 0)
        if (!eps(total, hand.players * 100)) throw new Error(`стеки ${total}`)
      } catch (e) {
        bad++
        if (bad <= 2) console.error(`  ${game}: ${String(e)}`)
      }
    }
  }
  check(bad === 0, `узловой режим: 100 раздач, ${decisionsSeen} решений без ошибок${bad ? '' : ''}`)
}

console.log('=== 7. Статистика грейдинга героя (санити) ===')
{
  // герой играет все узлы случайно — доля верных должна быть заметно выше нуля,
  // верное действие всегда вычисляется
  let total = 0
  let correct = 0
  for (let k = 0; k < 40; k++) {
    const game: LiveGame = ['holdem', 'omaha4'][k % 2]
    const hand = new LiveHand({ game, bots: 2, mode: 'full' })
    let guard = 0
    while (!hand.snapshot().finished && guard++ < 1500) {
      hand.skipToDecision()
      const snap = hand.snapshot()
      if (snap.awaitingHero && snap.options) hand.heroAction('call')
    }
    for (const d of hand.snapshot().decisions) {
      total++
      if (d.correct) correct++
    }
  }
  check(total > 30, `решений собрано: ${total}`)
  console.log(`  всегда-колл верен в ${correct}/${total} случаев (информативно, не проверка)`)
}

console.log(failed === 0 ? '\nOK: движок живой игры работает' : `\nПРОВАЛОВ: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
