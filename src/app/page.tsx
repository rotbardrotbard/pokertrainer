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
import { OmahaSimView } from '@/components/poker/OmahaSimView'
import { RangesView } from '@/components/poker/RangesView'
import { CalculatorView } from '@/components/poker/CalculatorView'
import { GtoView } from '@/components/poker/GtoView'
import type { GtoInitial } from '@/components/poker/GtoView'

export default function Home() {
  const [view, setView] = useState<ViewId>('home')
  const [gtoInit, setGtoInit] = useState<GtoInitial | null>(null)

  // прокрутка вверх при смене экрана
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  function back() {
    setView('home')
  }

  // переход в GTO-чарты с предустановкой из симулятора раздач
  function openGto(init: GtoInitial) {
    setGtoInit(init)
    setView('gto')
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
    case 'omaha4sim':
      return <OmahaSimView variant="double4" onBack={back} onOpenGto={openGto} />
    case 'omaha5sim':
      return <OmahaSimView variant="double5" onBack={back} onOpenGto={openGto} />
    case 'ranges':
      return <RangesView onBack={back} />
    case 'gto':
      return <GtoView onBack={back} initial={gtoInit} />
    case 'calculator':
      return <CalculatorView onBack={back} />
    default:
      return <HomeView onSelect={setView} />
  }
}
