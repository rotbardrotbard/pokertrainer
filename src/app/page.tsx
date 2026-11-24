'use client'

// Покер Тренажёр — главный экран с переключением режимов
import { useState, useEffect } from 'react'
import { HomeView, ViewId } from '@/components/poker/HomeView'
import { SimulatorView } from '@/components/poker/SimulatorView'
import { MathTrainerView } from '@/components/poker/MathTrainerView'
import { OutsTrainerView } from '@/components/poker/OutsTrainerView'
import { EvTrainerView } from '@/components/poker/EvTrainerView'
import { WinnerTrainerView } from '@/components/poker/WinnerTrainerView'
import { ComboTrainerView } from '@/components/poker/ComboTrainerView'
import { OmahaTrainerView } from '@/components/poker/OmahaTrainerView'
import { RangesView } from '@/components/poker/RangesView'
import { CalculatorView } from '@/components/poker/CalculatorView'

export default function Home() {
  const [view, setView] = useState<ViewId>('home')

  // прокрутка вверх при смене экрана
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  function back() {
    setView('home')
  }

  switch (view) {
    case 'sim':
      return <SimulatorView onBack={back} />
    case 'math':
      return <MathTrainerView onBack={back} />
    case 'outs':
      return <OutsTrainerView onBack={back} />
    case 'ev':
      return <EvTrainerView onBack={back} />
    case 'winner':
      return <WinnerTrainerView onBack={back} />
    case 'combo':
      return <ComboTrainerView onBack={back} />
    case 'omaha':
      return <OmahaTrainerView variant="classic" onBack={back} />
    case 'omaha4':
      return <OmahaTrainerView variant="double4" onBack={back} />
    case 'omaha5':
      return <OmahaTrainerView variant="double5" onBack={back} />
    case 'ranges':
      return <RangesView onBack={back} />
    case 'calculator':
      return <CalculatorView onBack={back} />
    default:
      return <HomeView onSelect={setView} />
  }
}
