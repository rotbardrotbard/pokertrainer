'use client'

// Симулятор раздач для Омахи с двумя досками: 4-card и 5-card.
// Тренировка: префлоп по GTO-чартам позиции, постфлоп по эквити двух досок,
// после ответа — разбор; по запросу доступна подсказка до ответа.
// Экзамен: серия раздач без подсказок и мгновенного разбора — в конце
// оценка и полный разбор всех ответов.
import { useState } from 'react'
import {
  Compass, ArrowUpRight, Lightbulb, GraduationCap, CheckCircle2, XCircle, ChevronRight, Flag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CardRow } from './PlayingCard'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { useStats } from '@/store/stats'
import {
  OmahaSimScenario,
  OmahaSimAction,
  genOmahaSimScenario,
  genOmahaSimExam,
  ExamLength,
} from '@/lib/poker/omahaSim'
import { POSITION_NAMES_RU } from '@/lib/poker/ranges'
import type { GameKind } from '@/lib/poker/handRanges'
import type { Street } from '@/lib/poker/gto'
import type { GtoInitial } from './GtoView'
import { cn } from '@/lib/utils'

type DoubleVariant = 'double4' | 'double5'

const TRAINER_BY_VARIANT: Record<DoubleVariant, 'omaha4sim' | 'omaha5sim'> = {
  double4: 'omaha4sim',
  double5: 'omaha5sim',
}

const META: Record<DoubleVariant, { title: string; subtitle: string; badge: string }> = {
  double4: {
    title: 'Симулятор раздач · 4-card Омаха',
    subtitle: 'Двойной борд: фолд, колл или рейз — как за реальным столом',
    badge: '4 карты руки · 2 доски',
  },
  double5: {
    title: 'Симулятор раздач · 5-card Омаха',
    subtitle: 'Пять карт руки на двух досках: решения с разбором эквити',
    badge: '5 карт руки · 2 доски',
  },
}

const CHIP_STYLES: Record<'raise' | 'call' | 'fold', string> = {
  raise: 'bg-emerald-500/90 text-stone-950',
  call: 'bg-sky-700/90 text-stone-50',
  fold: 'bg-stone-800/70 text-stone-500',
}

const ACTION_RU: Record<OmahaSimAction, string> = {
  raise: 'рейз',
  call: 'колл',
  fold: 'фолд',
}

const EXAM_LENGTHS: ExamLength[] = [5, 10, 20]

type ExamState = 'idle' | 'question' | 'results'

/** Оценка за экзамен по проценту верных решений. */
function examGrade(pct: number): { label: string; className: string } {
  if (pct >= 90) return { label: 'Отлично', className: 'text-emerald-400' }
  if (pct >= 70) return { label: 'Хорошо', className: 'text-amber-300' }
  if (pct >= 50) return { label: 'Удовлетворительно', className: 'text-orange-400' }
  return { label: 'Нужно повторить материал', className: 'text-red-400' }
}

function boardStreetLabel(n: number): string {
  return n === 3 ? 'Флоп' : n === 4 ? 'Терн' : 'Ривер'
}

/** Короткая подпись типа вопроса (бейдж + разбор экзамена). */
function kindBadgeLabel(sc: OmahaSimScenario): string {
  if (sc.kind === 'open') return 'Префлоп · открытие'
  if (sc.kind === 'vsRaise') return 'Префлоп · против рейза'
  return `Постфлоп · ${boardStreetLabel(sc.boardStreet).toLowerCase()}`
}

/** Параметры GTO-чартов для текущей ситуации (переход из симулятора). */
function gtoInitFor(scenario: OmahaSimScenario): GtoInitial {
  const game: GameKind = scenario.holeCount === 4 ? 'omaha4' : 'omaha5'
  if (scenario.kind === 'postflop') {
    // Обе доски на одной улице (открываются синхронно: 2 флопа → 2 терна → 2 ривера)
    const street: Street = scenario.boardStreet === 3 ? 'flop' : scenario.boardStreet === 4 ? 'turn' : 'river'
    return { game, street, seat: 'BB', opponents: 1 }
  }
  return {
    game,
    players: scenario.players,
    seat: scenario.position,
    street: 'preflop',
    situation: scenario.kind === 'open' ? 'open' : 'vsraise',
    opponents: scenario.kind === 'open' ? 0 : 1,
  }
}

function OpenGtoButton({ scenario, onOpenGto }: { scenario: OmahaSimScenario; onOpenGto?: (init: GtoInitial) => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onOpenGto?.(gtoInitFor(scenario))}
      disabled={!onOpenGto}
      className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/40 hover:text-emerald-200 h-8 shrink-0"
    >
      Открыть в GTO-чартах
      <ArrowUpRight className="w-3.5 h-3.5" />
    </Button>
  )
}

/** Чипы диапазонов GTO-чарта (общие для подсказки до ответа и разбора после ответа). */
function chartRangeChips(scenario: OmahaSimScenario): Array<{ text: string; action: 'raise' | 'call' | 'fold' }> {
  const chart = scenario.chart!
  return scenario.kind === 'open'
    ? [
        { text: `Рейз: топ ~${Math.round(chart.openPercent)}% рук`, action: 'raise' },
        { text: 'Фолд: остальное', action: 'fold' },
      ]
    : [
        { text: `3бет: топ ~${Math.round(chart.threeBetPercent)}%`, action: 'raise' },
        { text: `Колл: топ ~${Math.round(chart.callPercent)}%`, action: 'call' },
        { text: 'Фолд: остальное', action: 'fold' },
      ]
}

/** Панель GTO-чарта позиции (префлоп): диапазон рейза/колла и место руки. */
function GtoChartPanel({ scenario, onOpenGto }: { scenario: OmahaSimScenario; onOpenGto?: (init: GtoInitial) => void }) {
  const chips = chartRangeChips(scenario)
  return (
    <Card className="border-stone-800 bg-neutral-900/60">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-normal text-stone-100 flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              GTO-чарт · {POSITION_NAMES_RU[scenario.position]} · стол {scenario.players}-max
            </span>
          </h3>
          <OpenGtoButton scenario={scenario} onOpenGto={onOpenGto} />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <span key={i} className={cn('px-3 py-1.5 rounded-md text-xs font-normal', CHIP_STYLES[c.action])}>
              {c.text}
            </span>
          ))}
        </div>
        <p className="text-xs text-stone-300">
          Ваша рука — топ ~{scenario.handPct}% всех стартовых рук {scenario.holeCount}-card Омахи: по чарту это{' '}
          <b className="text-stone-100 font-normal">{ACTION_RU[scenario.correctAction]}</b>.
        </p>
      </CardContent>
    </Card>
  )
}

/** Панель GTO-ориентира (постфлоп): тир руки и рекомендация. */
function GtoPostflopPanel({ scenario, streetLabel, onOpenGto }: { scenario: OmahaSimScenario; streetLabel: string; onOpenGto?: (init: GtoInitial) => void }) {
  return (
    <Card className="border-stone-800 bg-neutral-900/60">
      <CardContent className="p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-normal text-stone-100 flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">GTO-ориентир · {streetLabel} · 1 оппонент</span>
          </h3>
          <OpenGtoButton scenario={scenario} onOpenGto={onOpenGto} />
        </div>
        <p className="text-xs text-stone-300">
          Тир руки по чарту: <b className="text-stone-100 font-normal">{scenario.gtoHint}</b>.
        </p>
      </CardContent>
    </Card>
  )
}

export function OmahaSimView({ variant, onBack, onOpenGto }: { variant: DoubleVariant; onBack: () => void; onOpenGto?: (init: GtoInitial) => void }) {
  const record = useStats((s) => s.recordAnswer)
  const recordHint = useStats((s) => s.recordHint)
  const recordExam = useStats((s) => s.recordExam)
  const trainerId = TRAINER_BY_VARIANT[variant]
  const trainerStats = useStats((s) => s.stats[trainerId])
  const meta = META[variant]
  const holeCount: 4 | 5 = variant === 'double4' ? 4 : 5

  const [scenario, setScenario] = useState<OmahaSimScenario | null>(null)
  const [answered, setAnswered] = useState<OmahaSimAction | null>(null)
  const [hintShown, setHintShown] = useState(false)

  // состояние экзамена
  const [examState, setExamState] = useState<ExamState>('idle')
  const [examQueue, setExamQueue] = useState<OmahaSimScenario[]>([])
  const [examIndex, setExamIndex] = useState(0)
  const [examAnswers, setExamAnswers] = useState<(OmahaSimAction | null)[]>([])
  const [examLen, setExamLen] = useState<ExamLength>(10)

  function next() {
    setScenario(genOmahaSimScenario(holeCount))
    setAnswered(null)
    setHintShown(false)
  }

  function answer(a: OmahaSimAction) {
    if (!scenario || answered) return
    setAnswered(a)
    // раздача, решённая по подсказке, не идёт в статистику
    if (!hintShown) record(trainerId, a === scenario.correctAction)
  }

  function showHint() {
    if (hintShown) return
    setHintShown(true)
    recordHint(trainerId) // раздача с подсказкой не идёт в точность, но подсказка учитывается
  }

  // --- экзамен ---

  function startExam() {
    const q = genOmahaSimExam(holeCount, examLen)
    setExamQueue(q)
    setExamAnswers(new Array(q.length).fill(null) as (OmahaSimAction | null)[])
    setExamIndex(0)
    setExamState('question')
    setScenario(null)
    setAnswered(null)
    setHintShown(false)
    window.scrollTo({ top: 0 })
  }

  function examAnswer(a: OmahaSimAction) {
    const sc = examQueue[examIndex]
    if (examState !== 'question' || !sc || examAnswers[examIndex] !== null) return
    const na = examAnswers.slice()
    na[examIndex] = a
    setExamAnswers(na)
    // в экзамене подсказок нет — каждый ответ идёт в статистику
    record(trainerId, a === sc.correctAction)
  }

  function examNext() {
    if (examIndex + 1 >= examQueue.length) {
      let correctN = 0
      examQueue.forEach((sc, i) => {
        if (examAnswers[i] === sc.correctAction) correctN++
      })
      recordExam(trainerId, correctN, examQueue.length)
      setExamState('results')
      window.scrollTo({ top: 0 })
    } else {
      setExamIndex(examIndex + 1)
    }
  }

  function exitExam() {
    setExamState('idle')
    setExamQueue([])
    setExamAnswers([])
    setExamIndex(0)
    setScenario(null)
    setAnswered(null)
    setHintShown(false)
    window.scrollTo({ top: 0 })
  }

  // --- общие блоки сценария (используются в тренировке и на вопросах экзамена) ---

  const scenarioBody = (sc: OmahaSimScenario, showHighlight: boolean) => {
    const isPostflop = sc.kind === 'postflop'
    const heroHighlight = showHighlight && sc.heroBest
      ? [...sc.heroBest[0], ...sc.heroBest[1]].filter((c) =>
          sc.hero.some((h) => h.r === c.r && h.s === c.s))
      : undefined

    const boardBlocks = (qi: 0 | 1) => {
      const b = sc.boards![qi]
      const best = sc.heroBest?.[qi] ?? []
      const boardUsed = b.filter((c) => best.some((h) => h.r === c.r && h.s === c.s))
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400 w-16 shrink-0">Доска {qi + 1}</span>
          <CardRow cards={b} size="md" highlight={showHighlight ? boardUsed : undefined} />
          <span className="text-xs text-stone-500">{boardStreetLabel(b.length)}</span>
        </div>
      )
    }

    return (
      <>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
            {meta.badge}
          </Badge>
          <Badge variant="outline" className="border-stone-600 text-stone-300">
            {kindBadgeLabel(sc)}
          </Badge>
          <Badge variant="outline" className="border-stone-600 text-stone-300">
            {POSITION_NAMES_RU[sc.position]}
          </Badge>
          {sc.kind !== 'postflop' && (
            <Badge variant="outline" className="border-stone-600 text-stone-400">
              Стол {sc.players}-max
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-16 shrink-0">Ваши карты</span>
            <CardRow cards={sc.hero} size="md" highlight={heroHighlight} />
          </div>
          {isPostflop && boardBlocks(0)}
          {isPostflop && boardBlocks(1)}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-300">
          <span>Банк: <b className="text-stone-100">{sc.pot} bb</b></span>
          {sc.bet > 0 && <span>Нужно уравнять: <b className="text-stone-100">{sc.bet} bb</b></span>}
          <span>Стек: <b>{sc.stack} bb</b></span>
        </div>

        <p className="text-sm text-stone-100 font-medium">{sc.prompt}</p>
      </>
    )
  }

  const actionButtons = (sc: OmahaSimScenario, onAnswer: (a: OmahaSimAction) => void) => (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => onAnswer('fold')}
        className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700 hover:text-white"
      >
        {sc.actionLabels.fold}
      </Button>
      {sc.actionLabels.call && (
        <Button
          variant="outline"
          onClick={() => onAnswer('call')}
          className="border-emerald-600 bg-emerald-800/50 text-emerald-100 hover:bg-emerald-700 hover:text-white"
        >
          {sc.actionLabels.call}
        </Button>
      )}
      <Button onClick={() => onAnswer('raise')} className="bg-emerald-600 text-white hover:bg-emerald-500">
        {sc.actionLabels.raise}
      </Button>
    </div>
  )

  // --- экран вопроса экзамена ---

  if (examState === 'question') {
    const sc = examQueue[examIndex]
    if (!sc) return null
    const given = examAnswers[examIndex] ?? null
    const isLast = examIndex + 1 >= examQueue.length
    const answeredCount = examAnswers.filter((x) => x !== null).length

    return (
      <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
        <ScenarioCard>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              Экзамен
            </Badge>
            <span className="text-stone-400">
              Вопрос {examIndex + 1} из {examQueue.length} · {kindBadgeLabel(sc).toLowerCase()}
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${(answeredCount / examQueue.length) * 100}%` }} />
          </div>

          {scenarioBody(sc, false)}

          {given === null ? (
            <>
              {actionButtons(sc, examAnswer)}
              <Button
                variant="ghost"
                size="sm"
                onClick={exitExam}
                className="text-stone-500 hover:text-stone-300 hover:bg-stone-800/70 h-8 w-fit px-2 gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                Прервать экзамен
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-800 bg-stone-900/60 p-3">
              <span className="text-xs text-stone-400">
                Ответ зафиксирован: <b className="text-stone-100 font-normal">{ACTION_RU[given]}</b>. Разбор всех ответов — в конце экзамена.
              </span>
              <Button onClick={examNext} className="bg-emerald-600 text-white hover:bg-emerald-500 h-8 shrink-0">
                {isLast ? 'К результатам' : 'Следующий вопрос'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </ScenarioCard>
      </TrainerShell>
    )
  }

  // --- экран результатов экзамена ---

  if (examState === 'results') {
    const total = examQueue.length
    let correctN = 0
    examQueue.forEach((sc, i) => {
      if (examAnswers[i] === sc.correctAction) correctN++
    })
    const pct = total > 0 ? Math.round((correctN / total) * 100) : 0
    const grade = examGrade(pct)
    const wrong = total - correctN

    return (
      <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
        <ScenarioCard>
          <div className="flex items-center gap-2 text-sm text-stone-100">
            <GraduationCap className="w-5 h-5 text-emerald-400" />
            Экзамен завершён
          </div>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-4xl text-stone-50 font-light">{correctN} / {total}</p>
              <p className="text-xs text-stone-400">верных решений</p>
            </div>
            <div>
              <p className="text-4xl text-stone-50 font-light">{pct}%</p>
              <p className={cn('text-sm', grade.className)}>{grade.label}</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
            <div className={cn('h-full transition-all', pct >= 50 ? 'bg-emerald-600' : 'bg-red-600')} style={{ width: `${pct}%` }} />
          </div>

          <p className="text-xs text-stone-400">
            Ошибок: {wrong}. {wrong === 0 ? 'Все решения по GTO — идеальный результат.' : 'Разбор ошибок — ниже.'}
          </p>
          {trainerStats && trainerStats.exams > 0 && (
            <p className="text-xs text-stone-500">
              Экзаменов сдано: {trainerStats.exams} · Лучший результат: {trainerStats.examBest}%
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={startExam} className="bg-emerald-600 text-white hover:bg-emerald-500">
              Пройти экзамен снова
            </Button>
            <Button
              variant="outline"
              onClick={exitExam}
              className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700 hover:text-white"
            >
              Вернуться к тренировке
            </Button>
          </div>
        </ScenarioCard>

        <Card className="border-stone-800 bg-stone-900/40">
          <CardContent className="p-4 flex flex-col gap-3">
            <h3 className="text-sm font-normal text-stone-100">Разбор ответов</h3>
            <div className="flex flex-col gap-2">
              {examQueue.map((sc, i) => {
                const given = examAnswers[i] ?? null
                const ok = given === sc.correctAction
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border p-3 flex flex-col gap-2',
                      ok ? 'border-stone-800 bg-stone-900/40' : 'border-red-900/50 bg-red-950/20',
                    )}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-stone-500 w-6 shrink-0">{i + 1}.</span>
                      {ok
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                      <Badge variant="outline" className="border-stone-700 text-stone-400">
                        {kindBadgeLabel(sc)}
                      </Badge>
                      <CardRow cards={sc.hero} size="sm" className="ml-1" />
                      <span className="text-xs text-stone-500 ml-auto">
                        Ваш ответ: <b className={cn('font-normal', ok ? 'text-emerald-300' : 'text-red-300')}>{given ? ACTION_RU[given] : '—'}</b>
                        {!ok && <> · верно: <b className="text-stone-200 font-normal">{ACTION_RU[sc.correctAction]}</b></>}
                      </span>
                    </div>
                    {!ok && <p className="text-xs text-stone-400 pl-8">{sc.explanation}</p>}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </TrainerShell>
    )
  }

  // --- тренировка: интро-экран ---

  if (!scenario) {
    return (
      <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
        <ScenarioCard>
          <p className="text-sm text-stone-300">
            Симулятор раздач {holeCount}-card Омахи на двух досках. Каждая раздача — реальные
            решения: открыть, защищаться против рейза, играть постфлоп на двух бордах.
            После ответа — разбор с GTO-чартом позиции и эквити по каждой доске.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Комбинация — ровно 2 карты руки + 3 с доски</li>
            <li>Каждая доска — отдельная половина банка, эквити усредняется</li>
            <li>Префлоп — по GTO-чартам позиции: диапазон зависит от позиции и размера стола (2–9 max)</li>
            <li>По кнопке «Подсказка» — эквити до ответа (постфлоп) или место руки по чарту (префлоп); раздача с подсказкой не идёт в статистику</li>
            <li>После ответа — чарт позиции и переход в раздел GTO с вашими параметрами</li>
            <li>Режим экзамена: серия раздач без подсказок — в конце оценка и разбор ошибок</li>
          </ul>
          <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
            Начать сессию
          </Button>

          <div className="rounded-lg border border-stone-800 bg-neutral-900/60 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-stone-100">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              Режим экзамена
            </div>
            <p className="text-xs text-stone-400">
              Серия раздач без подсказок и мгновенного разбора: открытия, защита против рейза и
              постфлоп на двух досках (флоп, терн и ривер — поровну). В конце — оценка и разбор всех
              ответов. Ответы экзамена идут в общую статистику.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-400">Длина экзамена:</span>
              {EXAM_LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setExamLen(n)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs border transition-colors min-h-[32px]',
                    examLen === n
                      ? 'border-emerald-500 text-emerald-300 bg-emerald-900/40'
                      : 'border-stone-700 text-stone-400 hover:bg-stone-800/60 hover:text-stone-200',
                  )}
                >
                  {n} вопросов
                </button>
              ))}
            </div>
            <Button
              onClick={startExam}
              variant="outline"
              className="border-emerald-600 text-emerald-300 hover:bg-emerald-900/40 hover:text-emerald-200 w-fit"
            >
              Начать экзамен
              <ChevronRight className="w-4 h-4" />
            </Button>
            {trainerStats && trainerStats.exams > 0 && (
              <p className="text-xs text-stone-500">
                Экзаменов сдано: {trainerStats.exams} · Лучший результат: {trainerStats.examBest}%
              </p>
            )}
          </div>
        </ScenarioCard>
      </TrainerShell>
    )
  }

  // --- тренировка: вопрос и разбор ---

  const correct = answered !== null && answered === scenario.correctAction
  const isPostflop = scenario.kind === 'postflop'

  // панель эквити: до ответа (по подсказке) и после ответа
  const equityPanel = isPostflop && scenario.sim ? (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
      <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
        <p className="text-stone-500">Эквити · Доска 1</p>
        <p className="text-lg text-stone-100 font-normal">{(scenario.sim.eq1 * 100).toFixed(0)}%</p>
      </div>
      <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
        <p className="text-stone-500">Эквити · Доска 2</p>
        <p className="text-lg text-stone-100 font-normal">{(scenario.sim.eq2 * 100).toFixed(0)}%</p>
      </div>
      <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
        <p className="text-stone-500">Эквити по банку</p>
        <p className="text-lg text-emerald-400 font-normal">{(scenario.sim.total * 100).toFixed(1)}%</p>
      </div>
      <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
        <p className="text-stone-500">Требуемые пот-оддсы</p>
        <p className="text-lg text-stone-100 font-normal">{scenario.requiredPct}%</p>
      </div>
    </div>
  ) : null

  // префлоп-подсказка: диапазоны чарта позиции + место руки (без вывода-вердикта)
  const preflopHintPanel = !isPostflop && scenario.chart && scenario.handPct !== null ? (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {chartRangeChips(scenario).map((c, i) => (
          <span key={i} className={cn('px-3 py-1.5 rounded-md text-xs font-normal', CHIP_STYLES[c.action])}>
            {c.text}
          </span>
        ))}
      </div>
      <p className="text-xs text-stone-300">
        Ваша рука — топ ~{scenario.handPct}% всех стартовых рук {scenario.holeCount}-card Омахи.
      </p>
    </div>
  ) : null

  return (
    <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
      <ScenarioCard>
        {scenarioBody(scenario, answered !== null)}

        {!answered && hintShown && (isPostflop ? equityPanel : preflopHintPanel) && (
          <div className="flex flex-col gap-1.5">
            {isPostflop ? equityPanel : preflopHintPanel}
            <p className="text-xs text-stone-500">
              Подсказка до ответа: эта раздача не будет учтена в статистике.
            </p>
          </div>
        )}

        {!answered && actionButtons(scenario, answer)}

        {!answered && !hintShown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={showHint}
            className="text-stone-400 hover:text-stone-200 hover:bg-stone-800/70 h-8 w-fit px-2 gap-1.5"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {isPostflop ? 'Подсказка: показать эквити' : 'Подсказка: место руки по чарту'}
          </Button>
        )}
      </ScenarioCard>

      {answered && (
        <>
          <Feedback
            correct={correct}
            headline={correct ? 'Верно!' : 'Ошибка'}
            explanation={scenario.explanation}
            detail={hintShown
              ? [...scenario.detail, 'Подсказка использована — раздача не учтена в статистике.']
              : scenario.detail}
            onNext={next}
            nextLabel="Следующая раздача"
          />
          {isPostflop && equityPanel}
          {!isPostflop && scenario.chart && (
            <GtoChartPanel scenario={scenario} onOpenGto={onOpenGto} />
          )}
          {isPostflop && scenario.gtoHint && (
            <GtoPostflopPanel
              scenario={scenario}
              streetLabel={boardStreetLabel(scenario.boardStreet)}
              onOpenGto={onOpenGto}
            />
          )}
        </>
      )}
    </TrainerShell>
  )
}
