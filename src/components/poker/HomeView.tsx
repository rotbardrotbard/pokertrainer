'use client'

// Главная: режимы тренировки, статистика, серия дней
import { Flame, Zap, Sigma, Target, Percent, Swords, Layers, Grid3x3, Calculator, Trophy, ShieldCheck, Spade, Copy, SquareStack, Shuffle, Dices, Compass } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TrainerId, useStats, accuracy } from '@/store/stats'
import { PlayingCard, CardRow } from './PlayingCard'
import { parseCard } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

export type ViewId = TrainerId | 'ranges' | 'calculator' | 'gto' | 'home'

interface ModeCard {
  id: ViewId
  title: string
  desc: string
  icon: typeof Zap
  trainer?: TrainerId
}

const MODES: ModeCard[] = [
  { id: 'sim', title: 'Симулятор раздач', desc: 'Решения на префлопе и постфлопе с разбором', icon: Zap, trainer: 'sim' },
  { id: 'math', title: 'Математика', desc: 'Пот-оддсы и требуемое эквити', icon: Sigma, trainer: 'math' },
  { id: 'outs', title: 'Аутсы и эквити', desc: 'Считайте карты, дающие победу', icon: Target, trainer: 'outs' },
  { id: 'ev', title: 'EV-тренажёр', desc: 'Колл или фолд по ожидаемой стоимости', icon: Percent, trainer: 'ev' },
  { id: 'winner', title: 'Кто победил?', desc: 'Определяйте выигрышную руку', icon: Swords, trainer: 'winner' },
  { id: 'combo', title: 'Какая комбинация?', desc: 'Узнавайте силу собранной руки', icon: Layers, trainer: 'combo' },
  { id: 'omaha', title: 'Омаха классическая', desc: '4 карты руки: ровно 2 + 3 с доски — кто победил?', icon: Spade, trainer: 'omaha' },
  { id: 'omaha4', title: '4-card Омаха · 2 доски', desc: 'Двойной борд: какие доски вы выигрываете?', icon: Copy, trainer: 'omaha4' },
  { id: 'omaha5', title: '5-card Омаха · 2 доски', desc: 'Пять карт руки на двух досках — чтение двух банков', icon: SquareStack, trainer: 'omaha5' },
  { id: 'omaha4sim', title: 'Симулятор · 4-card Омаха (2 доски)', desc: 'Раздачи на двух бордах: фолд, колл или рейз — с разбором', icon: Shuffle, trainer: 'omaha4sim' },
  { id: 'omaha5sim', title: 'Симулятор · 5-card Омаха (2 доски)', desc: 'Раздачи с пятью картами руки и эквити обеих досок', icon: Dices, trainer: 'omaha5sim' },
  { id: 'ranges', title: 'Диапазоны префлоп', desc: 'Чарты 6-max по позициям', icon: Grid3x3 },
  { id: 'gto', title: 'GTO-чарты', desc: 'Стол, позиция, соперники и раунд: что играть, что сбрасывать', icon: Compass },
  { id: 'calculator', title: 'Калькулятор эквити', desc: 'Холдем и Омаха: до 8 оппонентов и выбор диапазонов', icon: Calculator },
]

export function HomeView({ onSelect }: { onSelect: (v: ViewId) => void }) {
  const stats = useStats((s) => s.stats)
  const streak = useStats((s) => s.streak)
  const bestStreak = useStats((s) => s.bestStreak)

  const totalAttempts = Object.values(stats).reduce((a, t) => a + t.attempts, 0)
  const totalCorrect = Object.values(stats).reduce((a, t) => a + t.correct, 0)
  const overall = accuracy(totalCorrect, totalAttempts)

  const demoHero = [parseCard('Ah')!, parseCard('Kh')!]
  const demoBoard = [parseCard('Qh')!, parseCard('Jh')!, parseCard('Ts')!]

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-10 pt-6 flex flex-col gap-6">
      {/* Шапка */}
      <section className="text-center flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2">
          <CardRow cards={demoHero} size="md" />
          <span className="text-stone-500 text-lg font-normal">vs</span>
          <CardRow cards={demoBoard} size="sm" className="opacity-80" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-light text-stone-50 tracking-tight">
          Покер Тренажёр
        </h1>
        <p className="text-sm text-stone-400 max-w-md">
          Бесплатная тренировка покерных навыков: Texas Hold&apos;em и Омаха — решения, математика,
          аутсы, эквити и диапазоны — без регистрации и подписок.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-stone-200">
            <Flame className="w-4 h-4" />
            Серия: {streak} дн.{bestStreak > streak ? ` (рекорд ${bestStreak})` : ''}
          </span>
          <span className="flex items-center gap-1.5 text-stone-300">
            <Trophy className="w-4 h-4 text-emerald-500" />
            Точность: {overall === null ? '—' : `${overall}%`}
            {totalAttempts > 0 && <span className="text-stone-500"> ({totalAttempts} ответов)</span>}
          </span>
        </div>
      </section>

      {/* Режимы */}
      <section aria-label="Режимы тренировки" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODES.map((m) => {
          const Icon = m.icon
          const acc = m.trainer ? accuracy(stats[m.trainer].correct, stats[m.trainer].attempts) : null
          return (
            <button key={m.id} type="button" onClick={() => onSelect(m.id)} className="text-left">
              <Card className="border-stone-800 bg-gradient-to-br from-emerald-900/50 to-emerald-950/70 hover:from-emerald-800/60 hover:to-emerald-900/80 transition-all hover:border-emerald-500/40 h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-normal text-stone-100 text-sm sm:text-base">{m.title}</h2>
                    <p className="text-xs text-stone-400 mt-0.5">{m.desc}</p>
                    {acc !== null && (
                      <p className={cn('text-xs mt-1.5 font-normal', acc >= 70 ? 'text-emerald-400' : 'text-stone-400')}>
                        Точность: {acc}%
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </section>

      {/* Информация */}
      <Card className="border-stone-800 bg-stone-900/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <h2 className="text-sm font-normal text-stone-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Полностью бесплатно
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Все режимы открыты без ограничений, прогресс сохраняется в вашем браузере.
            Это образовательное приложение: здесь нет ставок, реальных денег и мультиплеера —
            только тренировка навыков Texas Hold&apos;em и Омахи. Диапазоны и стратегии упрощены для обучения.
          </p>
        </CardContent>
      </Card>

      <footer className="text-center text-xs text-stone-600 pb-4">
        Играйте ответственно. Покер-навыки тренируются практикой — по 10–15 минут в день.
      </footer>
    </div>
  )
}
