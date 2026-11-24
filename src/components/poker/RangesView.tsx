'use client'

// Просмотр диапазонов префлоп по позициям (6-max)
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, ScenarioCard } from './TrainerShell'
import { RangeGrid, RangeLegend, classFor, RangeCellAction } from './RangeGrid'
import { Position, openRangeClasses, vsRaiseClasses, rangePercent, POSITION_ORDER, POSITION_NAMES_RU } from '@/lib/poker/ranges'

type Mode = 'open' | 'vsRaise'

export function RangesView({ onBack }: { onBack: () => void }) {
  const [pos, setPos] = useState<Position>('UTG')
  const [mode, setMode] = useState<Mode>('open')

  let openSet: Set<string> | null = null
  let threeBet: Set<string> | null = null
  let call: Set<string> | null = null
  let pctLabel = ''
  if (mode === 'open') {
    openSet = openRangeClasses(pos)
    pctLabel = `≈ ${rangePercent(openSet).toFixed(0)}% всех рук`
  } else {
    const r = vsRaiseClasses(pos)
    threeBet = r.threeBet
    call = r.call
    pctLabel = 'защита против рейза: 3бет или колл'
  }

  function getAction(cls: string): RangeCellAction {
    if (mode === 'open') return openSet!.has(cls) ? 'raise' : 'fold'
    if (threeBet!.has(cls)) return 'raise'
    if (call!.has(cls)) return 'call'
    return 'fold'
  }

  return (
    <TrainerShell title="Диапазоны префлоп" subtitle="Упрощённые GTO-чарты для 6-max кэш-игр, стек 100bb" trainerId="sim" onBack={onBack}>
      <div className="flex flex-wrap gap-1.5">
        {POSITION_ORDER.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={pos === p ? 'default' : 'outline'}
            onClick={() => setPos(p)}
            className={pos === p ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold' : 'border-stone-600 bg-stone-800/60 text-stone-200 hover:bg-stone-700'}
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
          className={mode === 'open' ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold' : 'border-stone-600 bg-stone-800/60 text-stone-200'}
        >
          Открытие
        </Button>
        <Button
          size="sm"
          variant={mode === 'vsRaise' ? 'default' : 'outline'}
          onClick={() => setMode('vsRaise')}
          className={mode === 'vsRaise' ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold' : 'border-stone-600 bg-stone-800/60 text-stone-200'}
        >
          Против рейза
        </Button>
      </div>

      <ScenarioCard>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-100">
              {mode === 'open'
                ? `Открытие рейза с ${POSITION_NAMES_RU[pos]}`
                : `Защита ${POSITION_NAMES_RU[pos]} против рейза`}
            </h2>
            <p className="text-xs text-stone-400">{pctLabel}</p>
          </div>
          <RangeGrid getAction={getAction} />
          <RangeLegend />
          <p className="text-xs text-stone-500">
            Чарты упрощены для обучения: в реальной GTO-стратегии многие руки играются смешанно
            (часть комбинаций — рейз, часть — фолд/колл).
          </p>
        </div>
      </ScenarioCard>
    </TrainerShell>
  )
}

// Экспорт утилиты для калькулятора/симулятора
export { classFor }
