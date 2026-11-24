'use client'

// Тренажёр Омахи: классическая (1 доска) и двойной борд (4/5 карт руки)
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrainerShell, Feedback, ScenarioCard } from './TrainerShell'
import { CardRow } from './PlayingCard'
import { useStats } from '@/store/stats'
import {
  OmahaVariant,
  OmahaWinnerQuestion,
  OmahaDoubleQuestion,
  genOmahaWinnerQuestion,
  genOmahaDoubleQuestion,
  boardStreetLabel,
} from '@/lib/poker/omahaTraining'
import { cn } from '@/lib/utils'

const TRAINER_BY_VARIANT: Record<OmahaVariant, 'omaha' | 'omaha4' | 'omaha5'> = {
  classic: 'omaha',
  double4: 'omaha4',
  double5: 'omaha5',
}

const META: Record<OmahaVariant, { title: string; subtitle: string }> = {
  classic: {
    title: 'Омаха классическая',
    subtitle: 'Кто победил: ровно 2 карты из руки и 3 с доски',
  },
  double4: {
    title: '4-card Омаха · 2 доски',
    subtitle: 'Двойной борд: на каких досках выигрывает ваша рука?',
  },
  double5: {
    title: '5-card Омаха · 2 доски',
    subtitle: 'Пять карт руки на двух досках — определите победителя каждой',
  },
}

type ClassicAnswer = 'hero' | 'villain' | 'tie'
type DoubleAnswer = 'both' | 'b1' | 'b2' | 'none'

export function OmahaTrainerView({ variant, onBack }: { variant: OmahaVariant; onBack: () => void }) {
  const record = useStats((s) => s.recordAnswer)
  const trainerId = TRAINER_BY_VARIANT[variant]
  const meta = META[variant]

  const [winnerQ, setWinnerQ] = useState<OmahaWinnerQuestion | null>(null)
  const [doubleQ, setDoubleQ] = useState<OmahaDoubleQuestion | null>(null)
  const [classicAnswer, setClassicAnswer] = useState<ClassicAnswer | null>(null)
  const [doubleAnswer, setDoubleAnswer] = useState<DoubleAnswer | null>(null)

  function next() {
    if (variant === 'classic') {
      setWinnerQ(genOmahaWinnerQuestion())
      setClassicAnswer(null)
    } else {
      setDoubleQ(genOmahaDoubleQuestion(variant === 'double4' ? 4 : 5))
      setDoubleAnswer(null)
    }
  }

  function answerClassic(a: ClassicAnswer) {
    if (!winnerQ || classicAnswer) return
    setClassicAnswer(a)
    record('omaha', a === winnerQ.correct)
  }

  function answerDouble(a: DoubleAnswer) {
    if (!doubleQ || doubleAnswer) return
    setDoubleAnswer(a)
    record(trainerId, a === doubleQ.correct)
  }

  const intro = (
    <ScenarioCard>
      {variant === 'classic' ? (
        <>
          <p className="text-sm text-stone-300">
            Омаха похожа на Холдем, но у каждого игрока 4 карты, и обязательно используются
            ровно 2 из них вместе с ровно 3 картами доски. Это главная ошибка новичков —
            здесь она невозможна: приложение всегда считает по правилам Омахи.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Комбинация = ровно 2 карты руки + ровно 3 карты доски</li>
            <li>Нельзя взять 1 карту руки или 4 с доски — как в Холдеме</li>
            <li>Определите, чья 5-карточная комбинация сильнее</li>
          </ul>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-300">
            {variant === 'double4' ? '4-card' : '5-card'} Омаха на двух досках: банк делится между
            досками, и каждая оценивается отдельно. У каждого игрока{' '}
            {variant === 'double4' ? '4' : '5'} карт, комбинация — ровно 2 карты руки + 3 с доски.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>На каждой доске — отдельная комбинация из ваших карт</li>
            <li>Ничья на доске — сплит этой половины банка</li>
            <li>Ответьте, на каких досках выигрывает Игрок 1 (вы)</li>
          </ul>
        </>
      )}
      <Button onClick={next} className="bg-emerald-600 text-white hover:bg-emerald-500">
        Начать сессию
      </Button>
    </ScenarioCard>
  )

  // ---------- Классическая Омаха ----------
  if (variant === 'classic') {
    if (!winnerQ) {
      return (
        <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId="omaha" onBack={onBack}>
          {intro}
        </TrainerShell>
      )
    }
    const correct = classicAnswer === winnerQ.correct
    const streetLabel = boardStreetLabel(winnerQ.board.length)
    return (
      <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId="omaha" onBack={onBack}>
        <ScenarioCard>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400 w-20 shrink-0">Игрок 1 (вы)</span>
              <CardRow cards={winnerQ.hero} size="md" highlight={classicAnswer ? winnerQ.heroBest : undefined} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400 w-20 shrink-0">Доска</span>
              <CardRow cards={winnerQ.board} size="md" />
              <span className="text-xs text-stone-500">{streetLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400 w-20 shrink-0">Игрок 2</span>
              <CardRow cards={winnerQ.villain} size="md" highlight={classicAnswer ? winnerQ.villainBest : undefined} />
            </div>
          </div>
          <p className="text-sm text-stone-100">Кто побеждает в этой раздаче?</p>
          {!classicAnswer && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => answerClassic('hero')} className="bg-emerald-600 text-white hover:bg-emerald-500">
                Игрок 1 (вы)
              </Button>
              <Button variant="outline" onClick={() => answerClassic('tie')} className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700">
                Ничья (сплит)
              </Button>
              <Button variant="outline" onClick={() => answerClassic('villain')} className="border-red-600 bg-red-900/40 text-red-100 hover:bg-red-800">
                Игрок 2
              </Button>
            </div>
          )}
        </ScenarioCard>

        {classicAnswer && (
          <Feedback
            correct={correct}
            headline={
              winnerQ.correct === 'tie'
                ? 'Ничья — банк делится'
                : `Победил Игрок ${winnerQ.correct === 'hero' ? '1' : '2'}`
            }
            explanation={
              winnerQ.correct === 'tie'
                ? `Обе Омаха-руки одинаковы: ${winnerQ.heroHandName}. Банк делится поровну.`
                : `Игрок ${winnerQ.correct === 'hero' ? '1' : '2'} собирает ${winnerQ.correct === 'hero' ? winnerQ.heroHandName : winnerQ.villainHandName} против ${winnerQ.correct === 'hero' ? winnerQ.villainHandName : winnerQ.heroHandName}.`
            }
            detail={[
              'В Омахе комбинация строится строго из 2 карт руки и 3 карт доски — подсвечены именно они.',
              winnerQ.heroUsesHole || winnerQ.villainUsesHole
                ? 'Карты руки усилили комбинацию минимум одного из игроков.'
                : 'Оба игрока «играют доской» — их карты руки не улучшают лучший набор.',
            ]}
            onNext={next}
            nextLabel="Следующая раздача"
          />
        )}
      </TrainerShell>
    )
  }

  // ---------- Двойной борд ----------
  if (!doubleQ) {
    return (
      <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
        {intro}
      </TrainerShell>
    )
  }

  const correct = doubleAnswer === doubleQ.correct
  const boardBlocks = (qi: 0 | 1) => {
    const b = doubleQ.boards[qi]
    const heroBest = doubleQ.heroBest[qi]
    const boardUsed = b.filter((c) => heroBest.some((h) => h.r === c.r && h.s === c.s))
    const outcome = doubleQ.ties[qi] ? 'Сплит' : doubleQ.heroWins[qi] ? 'Победа Игрока 1' : 'Победа Игрока 2'
    return (
      <div key={qi} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400 w-20 shrink-0">Доска {qi + 1}</span>
          <CardRow cards={b} size="md" highlight={doubleAnswer ? boardUsed : undefined} />
          <span className="text-xs text-stone-500">{boardStreetLabel(b.length)}</span>
        </div>
        {doubleAnswer && (
          <div className="flex flex-col gap-1 pl-1 border-l-2 border-stone-800 ml-0.5">
            <p className="text-xs text-stone-300">
              Игрок 1: <span className="text-emerald-400">{doubleQ.heroNames[qi]}</span>
            </p>
            <p className="text-xs text-stone-300">
              Игрок 2: <span className="text-red-300">{doubleQ.villainNames[qi]}</span>
            </p>
            <p className="text-xs text-stone-500">{outcome} · подсвечены 3 карты доски из комбинации Игрока 1</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <TrainerShell title={meta.title} subtitle={meta.subtitle} trainerId={trainerId} onBack={onBack}>
      <ScenarioCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20 shrink-0">Игрок 1 (вы)</span>
            <CardRow
              cards={doubleQ.hero}
              size="md"
              highlight={doubleAnswer ? [...doubleQ.heroBest[0], ...doubleQ.heroBest[1]] : undefined}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 w-20 shrink-0">Игрок 2</span>
            <CardRow
              cards={doubleQ.villain}
              size="md"
              highlight={doubleAnswer ? [...doubleQ.villainBest[0], ...doubleQ.villainBest[1]] : undefined}
            />
          </div>
          {boardBlocks(0)}
          {boardBlocks(1)}
        </div>
        <p className="text-sm text-stone-100">На каких досках побеждает Игрок 1 (вы)?</p>
        {!doubleAnswer && (
          <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-2')}>
            <Button onClick={() => answerDouble('both')} className="bg-emerald-600 text-white hover:bg-emerald-500">
              Обе доски
            </Button>
            <Button variant="outline" onClick={() => answerDouble('b1')} className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700">
              Только доска 1
            </Button>
            <Button variant="outline" onClick={() => answerDouble('b2')} className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700">
              Только доска 2
            </Button>
            <Button variant="outline" onClick={() => answerDouble('none')} className="border-stone-600 bg-stone-800/60 text-stone-100 hover:bg-stone-700">
              Ни одной
            </Button>
          </div>
        )}
      </ScenarioCard>

      {doubleAnswer && (
        <Feedback
          correct={correct}
          headline={
            doubleQ.correct === 'both'
              ? 'Игрок 1 выигрывает обе доски'
              : doubleQ.correct === 'none'
                ? 'Игрок 1 не выигрывает ни одну доску'
                : `Игрок 1 выигрывает только доску ${doubleQ.correct === 'b1' ? '1' : '2'}`
          }
          explanation={[
            `Доска 1: Игрок 1 — ${doubleQ.heroNames[0]}, Игрок 2 — ${doubleQ.villainNames[0]}${doubleQ.ties[0] ? ' — сплит' : ''}.`,
            `Доска 2: Игрок 1 — ${doubleQ.heroNames[1]}, Игрок 2 — ${doubleQ.villainNames[1]}${doubleQ.ties[1] ? ' — сплит' : ''}.`,
          ].join(' ')}
          detail={[
            'Каждая доска — самостоятельный банк: комбинации сравниваются отдельно.',
            'В Омахе ровно 2 карты руки + 3 доски — учитывайте это на каждой доске.',
          ]}
          onNext={next}
          nextLabel="Следующая раздача"
        />
      )}
    </TrainerShell>
  )
}
