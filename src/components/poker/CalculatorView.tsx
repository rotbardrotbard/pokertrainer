'use client'

// Калькулятор эквити: Холдем и Омаха (4/5 карт), 1–8 оппонентов,
// конкретный оппонент или диапазоны (индивидуально для каждого оппонента).
import { useMemo, useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrainerShell, ScenarioCard } from './TrainerShell'
import { PlayingCard, CardRow } from './PlayingCard'
import { SUIT_SYMBOLS, RANK_CHARS } from '@/lib/poker/cards'
import type { Card as PokerCard } from '@/lib/poker/cards'
import { simulateEquity, recommendedIterations } from '@/lib/poker/equity'
import { evaluate7, handCategoryName } from '@/lib/poker/evaluator'
import { bestOmahaHand } from '@/lib/poker/omaha'
import { GAME_NAMES_RU, HOLE_COUNT, RANGE_PRESETS, presetById, rangeFilter } from '@/lib/poker/handRanges'
import type { GameKind } from '@/lib/poker/handRanges'
import { cn } from '@/lib/utils'

type SlotId = 'hero0' | 'hero1' | 'hero2' | 'hero3' | 'hero4' | 'vil0' | 'vil1' | 'vil2' | 'vil3' | 'vil4' | 'b0' | 'b1' | 'b2' | 'b3' | 'b4'

const GAMES: GameKind[] = ['holdem', 'omaha4', 'omaha5']

function heroSlots(game: GameKind): SlotId[] {
  return Array.from({ length: HOLE_COUNT[game] }, (_, i) => `hero${i}` as SlotId)
}
function vilSlots(game: GameKind): SlotId[] {
  return Array.from({ length: HOLE_COUNT[game] }, (_, i) => `vil${i}` as SlotId)
}
const BOARD_SLOTS: SlotId[] = ['b0', 'b1', 'b2', 'b3', 'b4']

interface SimState {
  running: boolean
  progress: number
  result: { win: number; tie: number; lose: number; heroCats: number[]; iterations: number } | null
}

export function CalculatorView({ onBack }: { onBack: () => void }) {
  const [game, setGame] = useState<GameKind>('holdem')
  const [cards, setCards] = useState<Partial<Record<SlotId, PokerCard>>>({})
  const [activeSlot, setActiveSlot] = useState<SlotId | null>('hero0')
  const [opponents, setOpponents] = useState(1)
  const [ranges, setRanges] = useState<Record<number, string>>({})
  const [sim, setSim] = useState<SimState>({ running: false, progress: 0, result: null })
  const cancelRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hc = HOLE_COUNT[game]

  useEffect(() => () => {
    cancelRef.current = true
    if (timersRef.current) clearTimeout(timersRef.current)
  }, [])

  function changeGame(g: GameKind) {
    setGame(g)
    setCards({})
    setActiveSlot('hero0')
    setSim({ running: false, progress: 0, result: null })
  }

  const usedCodes = useMemo(() => {
    const set = new Set<string>()
    for (const c of Object.values(cards)) if (c) set.add(RANK_CHARS[c.r - 2] + 'shdc'[c.s])
    return set
  }, [cards])

  const SUITS_VIEW = [0, 1, 2, 3]

  function pickCard(c: PokerCard) {
    if (!activeSlot) return
    const code = RANK_CHARS[c.r - 2] + 'shdc'[c.s]
    // карта уже стоит в другом слоте — не ставить
    if (usedCodes.has(code)) return
    setCards((prev) => ({ ...prev, [activeSlot]: c }))
    // автоматически перейти к следующему пустому слоту (порядок как на экране)
    const order: SlotId[] = [...heroSlots(game), ...(opponents === 1 ? vilSlots(game) : []), ...BOARD_SLOTS]
    const idx = order.indexOf(activeSlot)
    const next = order.slice(idx + 1).find((s) => !cards[s]) ?? null
    setActiveSlot(next)
  }

  function clearSlot(s: SlotId) {
    setCards((prev) => {
      const next = { ...prev }
      delete next[s]
      return next
    })
    setActiveSlot(s)
    setSim({ running: false, progress: 0, result: null })
  }

  const hero = heroSlots(game).map((s) => cards[s]).filter(Boolean) as PokerCard[]
  const board = BOARD_SLOTS.map((s) => cards[s]).filter(Boolean) as PokerCard[]
  const vilCards = vilSlots(game).map((s) => cards[s])
  const villain = vilCards.every(Boolean) ? (vilCards as PokerCard[]) : null
  const heroFull = hero.length === hc
  const canCompute = heroFull && (board.length === 0 || board.length >= 3) && (villain ? opponents === 1 : true)

  function run() {
    if (!canCompute || sim.running) return
    cancelRef.current = false
    setSim({ running: true, progress: 0, result: null })
    const total = recommendedIterations(game, opponents)
    const chunk = Math.max(300, Math.round(total / 25))
    const useFixed = villain && opponents === 1
    const presetList = Array.from({ length: opponents }, (_, i) => presetById(ranges[i] ?? 'random'))
    const anyRange = presetList.some((p) => p.percent < 100)
    const filters = anyRange ? presetList.map((p) => rangeFilter(game, p.percent)) : undefined

    const simOpts = {
      game,
      hero,
      board,
      opponents: useFixed ? 1 : opponents,
      iterations: 0,
      villainCards: useFixed ? villain : null,
      villainFilters: useFixed ? undefined : filters,
    }
    // агрегируем вручную по чанкам
    const acc = { win: 0, tie: 0, lose: 0, heroCats: new Array(9).fill(0), iters: 0 }

    function step() {
      if (cancelRef.current) return
      const res = simulateEquity({
        ...simOpts,
        iterations: chunk,
      })
      acc.win += res.win * chunk
      acc.tie += res.tie * chunk
      acc.lose += res.lose * chunk
      for (let i = 0; i < 9; i++) acc.heroCats[i] += res.heroCats[i]
      acc.iters += chunk
      if (acc.iters >= total) {
        setSim({
          running: false,
          progress: 100,
          result: {
            win: acc.win / acc.iters,
            tie: acc.tie / acc.iters,
            lose: acc.lose / acc.iters,
            heroCats: acc.heroCats,
            iterations: acc.iters,
          },
        })
      } else {
        setSim({ running: true, progress: (acc.iters / total) * 100, result: null })
        timersRef.current = setTimeout(step, 0)
      }
    }
    step()
  }

  // текущая комбинация героя (если доска есть)
  const currentHand = useMemo(() => {
    if (board.length < 3 || !heroFull) return null
    if (game === 'holdem') return evaluate7([...hero, ...board])
    return bestOmahaHand(hero, board)
  }, [board, hero, heroFull, game])

  const rangeSummary = useMemo(() => {
    const list = Array.from({ length: opponents }, (_, i) => presetById(ranges[i] ?? 'random'))
    const counts = new Map<string, number>()
    for (const p of list) counts.set(p.id, (counts.get(p.id) ?? 0) + 1)
    return [...counts.entries()].map(([id, n]) => `${presetById(id).label}${n > 1 ? ` ×${n}` : ''}`).join(', ')
  }, [opponents, ranges])

  return (
    <TrainerShell
      title="Калькулятор эквити"
      subtitle={`Холдем и Омаха · против конкретной руки, диапазонов или случайных карт (до 8 оппонентов)`}
      onBack={onBack}
    >
      <ScenarioCard>
        {/* Выбор игры */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
          <span className="text-xs text-stone-400 w-28 shrink-0">Игра:</span>
          {GAMES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => changeGame(g)}
              className={cn(
                'px-3 h-8 rounded-md text-sm font-normal transition',
                game === g ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700',
              )}
            >
              {GAME_NAMES_RU[g]}
            </button>
          ))}
        </div>

        {/* Слоты */}
        <div className="flex flex-col gap-3">
          <SlotRow label={`Ваши карты (${hc})`} slotIds={heroSlots(game)} cards={cards} activeSlot={activeSlot} onSelect={setActiveSlot} onClear={clearSlot} />
          {opponents === 1 && (
            <SlotRow label="Оппонент (опц.)" slotIds={vilSlots(game)} cards={cards} activeSlot={activeSlot} onSelect={setActiveSlot} onClear={clearSlot} />
          )}
          <SlotRow label="Доска" slotIds={BOARD_SLOTS} cards={cards} activeSlot={activeSlot} onSelect={setActiveSlot} onClear={clearSlot} />
        </div>

        {/* Количество оппонентов */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
          <span className="text-xs text-stone-400 w-28 shrink-0">Оппонентов:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setOpponents(n)
                setSim({ running: false, progress: 0, result: null })
                if (n > 1) {
                  // слоты оппонента скрываются — их карты и активный слот сбрасываем
                  setCards((prev) => {
                    const next = { ...prev }
                    for (let i = 0; i < 5; i++) delete next[`vil${i}` as SlotId]
                    return next
                  })
                  setActiveSlot((s) => (s && s.startsWith('vil') ? 'hero0' : s))
                }
              }}
              className={cn(
                'w-8 h-8 rounded-md text-sm font-normal transition',
                opponents === n ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700',
              )}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-stone-500">(полный стол 9-max)</span>
        </div>

        {/* Диапазоны оппонентов */}
        {opponents > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-400">Диапазоны оппонентов: {rangeSummary}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {Array.from({ length: opponents }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 w-20 shrink-0">Оппонент {i + 1}</span>
                  <select
                    value={ranges[i] ?? 'random'}
                    onChange={(e) => setRanges((prev) => ({ ...prev, [i]: e.target.value }))}
                    className="flex-1 bg-stone-800 border border-stone-700 text-stone-200 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    aria-label={`Диапазон оппонента ${i + 1}`}
                  >
                    {RANGE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label} — {p.desc}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-500">
              В Омахе «топ N%» оценивается по структуре руки: тузы, мастевость, связки и пары.
            </p>
          </div>
        )}

        {/* Раскладка колоды */}
        <div className="flex flex-col gap-1 overflow-x-auto">
          {SUITS_VIEW.map((s) => (
            <div key={s} className="flex gap-1">
              {RANK_CHARS.map((rc, ri) => {
                const card: PokerCard = { r: ri + 2, s }
                const code = RANK_CHARS[ri] + SUIT_SYMBOLS[s]
                const used = usedCodes.has(RANK_CHARS[ri] + 'shdc'[s])
                return (
                  <button
                    key={rc}
                    type="button"
                    disabled={used}
                    onClick={() => pickCard(card)}
                    className={cn(
                      'w-9 h-9 rounded-md text-sm font-normal border transition shrink-0',
                      used
                        ? 'bg-stone-900/40 border-stone-800 text-stone-600 line-through cursor-not-allowed'
                        : (s === 1 || s === 2)
                          ? 'bg-stone-900 border-stone-700 text-red-400 hover:bg-stone-700'
                          : 'bg-stone-900 border-stone-700 text-stone-100 hover:bg-stone-700',
                    )}
                    aria-label={`Выбрать ${code}`}
                  >
                    {rc}{SUIT_SYMBOLS[s]}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500">
          {activeSlot
            ? 'Выберите карту для подсвеченного слота (нажатие на занятый слот очищает его).'
            : 'Нажмите на слот, затем выберите карту.'}
        </p>

        <div className="flex gap-2">
          <Button onClick={run} disabled={!canCompute || sim.running} className="bg-emerald-600 text-white hover:bg-emerald-500">
            {sim.running ? `Расчёт… ${Math.round(sim.progress)}%` : 'Рассчитать эквити'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCards({})
              setActiveSlot('hero0')
              setSim({ running: false, progress: 0, result: null })
            }}
            className="border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700"
          >
            Сброс
          </Button>
        </div>

        {!canCompute && (
          <p className="text-xs text-stone-400">
            Выберите все {hc} карты героя. Доска: пусто, или 3–5 карт. {villain && opponents > 1 ? 'Карты оппонента применяются только при 1 оппоненте.' : ''}
          </p>
        )}
      </ScenarioCard>

      {sim.result && (() => {
        const result = sim.result
        return (
        <Card className="border-stone-800 bg-neutral-900/60">
          <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-light text-emerald-400">
                {(result.win * 100).toFixed(1)}%
              </span>
              <span className="text-sm text-stone-400">
                шанс победы ({result.iterations.toLocaleString('ru-RU')} симуляций, {GAME_NAMES_RU[game]},
                против {opponents} {opponents === 1 ? 'оппонента' : 'оппонентов'})
              </span>
            </div>
            {currentHand && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
                <span className="text-xs text-stone-400">Сейчас у героя:</span>
                <span className="font-normal text-stone-100">{handCategoryName(currentHand.cat)}</span>
                <CardRow cards={currentHand.best} size="sm" />
              </div>
            )}
            <div className="h-3 w-full rounded-full overflow-hidden bg-stone-800 flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${result.win * 100}%` }} />
              <div className="bg-stone-500 h-full" style={{ width: `${result.tie * 100}%` }} />
              <div className="bg-red-800 h-full" style={{ width: `${result.lose * 100}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-stone-300">
              <span>Победа: {(result.win * 100).toFixed(1)}%</span>
              <span>Ничья: {(result.tie * 100).toFixed(1)}%</span>
              <span>Поражение: {(result.lose * 100).toFixed(1)}%</span>
            </div>
            <div>
              <h3 className="text-sm font-normal text-stone-200 mb-2">Финальные комбинации героя:</h3>
              <div className="flex flex-col gap-1">
                {result.heroCats
                  .map((cnt, cat) => ({ cat, pct: (cnt / result.iterations) * 100 }))
                  .filter((x) => x.pct > 0.05)
                  .sort((a, b) => b.pct - a.pct)
                  .slice(0, 6)
                  .map((x) => (
                    <div key={x.cat} className="flex items-center gap-2 text-xs">
                      <span className="w-28 text-stone-400">{handCategoryName(x.cat)}</span>
                      <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                        <div className="bg-emerald-500/80 h-full" style={{ width: `${Math.min(100, x.pct)}%` }} />
                      </div>
                      <span className="w-12 text-right text-stone-300">{x.pct.toFixed(1)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
        )
      })()}
    </TrainerShell>
  )
}

function SlotRow({
  label,
  slotIds,
  cards,
  activeSlot,
  onSelect,
  onClear,
}: {
  label: string
  slotIds: SlotId[]
  cards: Partial<Record<SlotId, PokerCard>>
  activeSlot: SlotId | null
  onSelect: (s: SlotId) => void
  onClear: (s: SlotId) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-400 w-28 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {slotIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => (cards[id] ? onClear(id) : onSelect(id))}
            className={cn(
              'rounded-lg transition',
              activeSlot === id && 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-neutral-900',
            )}
            aria-label={cards[id] ? 'Очистить слот' : 'Выбрать слот'}
          >
            <PlayingCard card={cards[id] ?? null} size="md" faceDown={!cards[id]} />
          </button>
        ))}
      </div>
    </div>
  )
}
