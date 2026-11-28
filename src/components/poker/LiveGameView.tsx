'use client'

// Живая игра: визуальный стол 2–9 игроков, полные раздачи от префлопа до ривера.
// На входе — выбор типа игры (Холдэм / Омахи) и числа оппонентов; статистика отдельная.
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Users, Play, SkipForward, RotateCcw, Check, X, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { PlayingCard } from './PlayingCard'
import { LiveHand, LIVE_GAME_NAMES_RU, LIVE_GAME_HINTS, MAX_BOTS } from '@/lib/poker/live'
import type { LiveGame, LiveSnapshot, SeatView, DecisionRec } from '@/lib/poker/live'
import { useLiveStats } from '@/store/liveStats'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

type ModeSel = 'mix' | 'full' | 'node'

const MODE_LABELS: Record<ModeSel, string> = {
  full: 'Полная раздача',
  node: 'Одно решение',
  mix: 'Микс (50/50)',
}

const GAMES: LiveGame[] = ['holdem', 'omaha4', 'omaha4x2', 'omaha5x2']

function accuracy(correct: number, decisions: number): string {
  if (decisions === 0) return '—'
  return `${Math.round((correct / decisions) * 100)}%`
}

/**
 * Фиксированные слоты мест: герой снизу по центру, соперники — дугой без нижнего сектора.
 * align 'l'/'r' — коробка смещена к центру стола, чтобы у левого/правого края экрана
 * место не обрезалось на мобильных.
 */
type SeatAlign = 'c' | 'l' | 'r'
interface SeatSlot { x: number; y: number; a: SeatAlign }

const OPP_SLOTS: SeatSlot[][] = [
  /* 1 соперник */ [{ x: 50, y: 12, a: 'c' }],
  /* 2 */ [{ x: 8, y: 40, a: 'l' }, { x: 92, y: 40, a: 'r' }],
  /* 3 */ [{ x: 8, y: 40, a: 'l' }, { x: 50, y: 11, a: 'c' }, { x: 92, y: 40, a: 'r' }],
  /* 4 */ [{ x: 8, y: 40, a: 'l' }, { x: 20, y: 13, a: 'c' }, { x: 80, y: 13, a: 'c' }, { x: 92, y: 40, a: 'r' }],
  /* 5 */ [{ x: 8, y: 40, a: 'l' }, { x: 18, y: 13, a: 'c' }, { x: 50, y: 10, a: 'c' }, { x: 82, y: 13, a: 'c' }, { x: 92, y: 40, a: 'r' }],
  /* 6 */ [{ x: 9, y: 67, a: 'l' }, { x: 8, y: 36, a: 'l' }, { x: 20, y: 12, a: 'c' }, { x: 80, y: 12, a: 'c' }, { x: 92, y: 36, a: 'r' }, { x: 91, y: 67, a: 'r' }],
  /* 7 */ [{ x: 9, y: 67, a: 'l' }, { x: 8, y: 36, a: 'l' }, { x: 18, y: 12, a: 'c' }, { x: 50, y: 9, a: 'c' }, { x: 82, y: 12, a: 'c' }, { x: 92, y: 36, a: 'r' }, { x: 91, y: 67, a: 'r' }],
  /* 8 */ [{ x: 10, y: 67, a: 'l' }, { x: 7, y: 36, a: 'l' }, { x: 17, y: 14, a: 'c' }, { x: 39, y: 9, a: 'c' }, { x: 61, y: 9, a: 'c' }, { x: 83, y: 14, a: 'c' }, { x: 93, y: 36, a: 'r' }, { x: 90, y: 67, a: 'r' }],
]

const HERO_SLOT: SeatSlot = { x: 50, y: 86, a: 'c' }

function seatPos(idx: number, heroIdx: number, n: number): SeatSlot {
  const d = (idx - heroIdx + n) % n
  if (d === 0) return HERO_SLOT
  return OPP_SLOTS[n - 2][d - 1] // n ≥ 2: стол от 2 игроков
}

export function LiveGameView({ onBack }: { onBack: () => void }) {
  const [stage, setStage] = useState<'setup' | 'play'>('setup')
  const [game, setGame] = useState<LiveGame>('holdem')
  const [bots, setBots] = useState(3)
  const [modeSel, setModeSel] = useState<ModeSel>('mix')
  const [hand, setHand] = useState<LiveHand | null>(null)
  const recordedRef = useRef<LiveHand | null>(null)
  const [, setTick] = useState(0)
  const stats = useLiveStats()
  const isMobile = useIsMobile()

  const startHand = () => {
    const mode = modeSel === 'mix' ? (Math.random() < 0.5 ? 'full' : 'node') : modeSel
    setHand(new LiveHand({ game, bots, mode }))
    recordedRef.current = null
    setStage('play')
    setTick((t) => t + 1)
  }

  // авто-анимация действий ботов
  useEffect(() => {
    if (stage !== 'play') return
    if (!hand) return
    const snap = hand.snapshot()
    if (snap.finished || snap.awaitingHero) return
    const t = setTimeout(() => {
      hand.step()
      setTick((x) => x + 1)
    }, 650)
    return () => clearTimeout(t)
  })

  // запись статистики раздачи (однократно)
  useEffect(() => {
    if (stage !== 'play') return
    if (!hand) return
    const snap = hand.snapshot()
    if (!snap.finished || recordedRef.current === hand) return
    recordedRef.current = hand
    stats.recordHand(hand.game, snap.decisions.length, snap.decisions.filter((d) => d.correct).length)
  })

  const skip = () => {
    hand?.skipToDecision()
    setTick((t) => t + 1)
  }

  if (stage === 'setup') {
    const gs = stats.byGame[game] ?? { hands: 0, decisions: 0, correct: 0 }
    return (
      <div className="w-full max-w-3xl mx-auto px-4 pb-10 pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-stone-300 hover:text-white hover:bg-stone-800/60">
            <ArrowLeft className="w-4 h-4" /> Меню
          </Button>
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Users className="w-3.5 h-3.5" />
            {stats.hands} раздач · {accuracy(stats.correct, stats.decisions)} верных
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-stone-50">Живая игра</h1>
          <p className="text-sm text-stone-400">
            Визуальный стол 2–9 игроков: оппоненты действуют по GTO-чартам и силе рук, вы принимаете решения
            на каждой улице — от префлопа до вскрытия.
          </p>
        </div>

        {/* Тип игры */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GAMES.map((g) => (
            <button key={g} type="button" onClick={() => { setGame(g); if (bots > MAX_BOTS[g]) setBots(MAX_BOTS[g]) }} className="text-left">
              <Card className={cn(
                'transition h-full',
                game === g ? 'border-emerald-500/60 bg-emerald-950/30' : 'border-stone-800 bg-stone-900/50 hover:border-stone-600',
              )}>
                <CardContent className="p-4">
                  <h2 className={cn('text-base font-normal', game === g ? 'text-emerald-300' : 'text-stone-100')}>{LIVE_GAME_NAMES_RU[g]}</h2>
                  <p className="text-xs text-stone-400 mt-1">{LIVE_GAME_HINTS[g]}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        {/* Количество оппонентов */}
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-4 flex flex-col gap-2">
            <h2 className="text-sm font-normal text-stone-200">Оппоненты: {bots} — стол {bots + 1} игроков</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: MAX_BOTS[game] }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBots(n)}
                  className={cn(
                    'w-10 h-9 rounded-lg border text-sm transition',
                    bots === n ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500">Вы садитесь за случайное место — от блайндов до баттона.</p>
          </CardContent>
        </Card>

        {/* Формат раздачи */}
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-4 flex flex-col gap-2">
            <h2 className="text-sm font-normal text-stone-200">Формат раздачи</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['full', 'node', 'mix'] as ModeSel[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModeSel(m)}
                  className={cn(
                    'rounded-lg border px-2 py-2.5 text-xs transition',
                    modeSel === m ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500',
                  )}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500">
              Полная раздача — вы решаете на каждой улице. Одно решение — раздача доходит до случайного узла.
            </p>
          </CardContent>
        </Card>

        <Button onClick={startHand} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white text-base">
          <Play className="w-4 h-4 mr-2" />
          Сесть за стол
        </Button>

        {/* Статистика */}
        <Card className="border-stone-800 bg-stone-900/50">
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-normal text-stone-200 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-500" />
                Статистика живой игры
              </h2>
              {stats.hands > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button type="button" className="flex items-center gap-1 text-stone-500 hover:text-red-400 transition text-xs">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Сброс
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Сбросить статистику живой игры?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Будут удалены раздачи и решения этого режима. Основная статистика и XP не изменятся.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => stats.resetAll()} className="bg-red-600 text-white hover:bg-red-500">
                        Сбросить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-stone-800/60 py-2">
                <p className="text-lg text-stone-100">{stats.hands}</p>
                <p className="text-[10px] text-stone-500">раздач</p>
              </div>
              <div className="rounded-lg bg-stone-800/60 py-2">
                <p className="text-lg text-stone-100">{stats.decisions}</p>
                <p className="text-[10px] text-stone-500">решений</p>
              </div>
              <div className="rounded-lg bg-stone-800/60 py-2">
                <p className="text-lg text-emerald-400">{accuracy(stats.correct, stats.decisions)}</p>
                <p className="text-[10px] text-stone-500">верных</p>
              </div>
            </div>
            <p className="text-[11px] text-stone-500">
              {LIVE_GAME_NAMES_RU[game]}: {gs.hands} раздач, точность {accuracy(gs.correct, gs.decisions)}. Статистика ведётся
              отдельно от остальных режимов и не влияет на XP и календарь.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ===== Экран стола =====
  if (!hand) return null
  const snap: LiveSnapshot = hand.snapshot()
  const twoBoards = snap.boards.length > 1
  // на мобильных двойной борд сжимаем карты, чтобы два ряда умещались без наложений
  const boardCardSize: 'xs' | 'sm' = isMobile && twoBoards ? 'xs' : 'sm'

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-10 pt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setStage('setup')} className="text-stone-300 hover:text-white hover:bg-stone-800/60">
          <ArrowLeft className="w-4 h-4" /> Настройки
        </Button>
        <span className="text-xs text-stone-400">
          {LIVE_GAME_NAMES_RU[hand.game]} · {snap.seats.length} игроков · {MODE_LABELS[snap.mode]}
        </span>
        {!snap.finished && !snap.awaitingHero && (
          <Button variant="ghost" size="sm" onClick={skip} className="text-stone-400 hover:text-white hover:bg-stone-800/60">
            <SkipForward className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Стол */}
      <div className="relative w-full h-[520px] sm:h-[500px]">
        <div className="absolute inset-x-[4%] inset-y-[12%] rounded-[50%] border-2 border-emerald-900/70 bg-gradient-to-b from-neutral-800/80 to-neutral-900/90 shadow-inner" />
        {/* центр: банк и доски */}
        <div className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-10">
          <div className="px-3 py-1 rounded-full bg-stone-900/90 border border-stone-700 text-xs text-stone-200">
            Банк: {snap.pot} bb · <span className="text-stone-400">{snap.streetLabel}</span>
          </div>
          {snap.boards.map((b, bi) => (
            <div key={bi} className="flex flex-col items-center gap-0.5">
              {twoBoards && <span className="text-[9px] leading-none text-stone-500">Доска {bi + 1}</span>}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }, (_, k) =>
                  b[k]
                    ? <PlayingCard key={k} card={b[k]} size={boardCardSize} />
                    : <PlayingCard key={k} faceDown size={boardCardSize} className="opacity-25" />,
                )}
              </div>
            </div>
          ))}
        </div>

        {/* места */}
        {snap.seats.map((s: SeatView) => (
          <Seat key={s.idx} seat={s} slot={seatPos(s.idx, snap.heroSeat, snap.seats.length)} isButton={s.idx === snap.buttonIdx} />
        ))}
      </div>

      {/* Лог */}
      <div className="rounded-lg border border-stone-800 bg-stone-900/50 px-3 py-2 min-h-[64px]">
        <div className="flex flex-col gap-0.5">
          {snap.log.slice(-5).map((line, i) => (
            <p key={i} className="text-[11px] text-stone-400 leading-snug">{line}</p>
          ))}
        </div>
      </div>

      {/* Вердикт последнего решения */}
      {snap.lastVerdict && !snap.finished && (
        <div className={cn(
          'rounded-lg border px-3 py-2 flex items-start gap-2',
          snap.lastVerdict.correct ? 'border-emerald-600/50 bg-emerald-950/30' : 'border-red-700/50 bg-red-950/20',
        )}>
          {snap.lastVerdict.correct
            ? <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            : <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          <p className="text-xs text-stone-300 leading-snug">
            <span className={snap.lastVerdict.correct ? 'text-emerald-400' : 'text-red-400'}>
              {snap.lastVerdict.correct ? 'Верно. ' : 'Ошибка. '}
            </span>
            {snap.lastVerdict.reason}
          </p>
        </div>
      )}

      {/* Действия героя */}
      {snap.awaitingHero && snap.options && (
        <Card className="border-emerald-600/40 bg-emerald-950/20">
          <CardContent className="p-4 flex flex-col gap-3">
            <p className="text-sm text-stone-200">{snap.options.prompt}</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                disabled={!snap.options.canFold}
                onClick={() => { hand.heroAction('fold'); setTick((t) => t + 1) }}
                className="border-red-700/60 text-red-300 hover:bg-red-950/40 hover:text-red-200"
              >
                Фолд
              </Button>
              <Button
                variant="outline"
                disabled={!snap.options.canCheck && !snap.options.canCall}
                onClick={() => { hand.heroAction(snap.options!.canCheck ? 'check' : 'call'); setTick((t) => t + 1) }}
                className="border-emerald-600/60 text-emerald-300 hover:bg-emerald-950/50 hover:text-emerald-200"
              >
                {snap.options.canCheck ? 'Чек' : `Колл ${snap.options.callAmount} bb`}
              </Button>
              <Button
                variant="outline"
                disabled={!snap.options.canRaise}
                onClick={() => { hand.heroAction('raise'); setTick((t) => t + 1) }}
                className="border-stone-600 text-stone-200 hover:bg-stone-800 hover:text-white"
              >
                {snap.options.canCheck ? 'Бет' : 'Рейз'} до {snap.options.raiseTo} bb{snap.options.raiseAllIn ? ' (олл-ин)' : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Итог раздачи */}
      {snap.finished && (
        <HandSummary snap={snap} onAgain={startHand} onSetup={() => setStage('setup')} />
      )}
    </div>
  )
}

// ===== Место за столом =====

function Seat({ seat, slot, isButton }: { seat: SeatView; slot: SeatSlot; isButton: boolean }) {
  const hero = seat.isHero
  // боковые места смещены к центру стола, чтобы не обрезаться у края экрана
  const translateX = slot.a === 'l' ? '-translate-x-[25%]' : slot.a === 'r' ? '-translate-x-[75%]' : '-translate-x-1/2'
  return (
    <div
      className={cn('absolute -translate-y-1/2 flex flex-col items-center gap-1 z-20', translateX)}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <div className={cn(
        'px-1.5 py-1 rounded-lg border text-center',
        hero
          ? 'border-emerald-500/60 bg-emerald-950/60'
          : seat.folded
            ? 'border-stone-800 bg-stone-900/70 opacity-45'
            : 'border-stone-700 bg-neutral-800/90',
      )}>
        <p className={cn('text-[10px] leading-tight whitespace-nowrap', hero ? 'text-emerald-300' : 'text-stone-300')}>
          {seat.name}{isButton && <span className="ml-1 inline-flex w-4 h-4 rounded-full bg-stone-200 text-stone-900 text-[9px] items-center justify-center font-bold align-middle">D</span>}
        </p>
        <p className="text-[9px] text-stone-500 leading-tight">{seat.stack} bb</p>
        <SeatCards seat={seat} />
        {seat.lastText && !seat.folded && (
          <p className={cn(
            'mt-1 text-[9px] px-1 rounded bg-stone-800 border border-stone-700 whitespace-nowrap',
            seat.lastText.startsWith('Бет') || seat.lastText.startsWith('Рейз') ? 'text-emerald-400' : 'text-stone-300',
          )}>{seat.lastText}</p>
        )}
        {seat.folded && <p className="mt-1 text-[9px] text-stone-500">Фолд</p>}
        {seat.handLabel && (
          <p className="mt-1 text-[9px] text-emerald-300/90 leading-tight max-w-[120px]">{seat.handLabel}</p>
        )}
      </div>
    </div>
  )
}

/** Карты места: у соперников до вскрытия — компактная стопка рубашек со счётчиком. */
function SeatCards({ seat }: { seat: SeatView }) {
  if (seat.cards.length === 0) return null
  if (!seat.faceUp) {
    return (
      <div className="flex items-center justify-center mt-1">
        <PlayingCard faceDown size="xs" dimmed={seat.folded} />
        {seat.cards.length > 1 && (
          <span className="ml-1 text-[9px] text-stone-400 bg-stone-800 border border-stone-700 rounded px-1 leading-snug">
            ×{seat.cards.length}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className={cn('flex justify-center mt-1', seat.cards.length > 2 ? '-space-x-4' : '-space-x-0.5')}>
      {seat.cards.map((c, k) => (
        <PlayingCard key={k} card={c} size={seat.isHero ? 'sm' : 'xs'} dimmed={seat.folded} />
      ))}
    </div>
  )
}

// ===== Итог раздачи =====

function HandSummary({ snap, onAgain, onSetup }: { snap: LiveSnapshot; onAgain: () => void; onSetup: () => void }) {
  const won = (snap.result?.heroWon ?? 0) > 0
  return (
    <Card className={cn('border', won ? 'border-emerald-600/50 bg-emerald-950/25' : 'border-stone-800 bg-stone-900/50')}>
      <CardContent className="p-4 flex flex-col gap-3">
        <h2 className={cn('text-base font-normal flex items-center gap-2', won ? 'text-emerald-300' : 'text-stone-200')}>
          <Trophy className="w-4 h-4" />
          Раздача завершена
        </h2>
        {snap.result && (
          <p className="text-sm text-stone-300">{snap.result.text}</p>
        )}
        {snap.decisions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-400">Ваши решения ({snap.decisions.filter((d) => d.correct).length} из {snap.decisions.length} верных):</p>
            {snap.decisions.map((d: DecisionRec, i: number) => (
              <div key={i} className={cn(
                'rounded-lg border px-3 py-2 flex flex-col gap-1',
                d.correct ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-red-800/40 bg-red-950/15',
              )}>
                <div className="flex items-center gap-2">
                  {d.correct ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <X className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <p className="text-xs text-stone-300 flex-1">{d.prompt}</p>
                </div>
                <p className="text-xs text-stone-400 pl-5">
                  Вы: <span className={d.correct ? 'text-emerald-300' : 'text-red-300'}>{d.chosen}</span>
                  {!d.correct && <> · верно: <span className="text-stone-200">{d.best}</span></>}
                </p>
                <p className="text-[11px] text-stone-500 pl-5 leading-snug">{d.reason}</p>
                {d.eqPct !== undefined && d.requiredPct !== undefined && (
                  <p className="text-[11px] text-stone-500 pl-5">Эквити {d.eqPct}% · требуемое {d.requiredPct}%</p>
                )}
              </div>
            ))}
          </div>
        )}
        {snap.decisions.length === 0 && (
          <p className="text-xs text-stone-500">В этой раздаче решений от вас не потребовалось.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onAgain} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <Play className="w-4 h-4 mr-1.5" />
            Ещё раздача
          </Button>
          <Button onClick={onSetup} variant="outline" className="border-stone-600 text-stone-200 hover:bg-stone-800 hover:text-white">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Настройки
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
