'use client'

// Игральная карта (визуальная)
import { Card, SUIT_SYMBOLS, RANK_CHARS } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

interface PlayingCardProps {
  card?: Card | null
  faceDown?: boolean
  size?: 'sm' | 'md' | 'lg'
  highlighted?: boolean
  dimmed?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'w-9 h-13 text-sm rounded-md',
  md: 'w-12 h-17 text-base rounded-lg',
  lg: 'w-16 h-22 text-xl rounded-lg',
}

export function PlayingCard({ card, faceDown, size = 'md', highlighted, dimmed, className }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={cn(
          sizeClasses[size],
          'border border-emerald-950/60 bg-gradient-to-br from-emerald-900 to-emerald-950 shadow-md flex items-center justify-center select-none',
          className,
        )}
        aria-label="Закрытая карта"
      >
        <span className="text-emerald-500/70 text-lg font-bold">♠</span>
      </div>
    )
  }
  const isRed = card.s === 1 || card.s === 2 // ♥ ♦
  return (
    <div
      className={cn(
        sizeClasses[size],
        'bg-gradient-to-br from-stone-50 to-stone-200 border border-stone-300 shadow-md relative flex flex-col items-center justify-center select-none transition-transform',
        isRed ? 'text-red-600' : 'text-stone-900',
        highlighted && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-emerald-950 scale-105 z-10',
        dimmed && 'opacity-40',
        className,
      )}
      aria-label={`${RANK_CHARS[card.r - 2]} ${SUIT_SYMBOLS[card.s]}`}
    >
      <span className="absolute top-0.5 left-1 font-bold leading-none">{RANK_CHARS[card.r - 2]}</span>
      <span className="text-2xl leading-none">{SUIT_SYMBOLS[card.s]}</span>
      <span className="absolute bottom-0.5 right-1 font-bold leading-none rotate-180">{RANK_CHARS[card.r - 2]}</span>
    </div>
  )
}

/** Ряд карт с небольшим наложением */
export function CardRow({ cards, size = 'md', highlight, dim, className }: {
  cards: (Card | null)[]
  size?: 'sm' | 'md' | 'lg'
  highlight?: Card[]
  dim?: Card[]
  className?: string
}) {
  return (
    <div className={cn('flex', className)}>
      {cards.map((c, i) => {
        const isHl = highlight?.some((h) => h.r === c?.r && h.s === c?.s)
        const isDim = dim?.some((h) => h.r === c?.r && h.s === c?.s)
        return (
          <div key={i} className={i > 0 ? '-ml-1.5' : ''}>
            <PlayingCard card={c} size={size} highlighted={isHl} dimmed={isDim} />
          </div>
        )
      })}
    </div>
  )
}
