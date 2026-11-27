'use client'

// Раздел «Помочь проекту»: добровольная поддержка разработки через Boosty.
// Проект остаётся полностью бесплатным: поддержка не открывает никаких
// дополнительных функций и не убирает ограничений.
import { Heart, ExternalLink, ShieldCheck, Sparkles, Coffee } from 'lucide-react'
import { TrainerShell } from './TrainerShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// TODO: замените на адрес вашей страницы Boosty — создайте страницу на boosty.to
// и подставьте ссылку вида https://boosty.to/ваш-ник
export const BOOSTY_URL = 'https://boosty.to/'

export function DonateView({ onBack }: { onBack: () => void }) {
  return (
    <TrainerShell
      title="Помочь проекту"
      subtitle="Suited остаётся бесплатным — поддержка добровольная"
      onBack={onBack}
    >
      <Card className="border-emerald-900/60 bg-gradient-to-br from-emerald-950/40 to-stone-900/60">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg text-stone-50 font-normal">Поддержать разработку</h2>
          </div>
          <p className="text-sm text-stone-300 leading-relaxed">
            Suited — бесплатный тренажёр: без рекламы, регистрации и подписок. Если занятия
            приносят пользу, можно поддержать проект разовым донатом на Boosty — это помогает
            платить за хостинг и развивать тренажёр.
          </p>
          <ul className="text-xs text-stone-400 list-disc pl-4 flex flex-col gap-1">
            <li>Хостинг и развитие сайта</li>
            <li>Новые режимы, разборы рук и обновления диапазонов</li>
            <li>Время на доработку тренажёров и теории</li>
          </ul>
          <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-500 w-fit">
            <a href={BOOSTY_URL} target="_blank" rel="noopener noreferrer" className="gap-2">
              <Coffee className="w-4 h-4" />
              Поддержать на Boosty
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-stone-800 bg-stone-900/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <h3 className="text-base font-normal text-stone-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Что останется бесплатным
          </h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Всё. Поддержка добровольна и не даёт никаких преимуществ: все режимы, диапазоны
            и статистика открыты каждому без ограничений. Обучение здесь одинаково для всех —
            донат лишь помогает проекту существовать.
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-800 bg-stone-900/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <h3 className="text-base font-normal text-stone-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Другие способы помочь
          </h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Расскажите о тренажёре знакомым, кто учит покер, — обратная связь и рост аудитории
            помогают проекту не меньше донатов. Заметили ошибку в разборе или диапазоне —
            сообщите: это делает тренажёр точнее.
          </p>
        </CardContent>
      </Card>
    </TrainerShell>
  )
}
