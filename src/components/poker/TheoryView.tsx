'use client'

// Теория покера: аутсы и правило 2 и 4, пот-оддсы, EV и блеф, MDF и SPR
import { useState } from 'react'
import { BookOpen, Sigma, Percent, ShieldCheck } from 'lucide-react'
import { TrainerShell, ScenarioCard } from './TrainerShell'
import { CardRow } from './PlayingCard'
import { parseCard } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

type TopicId = 'outs' | 'potOdds' | 'ev' | 'defense'

const TOPICS: Array<{ id: TopicId; label: string; icon: typeof BookOpen }> = [
  { id: 'outs', label: 'Аутсы и правило 2 и 4', icon: BookOpen },
  { id: 'potOdds', label: 'Пот-оддсы и эквити', icon: Sigma },
  { id: 'ev', label: 'EV и блеф', icon: Percent },
  { id: 'defense', label: 'MDF и SPR', icon: ShieldCheck },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg sm:text-xl font-normal text-stone-100">{title}</h2>
      {children}
    </div>
  )
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-700/70">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="bg-stone-900/80">
            {head.map((h, i) => (
              <th key={i} className="px-2.5 py-2 text-left font-normal text-stone-300 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-stone-900/40' : 'bg-transparent'}>
              {r.map((c, j) => (
                <td key={j} className={cn('px-2.5 py-1.5 text-stone-300 whitespace-nowrap', j === 0 && 'text-stone-100')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const c = parseCard

function OutsTopic() {
  return (
    <ScenarioCard className="gap-5">
      <Section title="Что такое аутс">
        <p className="text-sm text-stone-300 leading-relaxed">
          <b className="text-stone-100">Аутс</b> — карта в колоде, которая превратит вашу руку в
          победную. Чтобы посчитать аутсы, нужно знать свои карты, доску и предполагаемую руку
          оппонента: аутсом считается карта, делающая вашу руку <i>лучше его</i>.
        </p>
        <div className="flex flex-col gap-2 rounded-lg border border-stone-700/70 bg-stone-900/70 p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-stone-400 w-24">Ваши карты</span>
            <CardRow cards={[c('As')!, c('Ks')]!} size="sm" />
            <span className="text-xs text-stone-500">две оверкарты + флеш-дро</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-stone-400 w-24">Доска</span>
            <CardRow cards={[c('Ts')!, c('7s')!, c('2d')]!} size="sm" />
            <span className="text-xs text-stone-500">флоп</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            В колоде 13 пиковых карт, 4 из них видны (A♠, K♠, T♠, 7♠) — остаются 9 карт для флеша.
            Плюс 3 оставшихся аса и 3 короля против пары валетов у оппонента: <b className="text-stone-100">15 аутсов</b>.
          </p>
        </div>
      </Section>

      <Section title="Таблица типичных дро">
        <DataTable
          head={['Дро', 'Аутсов', 'До ривера (×4 / точно)', 'След. карта (×2 / точно)']}
          rows={[
            ['Флеш-дро', 9, '36% / 35%', '18% / 19%'],
            ['Двусторонний стрит-дро (OESD)', 8, '32% / 31%', '16% / 17%'],
            ['Гатшот', 4, '16% / 16.5%', '8% / 8.5%'],
            ['Двойной гатшот', 6, '24% / 24%', '12% / 13%'],
            ['Флеш-дро + гатшот', 12, '48% / 45%', '24% / 26%'],
            ['Комбо: стрит + флеш', 15, '60% / 54%', '30% / 32%'],
            ['Две оверкарты', 6, '24% / 24%', '12% / 13%'],
            ['Пара → сет', 2, '8% / 8.4%', '4% / 4.3%'],
            ['Сет / две пары → фулл-хаус', '4–7', '16–28% / 16.5–27.8%', '8–14% / 8.5–15%'],
          ]}
        />
        <p className="text-xs text-stone-400">
          «Точно» — вероятности, посчитанные по комбинаторике (47 неизвестных карт на флопе).
          Правило 2 и 4 слегка завышает шанс при большом числе аутсов: 15 аутсов дают 54%, а не 60%.
        </p>
      </Section>

      <Section title="Правило 2 и 4">
        <p className="text-sm text-stone-300 leading-relaxed">
          Быстрая оценка шанса улучшиться без таблиц: на <b className="text-stone-100">терне</b> умножьте
          число аутсов на 2 (одна карта придёт), на <b className="text-stone-100">флопе</b> — на 4 (придут
          две карты: терн и ривер). Например, 8 аутсов на флопе: 8 × 4 ≈ 32% до ривера.
        </p>
      </Section>

      <Section title="Отравленные и дисконтированные аутсы">
        <p className="text-sm text-stone-300 leading-relaxed">
          Карта, которая даёт улучшение и оппоненту — или делает его руку ещё сильнее вашей, — не
          считается. Если у оппонента сет, а у вас флеш-дро, то пиковая карта, спаривающая доску,
          даёт ему фулл-хаус: из 9 аутсов остаётся 8. Сравнивайте свои аутсы с рукой оппонента и
          <b className="text-stone-100"> дисконтируйте</b> сомнительные — при нескольких оппонентах
          часть аутсов почти всегда «отравлена».
        </p>
      </Section>

      <Section title="Как применять на практике">
        <ol className="text-sm text-stone-300 leading-relaxed list-decimal pl-5 flex flex-col gap-1">
          <li>Посчитайте чистые аутсы против предполагаемой руки оппонента.</li>
          <li>Умножьте на 4 (флоп) или 2 (терн) — это ваш шанс улучшиться.</li>
          <li>Сравните с требуемым эквити по пот-оддсам (следующий раздел теории).</li>
          <li>Колл прибылен, если шанс улучшения не ниже требуемого — с учётом будущих ставок (implied odds) можно чуть шире.</li>
        </ol>
      </Section>
    </ScenarioCard>
  )
}

function PotOddsTopic() {
  return (
    <ScenarioCard className="gap-5">
      <Section title="Пот-оддсы: что они измеряют">
        <p className="text-sm text-stone-300 leading-relaxed">
          <b className="text-stone-100">Пот-оддсы</b> — соотношение текущего банка к ставке, которую
          нужно уравнять. Они показывают, с какой частотой колл должен выигрывать, чтобы окупаться.
          Формула требуемого эквити: <b className="text-stone-100">ставка / (банк + ставка + ваш колл)</b>.
        </p>
      </Section>

      <Section title="Таблица типичных ставок">
        <DataTable
          head={['Ставка оппонента', 'Требуемое эквити', 'Шансы банка']}
          rows={[
            ['½ банка', '25%', '3 : 1'],
            ['⅔ банка', '28.6%', '2.5 : 1'],
            ['¾ банка', '30%', '2.33 : 1'],
            ['размер банка', '33.3%', '2 : 1'],
            ['двойной овербет', '40%', '1.5 : 1'],
          ]}
        />
      </Section>

      <Section title="Шансы банка в формате a:1">
        <p className="text-sm text-stone-300 leading-relaxed">
          Если шансы банка <b className="text-stone-100">a : 1</b> (например, в банке 100, колл 50 —
          шансы 3:1), то эквити для колла: <b className="text-stone-100">1 / (a + 1)</b>. Для 3:1 это
          1 / 4 = 25%.
        </p>
      </Section>

      <Section title="Связь с аутсами">
        <p className="text-sm text-stone-300 leading-relaxed">
          Правило принятия решения с дро: посчитайте аутсы, оцените шанс улучшения по правилу 2 и 4 и
          сравните с требуемым эквити. Пример: флеш-дро (9 аутсов ≈ 35% до ривера) против ставки в
          размер банка (нужно 33.3%) — колл прибылен. Против овербета 2× банка (нужно 40%) — уже
          нет, без имплайд-оддсов фолд правильнее.
        </p>
        <p className="text-xs text-stone-400">
          Имплайд-оддсы — будущие ставки, которые вы выиграете, когда дро доедет: они позволяют
          прибыльно коллировать чуть хуже прямых пот-оддсов, особенно против активных оппонентов.
        </p>
      </Section>
    </ScenarioCard>
  )
}

function EvTopic() {
  return (
    <ScenarioCard className="gap-5">
      <Section title="EV колла">
        <p className="text-sm text-stone-300 leading-relaxed">
          <b className="text-stone-100">EV (expected value)</b> — средний выигрыш решения на дистанции.
          Для колла: <b className="text-stone-100">EV = эквити × (банк + ставка) − (1 − эквити) × колл</b>.
          Пример: банк 90, ставка 30, эквити 30%: EV = 0.30 × 120 − 0.70 × 30 = 36 − 21 = <b className="text-emerald-400">+15 bb</b>.
          Если EV отрицательный — фолд лучше (он стоит ноль).
        </p>
        <p className="text-xs text-stone-400">
          Порог прибыльного колла: эквити &gt; колл / (банк + 2 × колл) — та же формула, что и пот-оддсы.
        </p>
      </Section>

      <Section title="EV чистого блефа">
        <p className="text-sm text-stone-300 leading-relaxed">
          Блеф, который не встречает колл, забирает банк; если оппонент коллирует — вы теряете ставку:
          <b className="text-stone-100"> EV = фолд-эквити × банк − (1 − фолд-эквити) × ставка</b>.
          Блеф окупается, когда частота фолдов не ниже <b className="text-stone-100">ставка / (банк + ставка)</b>.
        </p>
      </Section>

      <Section title="Таблица безубыточного блефа">
        <DataTable
          head={['Размер ставки', 'Нужны фолды ≥', 'MDF оппонента']}
          rows={[
            ['⅓ банка', '25%', '75%'],
            ['½ банка', '33.3%', '66.7%'],
            ['¾ банка', '42.9%', '57.1%'],
            ['размер банка', '50%', '50%'],
            ['двойной овербет', '66.7%', '33.3%'],
          ]}
        />
        <p className="text-xs text-stone-400">
          Крупные блефы требуют больше фолдов, но и забирают больше; против оппонентов, которые
          редко сдаются, блефуйте реже и мельче.
        </p>
      </Section>
    </ScenarioCard>
  )
}

function DefenseTopic() {
  return (
    <ScenarioCard className="gap-5">
      <Section title="MDF — минимальная частота защиты">
        <p className="text-sm text-stone-300 leading-relaxed">
          Чтобы блефы оппонента не были автоприбыльными, защищайте не меньше
          <b className="text-stone-100"> MDF = банк / (банк + ставка)</b> рук. Против ставки в полбанка
          фолдите не чаще трети рук (защищайте 66.7%), против овербета 2× банка можно сбрасывать две
          трети — его блефы и так окупаются лишь при 66.7% фолдов.
        </p>
        <p className="text-xs text-stone-400">
          MDF — идеализированная модель: против ленивых оппонентов, которые блефуют слишком редко,
          фолдить больше MDF безопаснее — вы эксплуатируете их пассивность.
        </p>
      </Section>

      <Section title="SPR — соотношение стека к банку">
        <p className="text-sm text-stone-300 leading-relaxed">
          <b className="text-stone-100">SPR = эффективный стек / банк</b> — показывает, сколько
          манёвра осталось на постфлопе. Определяйте его заранее: сильные готовые руки любят
          маленький SPR (легко ставить на стек), спекулятивные — большой.
        </p>
        <DataTable
          head={['SPR', 'Игрок', 'Что это значит']}
          rows={[
            ['< 3', 'маленький', 'привязанность к банку: топ-пары и лучше обычно на стек'],
            ['3–8', 'средний', 'требуется аккуратность: выбирайте линии по текстуре'],
            ['> 8', 'большой', 'простор для манёвра: много улиц, подходят дро и спекулятивные руки'],
          ]}
        />
      </Section>

      <Section title="Шпаргалка на стол">
        <ul className="text-sm text-stone-300 leading-relaxed list-disc pl-5 flex flex-col gap-1">
          <li>Аутсы × 4 на флопе, × 2 на терне — шанс улучшиться.</li>
          <li>Ставка s в банк p — колл прибылен при эквити &gt; s / (p + 2s).</li>
          <li>Блеф окупается при фолдах ≥ s / (p + s); защищайте ≥ p / (p + s).</li>
          <li>SPR = стек / банк — планируйте раздачу до выхода на флоп.</li>
        </ul>
        <p className="text-xs text-stone-400">
          Закрепляйте теорию в тренажёрах: «Аутсы и эквити», «Математика» и «EV-тренажёр»
          генерируют задачи ровно по этим формулам.
        </p>
      </Section>
    </ScenarioCard>
  )
}

export function TheoryView({ onBack }: { onBack: () => void }) {
  const [topic, setTopic] = useState<TopicId>('outs')

  return (
    <TrainerShell
      title="Теория покера"
      subtitle="Аутсы, пот-оддсы, EV, MDF и SPR — краткий справочник с примерами"
      onBack={onBack}
    >
      <div className="flex flex-wrap gap-2">
        {TOPICS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopic(t.id)}
              className={cn(
                'px-3 h-9 rounded-md text-sm font-normal transition flex items-center gap-1.5',
                topic === t.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-stone-300 hover:bg-neutral-700',
              )}
              aria-pressed={topic === t.id}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>
      {topic === 'outs' && <OutsTopic />}
      {topic === 'potOdds' && <PotOddsTopic />}
      {topic === 'ev' && <EvTopic />}
      {topic === 'defense' && <DefenseTopic />}
    </TrainerShell>
  )
}
