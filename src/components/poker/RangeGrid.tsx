'use client'

// Сетка 13×13 для просмотра диапазонов префлоп (с поддержкой смешанных частот GTO)
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { labelNotation } from '@/lib/poker/cards'
import type { ActionFreq } from '@/lib/poker/ranges'
import { isMixed, freqShort, freqLabel } from '@/lib/poker/ranges'

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

export function classFor(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[row]
  if (col > row) return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

export type RangeCellAction = 'raise' | 'call' | 'fold'

const actionStyles: Record<RangeCellAction, string> = {
  raise: 'bg-emerald-500/90 text-stone-950',
  call: 'bg-sky-700/90 text-stone-50',
  fold: 'bg-stone-800/70 text-stone-500',
}

export function RangeGrid({
  getAction,
  getFreq,
  cellSize = 'text-[10px]',
}: {
  getAction: (cls: string) => RangeCellAction
  getFreq?: (cls: string) => ActionFreq | undefined
  cellSize?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedFreq = selected && getFreq ? getFreq(selected) : undefined
  const selectedMixed = selectedFreq ? isMixed(selectedFreq) : false
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-px bg-stone-950/40 rounded-lg overflow-hidden border border-stone-950/40">
        {RANKS.map((_, row) =>
          RANKS.map((__, col) => {
            const cls = classFor(row, col)
            const label = labelNotation(cls)
            const action = getAction(cls)
            const freq = getFreq?.(cls)
            const mixed = freq ? isMixed(freq) : false
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onClick={() => setSelected(cls)}
                className={cn(
                  cellSize,
                  'aspect-square flex flex-col items-center justify-center font-normal leading-none min-w-0 hover:brightness-110 transition cursor-pointer relative overflow-hidden',
                  actionStyles[action],
                  selected === cls && 'ring-2 ring-white z-10',
                )}
                title={mixed && freq ? `${label}: ${freqLabel(freq)}` : `${label}: ${actionLabel(action)}`}
                aria-label={mixed && freq ? `${label}: ${freqLabel(freq)}` : `${label}: ${actionLabel(action)}`}
              >
                <span className={mixed ? 'mt-0.5' : ''} style={label.length > 3 ? { fontSize: '0.8em' } : undefined}>{label}</span>
                {mixed && freq && (
                  <span className="text-[8px] opacity-80 leading-none">{freqShort(freq)}</span>
                )}
              </button>
            )
          }),
        )}
      </div>
      <div className="text-xs text-stone-400 min-h-4">
        {selected ? (
          selectedMixed && selectedFreq ? (
            <span>
              <span className="font-normal text-stone-100">{labelNotation(selected)}</span> — {freqLabel(selectedFreq)}
            </span>
          ) : (
            <span>
              <span className="font-normal text-stone-100">{labelNotation(selected)}</span> — {actionLabel(getAction(selected))}
            </span>
          )
        ) : (
          <span>Нажмите на руку, чтобы увидеть действие и частоты</span>
        )}
      </div>
    </div>
  )
}

export function actionLabel(a: RangeCellAction): string {
  switch (a) {
    case 'raise': return 'рейз (открытие/3бет)'
    case 'call': return 'колл'
    case 'fold': return 'фолд'
  }
}

export function RangeLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500/90 inline-block" /> Рейз
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-sky-700/90 inline-block" /> Колл
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-stone-800/70 border border-stone-700 inline-block" /> Фолд
      </span>
    </div>
  )
}
