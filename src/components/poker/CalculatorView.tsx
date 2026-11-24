'use client'

// Калькулятор эквити: Monte Carlo против случайных рук или конкретного оппонента
import { useMemo, useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrainerShell, ScenarioCard } from './TrainerShell'
import { PlayingCard } from './PlayingCard'
import { SUIT_SYMBOLS, RANK_CHARS } from '@/lib/poker/cards'
import type { Card as PokerCard } from '@/lib/poker/cards'
import { simulateEquity } from '@/lib/poker/equity'
import { handCategoryName } from '@/lib/poker/evaluator'
import { cn } from '@/lib/utils'

type SlotId = 'hero0' | 'hero1' | 'vil0' | 'vil1' | 'b0' | 'b1' | 'b2' | 'b3' | 'b4'

const ALL_SLOTS: SlotId[] = ['hero0', 'hero1', 'vil0', 'vil1', 'b0', 'b1', 'b2', 'b3', 'b4']

interface SimState {
  running: boolean
  progress: number
  result: { win: number; tie: number; lose: number; heroCats: number[]; iterations: number } | null
}

export function CalculatorView({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<Partial<Record<SlotId, PokerCard>>>({})
  const [activeSlot, setActiveSlot] = useState<SlotId | null>('hero0')
  const [opponents, setOpponents] = useState(1)
  const [sim, setSim] = useState<SimState>({ running: false, progress: 0, result: null })
  const cancelRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    cancelRef.current = true
    if (timersRef.current) clearTimeout(timersRef.current)
  }, [])

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
    const order: SlotId[] = ['hero0', 'hero1', 'vil0', 'vil1', 'b0', 'b1', 'b2', 'b3', 'b4']
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

  const hero = [cards.hero0, cards.hero1]
  const board = [cards.b0, cards.b1, cards.b2, cards.b3, cards.b4].filter(Boolean) as PokerCard[]
  const villain = cards.vil0 && cards.vil1 ? [cards.vil0, cards.vil1] : null
  const canCompute = !!cards.hero0 && !!cards.hero1 && (board.length === 0 || board.length >= 3)

  function run() {
    if (!canCompute || sim.running) return
    cancelRef.current = false
    setSim({ running: true, progress: 0, result: null })
    const total = 30000
    const chunk = 3000
    const simOpts = {
      hero: [cards.hero0!, cards.hero1!],
      board,
      opponents: villain ? 1 : opponents,
      iterations: 0,
      villainCards: villain,
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

  return (
    <TrainerShell title="Калькулятор эквити" subtitle="Вероятность победы против случайных рук или конкретного оппонента" onBack={onBack}>
      <ScenarioCard>
        {/* Слоты */}
        <div className="flex flex-col gap-3">
          <SlotRow label="Ваши карты" slotIds={['hero0', 'hero1']} cards={cards} activeSlot={activeSlot} onSelect={setActiveSlot} onClear={clearSlot} />
          <SlotRow label="Оппонент (опц.)" slotIds={['vil0', 'vil1']} cards={cards} activeSlot={activeSlot} onSelect={setActiveSlot} onClear={clearSlot} />
          <SlotRow label="Доска" slotIds={['b0', 'b1', 'b2', 'b3', 'b4']} cards={cards} activeSlot={activeSlot} onSelect={setActiveSlot} onClear={clearSlot} />
        </div>

        {/* Выбор оппонентов */}
        <div className="flex items-center gap-2 text-sm text-stone-300">
          <span>Случайных оппонентов:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setOpponents(n)}
              className={cn(
                'w-8 h-8 rounded-md text-sm font-semibold transition',
                opponents === n ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700',
              )}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-stone-500">(если не заданы карты оппонента)</span>
        </div>

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
                      'w-9 h-9 rounded-md text-sm font-semibold border transition shrink-0',
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
          <Button onClick={run} disabled={!canCompute || sim.running} className="bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold">
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
          <p className="text-xs text-amber-500/80">Выберите минимум 2 карты героя. Доска: пусто, или 3–5 карт.</p>
        )}
      </ScenarioCard>

      {sim.result && (
        <Card className="border-stone-800 bg-emerald-950/40">
          <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-bold text-emerald-400">
                {(sim.result.win * 100).toFixed(1)}%
              </span>
              <span className="text-sm text-stone-400">шанс победы ({sim.result.iterations.toLocaleString('ru-RU')} симуляций)</span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden bg-stone-800 flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${sim.result.win * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${sim.result.tie * 100}%` }} />
              <div className="bg-red-800 h-full" style={{ width: `${sim.result.lose * 100}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-stone-300">
              <span>Победа: {(sim.result.win * 100).toFixed(1)}%</span>
              <span>Ничья: {(sim.result.tie * 100).toFixed(1)}%</span>
              <span>Поражение: {(sim.result.lose * 100).toFixed(1)}%</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-200 mb-2">Финальные комбинации героя:</h3>
              <div className="flex flex-col gap-1">
                {sim.result.heroCats
                  .map((cnt, cat) => ({ cat, pct: (cnt / sim.result.iterations) * 100 }))
                  .filter((x) => x.pct > 0.05)
                  .sort((a, b) => b.pct - a.pct)
                  .slice(0, 6)
                  .map((x) => (
                    <div key={x.cat} className="flex items-center gap-2 text-xs">
                      <span className="w-28 text-stone-400">{handCategoryName(x.cat)}</span>
                      <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                        <div className="bg-amber-500/80 h-full" style={{ width: `${Math.min(100, x.pct)}%` }} />
                      </div>
                      <span className="w-12 text-right text-stone-300">{x.pct.toFixed(1)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
              activeSlot === id && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-emerald-950',
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
