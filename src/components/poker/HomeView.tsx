'use client'

// Главная: режимы тренировки, статистика, серия дней
import { Flame, Zap, Sigma, Target, Percent, Swords, Layers, Grid3x3, Calculator, Trophy, ShieldCheck, Spade, Copy, SquareStack, Shuffle, Dices, Compass, BookOpen, RotateCcw, CalendarDays, Medal, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { TrainerId, useStats, accuracy, levelFor } from '@/store/stats'
import { PlayingCard, CardRow } from './PlayingCard'
import { parseCard } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

export type ViewId = TrainerId | 'ranges' | 'calculator' | 'gto' | 'theory' | 'calendar' | 'achievements' | 'live' | 'home'

interface ModeCard {
  id: ViewId
  title: string
  desc: string
  icon: typeof Zap
  trainer?: TrainerId
}

const MODES: ModeCard[] = [
  { id: 'sim', title: 'Симулятор раздач', desc: 'Решения на префлопе и постфлопе с разбором', icon: Zap, trainer: 'sim' },
  { id: 'math', title: 'Математика', desc: 'Пот-оддсы, правило 2 и 4, MDF, SPR, комбинации и блефы', icon: Sigma, trainer: 'math' },
  { id: 'outs', title: 'Аутсы и эквити', desc: '13 сценариев: от флеш-дро до отравленных аутсов', icon: Target, trainer: 'outs' },
  { id: 'ev', title: 'EV-тренажёр', desc: 'Найдите верный EV колла из пяти вариантов', icon: Percent, trainer: 'ev' },
  { id: 'winner', title: 'Кто победил?', desc: 'Определяйте выигрышную руку', icon: Swords, trainer: 'winner' },
  { id: 'combo', title: 'Какая комбинация?', desc: 'Узнавайте силу собранной руки', icon: Layers, trainer: 'combo' },
  { id: 'omaha', title: 'Омаха классическая', desc: '4 карты руки: ровно 2 + 3 с доски — кто победил?', icon: Spade, trainer: 'omaha' },
  { id: 'omaha4', title: '4-card Омаха · 2 доски', desc: 'Двойной борд: какие доски вы выигрываете?', icon: Copy, trainer: 'omaha4' },
  { id: 'omaha5', title: '5-card Омаха · 2 доски', desc: 'Пять карт руки на двух досках — чтение двух банков', icon: SquareStack, trainer: 'omaha5' },
  { id: 'omaha4sim', title: 'Симулятор · 4-card Омаха (2 доски)', desc: 'Раздачи по GTO-чартам позиций: фолд, колл или рейз с разбором', icon: Shuffle, trainer: 'omaha4sim' },
  { id: 'omaha5sim', title: 'Симулятор · 5-card Омаха (2 доски)', desc: 'Диапазоны позиции и эквити двух досок с переходом в GTO', icon: Dices, trainer: 'omaha5sim' },
  { id: 'live', title: 'Живая игра', desc: 'Визуальный стол 2–9 игроков: полные раздачи от префлопа до ривера — Холдэм и Омахи', icon: Users },
  { id: 'ranges', title: 'Диапазоны префлоп', desc: 'Чарты 6-max по позициям', icon: Grid3x3 },
  { id: 'gto', title: 'GTO-чарты', desc: 'Стол, позиция, соперники и раунд: что играть, что сбрасывать', icon: Compass },
  { id: 'theory', title: 'Теория покера', desc: 'Аутсы, правило 2 и 4, пот-оддсы, EV, MDF и SPR — справочник с примерами', icon: BookOpen },
  { id: 'calculator', title: 'Калькулятор эквити', desc: 'Холдем и Омаха 4/5 карт: до 8 оппонентов и выбор диапазонов', icon: Calculator },
  { id: 'calendar', title: 'Календарь занятий', desc: 'Статистика прохождения упражнений по дням: активность, точность, серии', icon: CalendarDays },
  { id: 'achievements', title: 'Достижения', desc: 'Уровни XP и бейджи: серии дней, дневные цели, экзамены', icon: Medal },
]

export function HomeView({ onSelect }: { onSelect: (v: ViewId) => void }) {
  const stats = useStats((s) => s.stats)
  const streak = useStats((s) => s.streak)
  const bestStreak = useStats((s) => s.bestStreak)
  const xp = useStats((s) => s.xp ?? 0)
  const resetAll = useStats((s) => s.resetAll)
  const lvl = levelFor(xp)

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
        <h1 className="text-4xl sm:text-5xl font-light text-stone-50 tracking-tight">
          Suited
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
          {totalAttempts > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-stone-500 hover:text-red-400 transition"
                  aria-label="Сбросить статистику"
                >
                  <RotateCcw className="w-4 h-4" />
                  Сброс
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Сбросить всю статистику?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Будут удалены ответы по всем режимам, статистика по типам задач, дневная статистика, серия дней, XP и бейджи. Действие необратимо.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={resetAll}
                    className="bg-red-600 text-white hover:bg-red-500"
                  >
                    Сбросить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Уровень: XP за верные ответы, серии дней и дневные цели */}
        <button
          type="button"
          onClick={() => onSelect('achievements')}
          className="w-full max-w-md"
          aria-label="Открыть достижения"
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-stone-800 bg-stone-900/50 px-3 py-2.5 hover:border-emerald-500/40 transition text-left">
            <Medal className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-stone-200">Уровень: {lvl.name} · {xp} XP</span>
                {lvl.next
                  ? <span className="text-stone-500">до «{lvl.next.name}» {lvl.next.xp - xp} XP</span>
                  : <span className="text-emerald-400">максимальный уровень</span>}
              </div>
              <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden mt-1.5">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
              </div>
            </div>
          </div>
        </button>
      </section>

      {/* Режимы */}
      <section aria-label="Режимы тренировки" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODES.map((m) => {
          const Icon = m.icon
          const acc = m.trainer ? accuracy(stats[m.trainer].correct, stats[m.trainer].attempts) : null
          return (
            <button key={m.id} type="button" onClick={() => onSelect(m.id)} className="text-left">
              <Card className="border-stone-800 bg-gradient-to-br from-neutral-800/70 to-neutral-900/85 hover:from-neutral-700/75 hover:to-neutral-800/95 transition-all hover:border-emerald-500/40 h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-normal text-stone-100 text-base sm:text-lg">{m.title}</h2>
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
          <h2 className="text-base font-normal text-stone-200 flex items-center gap-2">
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
