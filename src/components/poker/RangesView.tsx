'use client'

// Просмотр диапазонов префлоп: отдельные чарты под каждый размер стола 2–9-max,
// защита против рейза — с учётом позиции рейзера.
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, ScenarioCard } from './TrainerShell'
import { RangeGrid, RangeLegend, classFor, RangeCellAction } from './RangeGrid'
import {
  Position, openRangeClassesFor, vsRaiseCharts, rangePercent,
  POSITION_ORDER, POSITION_NAMES_RU, DEFAULT_RAISER, validRaisersFor,
} from '@/lib/poker/ranges'
import { seatsForTable, basePos } from '@/lib/poker/gto'

type Mode = 'open' | 'vsRaise'

const SIZES = [2, 3, 4, 5, 6, 7, 8, 9]

function positionsForSize(players: number): Position[] {
  return [...new Set(seatsForTable(players).map((s) => basePos(s)))]
}

export function RangesView({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = useState(6)
  const [pos, setPos] = useState<Position>('UTG')
  const [mode, setMode] = useState<Mode>('open')
  const [raiser, setRaiser] = useState<Position>('CO')

  const positions = useMemo(() => positionsForSize(players), [players])
  const effectivePos = positions.includes(pos) ? pos : positions.includes('CO') ? 'CO' : positions[0]

  // рейзер валиден для защитника; при смене защитника подставляем ближайший по умолчанию
  const raiserOptions = useMemo(() => validRaisersFor(effectivePos), [effectivePos])
  const effectiveRaiser = raiserOptions.includes(raiser) ? raiser : DEFAULT_RAISER[effectivePos]

  const chart = useMemo(() => (mode === 'open'
    ? null
    : vsRaiseCharts(effectivePos, effectiveRaiser, players)), [mode, effectivePos, effectiveRaiser, players])

  const openSet = useMemo(() => openRangeClassesFor(effectivePos, players), [effectivePos, players])

  function getAction(cls: string): RangeCellAction {
    if (mode === 'open') return openSet.has(cls) ? 'raise' : 'fold'
    if (!chart) return 'fold'
    if (chart.threeBet.has(cls)) return 'raise'
    if (chart.call.has(cls)) return 'call'
    return 'fold'
  }

  function changePlayers(n: number) {
    setPlayers(n)
    const next = positionsForSize(n)
    if (!next.includes(pos)) setPos(next.includes('CO') ? 'CO' : next[0])
  }

  function changePos(p: Position) {
    setPos(p)
    const opts = validRaisersFor(p)
    if (!opts.includes(raiser)) setRaiser(DEFAULT_RAISER[p])
  }

  let pctLabel = ''
  if (mode === 'open') {
    pctLabel = `≈ ${rangePercent(openSet).toFixed(0)}% всех рук · стол ${players}-max`
  } else if (chart) {
    pctLabel = `3бет ≈ ${chart.threeBetPct.toFixed(0)}% · колл ≈ ${chart.callPct.toFixed(0)}% против открытия с ${effectiveRaiser} (стол ${players}-max)`
  }

  return (
    <TrainerShell
      title="Диапазоны префлоп"
      subtitle={`Упрощённые GTO-чарты для столов 2–9-max, стек 100bb: отдельный чарт под каждый размер`}
      trainerId="sim"
      onBack={onBack}
    >
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-stone-400 mr-1">Стол:</span>
        {SIZES.map((n) => (
          <Button
            key={n}
            size="sm"
            variant={players === n ? 'default' : 'outline'}
            onClick={() => changePlayers(n)}
            className={players === n ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700'}
          >
            {n}-max
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {positions.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={effectivePos === p ? 'default' : 'outline'}
            onClick={() => changePos(p)}
            className={effectivePos === p ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700'}
          >
            {p}
          </Button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={mode === 'open' ? 'default' : 'outline'}
          onClick={() => setMode('open')}
          className={mode === 'open' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-stone-600 bg-stone-800/60 text-stone-200'}
        >
          Открытие
        </Button>
        <Button
          size="sm"
          variant={mode === 'vsRaise' ? 'default' : 'outline'}
          onClick={() => setMode('vsRaise')}
          className={mode === 'vsRaise' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-stone-600 bg-stone-800/60 text-stone-200'}
        >
          Против рейза
        </Button>
      </div>

      {mode === 'vsRaise' && raiserOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-stone-400 mr-1">Кто рейзил:</span>
          {raiserOptions.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={effectiveRaiser === r ? 'default' : 'outline'}
              onClick={() => setRaiser(r)}
              className={effectiveRaiser === r ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700'}
            >
              {r}
            </Button>
          ))}
        </div>
      )}

      <ScenarioCard>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-normal text-stone-100">
              {mode === 'open'
                ? `Открытие рейза с ${POSITION_NAMES_RU[effectivePos]} (${players}-max)`
                : `Защита ${POSITION_NAMES_RU[effectivePos]} против открытия с ${effectiveRaiser}`}
            </h2>
            <p className="text-xs text-stone-400">{pctLabel}</p>
          </div>
          <RangeGrid getAction={getAction} />
          <RangeLegend />
          <p className="text-xs text-stone-500">
            Чарты упрощены для обучения: для каждого размера стола задана своя ширина открытия; диапазон защиты
            зависит от позиции рейзера — против поздних открытий (CO/BTN/SB) коллы в 1,5–2 раза шире, чем против UTG.
            В реальной GTO-стратегии многие руки играются смешанно (часть комбинаций — рейз, часть — фолд/колл).
          </p>
        </div>
      </ScenarioCard>
    </TrainerShell>
  )
}

// Экспорт утилиты для калькулятора/симулятора
export { classFor }
