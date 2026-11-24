// GTO-чарты: что играть и что сбрасывать в зависимости от стола, позиции,
// количества соперников и раунда. Упрощённые ориентиры для обучения.
import { handClass, openRangeClasses, rangePercent, topPercentClasses } from './ranges'
import type { Position } from './ranges'
import { omahaRangeThreshold, handInRange, HOLE_COUNT } from './handRanges'
import type { GameKind } from './handRanges'
import type { Card } from './cards'

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export const STREET_NAMES_RU: Record<Street, string> = {
  preflop: 'Префлоп',
  flop: 'Флоп',
  turn: 'Терн',
  river: 'Ривер',
}

// ---------- Стол и позиции ----------

/** Позиции за столом на N игроков (порядок действия на префлопе). */
export function seatsForTable(players: number): string[] {
  if (players === 2) return ['BTN', 'BB'] // хедз-ап: BTN — он же SB
  const early = players - 3
  const seats: string[] = []
  const earlyNames: Record<number, string[]> = {
    1: ['CO'],
    2: ['MP', 'CO'],
    3: ['UTG', 'MP', 'CO'],
    4: ['UTG', 'MP', 'MP2', 'CO'],
    5: ['UTG', 'MP', 'MP2', 'HJ', 'CO'],
    6: ['UTG', 'UTG1', 'MP', 'MP2', 'HJ', 'CO'],
  }
  seats.push(...(earlyNames[early] ?? []))
  seats.push('BTN', 'SB', 'BB')
  return seats
}

/** Базовая позиция для чартов (MP2/HJ → MP и т.п.). */
export function basePos(seat: string): Position {
  if (seat.startsWith('UTG')) return 'UTG'
  if (seat.startsWith('MP') || seat === 'HJ') return 'MP'
  if (seat === 'CO') return 'CO'
  if (seat.startsWith('BTN')) return 'BTN'
  if (seat.startsWith('SB')) return 'SB'
  return 'BB'
}

export const SEAT_NAMES_RU: Record<string, string> = {
  UTG: 'UTG — под пушкой',
  UTG1: 'UTG1',
  MP: 'MP — средняя',
  MP2: 'MP2',
  HJ: 'HJ — хайджек',
  CO: 'CO — кат-офф',
  BTN: 'BTN — баттон',
  SB: 'SB — малый блайнд',
  BB: 'BB — большой блайнд',
}

/** Масштаб диапазона по размеру стола: чем больше игроков, тем тайтовее. */
export function tableScale(players: number): number {
  return Math.max(0.55, Math.min(1.6, Math.pow(6 / players, 0.7)))
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// ---------- Префлоп: Холдем ----------

const BASE_OPEN_PCT: Partial<Record<Position, number>> = {}

// вычисляется один раз: процент комбинаций правила открытия для 6-max
function baseOpenPct(pos: Position): number {
  if (!BASE_OPEN_PCT[pos]) {
    BASE_OPEN_PCT[pos] = rangePercent(openRangeClasses(pos))
  }
  return BASE_OPEN_PCT[pos]!
}

export interface HoldemPreflop {
  raise: Set<string> // открытие: рейз; vs рейза: 3бет
  call: Set<string> // vs рейза: колл (пусто для открытия)
  raisePct: number
  callPct: number
  mode: 'open' | 'vsraise'
}

export function holdemPreflop(pos: Position, players: number, situation: 'open' | 'vsraise', callers: number): HoldemPreflop {
  const scale = tableScale(players)
  if (situation === 'open') {
    if (players === 6) {
      const set = openRangeClasses(pos)
      return { raise: set, call: new Set(), raisePct: rangePercent(set), callPct: 0, mode: 'open' }
    }
    const pct = clamp(baseOpenPct(pos) * scale, 4, 90)
    return { raise: topPercentClasses(pct), call: new Set(), raisePct: pct, callPct: 0, mode: 'open' }
  }
  // против рейза: 3бет — премиум, колл — играбельное (BB защищается шире)
  const threeBetPct = clamp(8 * Math.min(scale, 1.3), 4, 12)
  const callBase = pos === 'BB' ? 34 : 24
  const multiFactor = Math.max(0.45, 1 - 0.1 * callers)
  const callPct = clamp(callBase * Math.min(scale, 1.2) * multiFactor, 4, 60)
  return { raise: topPercentClasses(threeBetPct), call: topPercentClasses(callPct), raisePct: threeBetPct, callPct, mode: 'vsraise' }
}

export function holdemAction(cls: string, chart: HoldemPreflop): 'raise' | 'call' | 'fold' {
  if (chart.raise.has(cls)) return 'raise'
  if (chart.call.has(cls)) return 'call'
  return 'fold'
}

// ---------- Префлоп: Омаха ----------

const PLO_OPEN: Record<'omaha4' | 'omaha5', Record<Position, number>> = {
  omaha4: { UTG: 18, MP: 25, CO: 33, BTN: 46, SB: 40, BB: 30 },
  omaha5: { UTG: 26, MP: 33, CO: 42, BTN: 55, SB: 48, BB: 38 },
}

const PLO_VSRAISE: Record<'omaha4' | 'omaha5', { threeBet: number; call: number }> = {
  omaha4: { threeBet: 8, call: 26 },
  omaha5: { threeBet: 12, call: 34 },
}

export interface OmahaPreflop {
  mode: 'open' | 'vsraise'
  openPercent: number // для открытия: ширина диапазона рейза
  threeBetPercent: number // для vs-рейза
  callPercent: number
  openThreshold: number
  threeBetThreshold: number
  callThreshold: number
}

export function omahaPreflop(game: 'omaha4' | 'omaha5', pos: Position, players: number, situation: 'open' | 'vsraise', callers: number): OmahaPreflop {
  const scale = tableScale(players)
  if (situation === 'open') {
    const percent = clamp(PLO_OPEN[game][pos] * scale, 5, 90)
    return {
      mode: 'open',
      openPercent: percent,
      threeBetPercent: 0,
      callPercent: 0,
      openThreshold: omahaRangeThreshold(game, percent),
      threeBetThreshold: 0,
      callThreshold: 0,
    }
  }
  const multiFactor = Math.max(0.45, 1 - 0.1 * callers)
  const bbBonus = pos === 'BB' ? 1.5 : 1
  const threeBetPercent = clamp(PLO_VSRAISE[game].threeBet * Math.min(scale, 1.3), 3, 16)
  const callPercent = clamp(PLO_VSRAISE[game].call * Math.min(scale, 1.2) * multiFactor * bbBonus, 5, 75)
  return {
    mode: 'vsraise',
    openPercent: 0,
    threeBetPercent,
    callPercent,
    openThreshold: 0,
    threeBetThreshold: omahaRangeThreshold(game, threeBetPercent),
    callThreshold: omahaRangeThreshold(game, callPercent),
  }
}

export function omahaAction(game: 'omaha4' | 'omaha5', hand: Card[], chart: OmahaPreflop, situation: 'open' | 'vsraise'): 'raise' | 'call' | 'fold' {
  if (situation === 'open') {
    return handInRange(game, hand, chart.openPercent) ? 'raise' : 'fold'
  }
  if (handInRange(game, hand, chart.threeBetPercent)) return 'raise'
  if (handInRange(game, hand, chart.callPercent)) return 'call'
  return 'fold'
}

// ---------- Постфлоп: рекомендации по силе руки ----------

export type TierAction = 'bet' | 'call' | 'fold'

export interface PostflopTier {
  tier: string
  examples: string
  aggressive: string // когда инициатива наша / мы первые говорим
  facingBet: string // против ставки
  action: TierAction // доминирующее действие для цветовой подсветки
}

export interface PostflopGuide {
  intro: string
  gameNote: string
  positionNote: string
  multiwayNote: string
  tiers: PostflopTier[]
}

function positionNote(seat: string): string {
  const p = basePos(seat)
  if (p === 'BTN' || p === 'CO') return 'Вы в позиции на блайндах: можно играть шире, брать банки дешёвыми ставками и блефовать чаще.'
  if (p === 'SB' || p === 'BB') return 'Вы без позиции: играйте пассивнее и тайтовее, выбирайте руки, которые хорошо попадают в доску.'
  return 'Средняя позиция: умеренный стиль — вэлью с сильных рук, быстрые фолды маргинальных.'
}

export function multiwayNote(opponents: number): string {
  if (opponents >= 5) {
    return `Мультпот против ${opponents} оппонентов: играют только натсы. Блефы почти не работают, вторые руки и топ-пары проигрывают.`
  }
  if (opponents >= 3) {
    return `Против ${opponents} оппонентов: нужны руки с натс-потенциалом. Топ-пары и слабые дро теряют ценность, блефы работают хуже.`
  }
  if (opponents === 2) {
    return '2 оппонента: средние руки играбельны, но без позиции — осторожно; блефы умеренно эффективны.'
  }
  return 'Против одного оппонента можно блефовать, тонко вэльюбетить и играть шире.'
}

// --- Холдем: флоп ---
const HOLDEM_FLOP: PostflopTier[] = [
  {
    tier: 'Сет и сильнее',
    examples: 'сеты, две пары, готовые стрит и флеш',
    aggressive: 'Бет и рейз почти всегда: набирайте банк и защищайте руку',
    facingBet: 'Рейз для вэлью; с абсолютными натсами изредка колл (slowplay)',
    action: 'bet',
  },
  {
    tier: 'Сильные дро',
    examples: 'флеш-дро, двусторонний стрит-дро (8+ аутсов)',
    aggressive: 'Полу-блеф бет: фолд-эквити плюс потенциал улучшения',
    facingBet: 'Колл по пот-оддсам; в позиции можно колл с агрессивным планом',
    action: 'call',
  },
  {
    tier: 'Топ-пара и оверпары',
    examples: 'топ-пара с хорошим кикером, пары выше доски',
    aggressive: 'Бет для вэлью; против 1 оппонента — тонкий вэлью-бет',
    facingBet: 'Колл против 1–2 оппонентов; крейзу без кикера предпочитайте фолд',
    action: 'call',
  },
  {
    tier: 'Средние руки',
    examples: 'вторая/третья пара, гатшот, бэкдор-дро',
    aggressive: 'Чек-колл против малых ставок, чек-фолд против больших',
    facingBet: 'Дешёвый колл только против 1 оппонента; в мультпотах — фолд',
    action: 'call',
  },
  {
    tier: 'Воздух',
    examples: 'нет пары и дро',
    aggressive: 'Чек-фолд; изредка блеф в позиции против 1 оппонента',
    facingBet: 'Фолд',
    action: 'fold',
  },
]

// --- Холдем: терн ---
const HOLDEM_TURN: PostflopTier[] = [
  {
    tier: 'Натсы и сильные готовые',
    examples: 'сеты, две пары, стрит, флеш',
    aggressive: 'Бет крупно: на терне банк растёт быстрее всего',
    facingBet: 'Колл или рейз; пассивность с натсами теряет вэлью',
    action: 'bet',
  },
  {
    tier: 'Дро и комбо-дро',
    examples: 'флеш-дро, стрит-дро, их сочетания',
    aggressive: 'Бет-полу-блеф или колл по имплайд-оддсам',
    facingBet: 'Колл, если пот-оддсы с учётом аутсов сходятся; иначе фолд',
    action: 'call',
  },
  {
    tier: 'Средние готовые',
    examples: 'топ-пара слабый кикер, вторая пара',
    aggressive: 'Чек-колл одной ставки; против повторной агрессии — фолд',
    facingBet: 'Колл одной ставки; в мультпотах чаще фолд',
    action: 'call',
  },
  {
    tier: 'Слабые руки',
    examples: 'третья пара и ниже, погибшие дро',
    aggressive: 'Чек-фолд',
    facingBet: 'Фолд; крупный рейз-блеф только против 1 оппонента',
    action: 'fold',
  },
]

// --- Холдем: ривер ---
const HOLDEM_RIVER: PostflopTier[] = [
  {
    tier: 'Натсы',
    examples: 'стрит и сильнее, топ-пары с сильным кикером',
    aggressive: 'Бет для вэлью максимального размера',
    facingBet: 'Рейз или колл — зависимость от линии оппонента',
    action: 'bet',
  },
  {
    tier: 'Готовые руки средней силы',
    examples: 'средние пары, две слабые пары',
    aggressive: 'Чек для контроля банка или тонкий вэлью-бет против 1',
    facingBet: 'Колл против 1 оппонента; в мультпотах — фолд',
    action: 'call',
  },
  {
    tier: 'Блеф-кетчеры',
    examples: 'вторые пары, низкие пары',
    aggressive: 'Чек-фолд к ставке; чек и надежда на чек-даун',
    facingBet: 'Фолд против крупной ставки; колл только против пассивных оппонентов',
    action: 'fold',
  },
  {
    tier: 'Воздух',
    examples: 'ничего не попало',
    aggressive: 'Против 1 оппонента — блеф-ставка в подходящей линии; иначе чек-фолд',
    facingBet: 'Фолд',
    action: 'fold',
  },
]

// --- Омаха: флоп ---
const OMAHA_FLOP: PostflopTier[] = [
  {
    tier: 'Натсы и близкие к ним',
    examples: 'топ-сет с редро, натсовый стрит/флеш + дро',
    aggressive: 'Бет и рейз без ограничений — в Омахе нужны лучшие руки',
    facingBet: 'Рейз для вэлью; защитите банк от дро',
    action: 'bet',
  },
  {
    tier: 'Сильные дро и сильные готовые',
    examples: 'комбо-дро 20+ аутсов, сеты без редро, старшие дро',
    aggressive: 'Бет: много эквити и фолд-эквити',
    facingBet: 'Колл или рейз по имплайд-оддсам',
    action: 'call',
  },
  {
    tier: 'Средние готовые',
    examples: 'низкие сеты, вторые флеш-дро, средние стриты',
    aggressive: 'Чек-колл; берегитесь доминирования более старших рук',
    facingBet: 'Колл одной ставки в позиции; иначе осторожно',
    action: 'call',
  },
  {
    tier: 'Топ-пара и слабые руки',
    examples: 'топ-пара, низкие пары, гатшоты',
    aggressive: 'Чек-фолд: в Омахе топ-пара редко выигрывает банк',
    facingBet: 'Фолд против ставки; колл только минимальный',
    action: 'fold',
  },
]

// --- Омаха: терн ---
const OMAHA_TURN: PostflopTier[] = [
  {
    tier: 'Натсы',
    examples: 'старший сет, натс-стрит, натс-флеш, их сочетания',
    aggressive: 'Бет крупно, рейз против агрессии',
    facingBet: 'Рейз или колл — терн решает банк в Омахе',
    action: 'bet',
  },
  {
    tier: 'Сильные дро',
    examples: 'комбо-дро, 16+ аутсов к натсам',
    aggressive: 'Полу-блеф бет или колл по оддсам',
    facingBet: 'Колл, если аутсы чистые и оддсы сходятся',
    action: 'call',
  },
  {
    tier: 'Вторые руки',
    examples: 'второй сет, второй флеш, средний стрит',
    aggressive: 'Чек-колл одной ставки, не раздувайте банк',
    facingBet: 'Колл одной ставки; против рейза — фолд',
    action: 'call',
  },
  {
    tier: 'Слабые и погибшие руки',
    examples: 'топ-пара, низкие дро, воздух',
    aggressive: 'Чек-фолд',
    facingBet: 'Фолд',
    action: 'fold',
  },
]

// --- Омаха: ривер ---
const OMAHA_RIVER: PostflopTier[] = [
  {
    tier: 'Натсы',
    examples: 'натс-фулл, старший стрит/флеш, каре',
    aggressive: 'Бет максимального размера для вэлью',
    facingBet: 'Колл или рейз',
    action: 'bet',
  },
  {
    tier: 'Близкие к натсам',
    examples: 'второй натс, младшие фулл-хаусы',
    aggressive: 'Чек-колл или тонкий вэлью-бет против 1',
    facingBet: 'Колл против 1 оппонента; в мультпотах осторожно',
    action: 'call',
  },
  {
    tier: 'Вторые руки',
    examples: 'второй стрит, низкие фуллы, блеф-кетчеры',
    aggressive: 'Чек-колл одной ставки; не иницируйте крупные банки',
    facingBet: 'Колл против 1 пассивного оппонента; против агрессии — фолд',
    action: 'call',
  },
  {
    tier: 'Слабые руки и воздух',
    examples: 'пары ниже доски, ничто не попало',
    aggressive: 'Чек-фолд; блеф — только против 1 оппонента в подходящей линии',
    facingBet: 'Фолд',
    action: 'fold',
  },
]

const GUIDES: Record<string, PostflopTier[]> = {
  'holdem:flop': HOLDEM_FLOP,
  'holdem:turn': HOLDEM_TURN,
  'holdem:river': HOLDEM_RIVER,
  'omaha4:flop': OMAHA_FLOP,
  'omaha4:turn': OMAHA_TURN,
  'omaha4:river': OMAHA_RIVER,
  'omaha5:flop': OMAHA_FLOP,
  'omaha5:turn': OMAHA_TURN,
  'omaha5:river': OMAHA_RIVER,
}

export function postflopGuide(game: GameKind, street: Exclude<Street, 'preflop'>, opponents: number, seat: string): PostflopGuide {
  const tiers = GUIDES[`${game}:${street}`] ?? HOLDEM_FLOP
  const omahaNote = game !== 'holdem'
    ? 'Особенность Омахи: сильные готовые руки появляются у многих игроков, поэтому играют только натсы, а «почти натсы» играют пассивно.'
    : 'Особенность Холдема: одна пара часто достаточна против 1 оппонента, но слаба в мультпотах.'
  return {
    intro: `${STREET_NAMES_RU[street]}, ${opponents} ${opponents === 1 ? 'оппонент' : 'оппонентов'} в банке. Ориентир по силе руки:`,
    gameNote: omahaNote,
    positionNote: positionNote(seat),
    multiwayNote: multiwayNote(opponents),
    tiers: [...tiers],
  }
}

/**
 * Ориентир из GTO-чарта для Омахи по вердикту решения:
 * raise → верхний тир (натсы), call → средний, fold → нижний.
 * Используется симулятором раздач для связи с разделом GTO.
 */
export function omahaEquityTier(game: 'omaha4' | 'omaha5', street: Exclude<Street, 'preflop'>, verdict: 'raise' | 'call' | 'fold'): PostflopTier {
  const tiers = GUIDES[`${game}:${street}`] ?? OMAHA_FLOP
  if (verdict === 'raise') return tiers[0]
  if (verdict === 'call') return tiers[1]
  return tiers[tiers.length - 1]
}

// ---------- Префлоп: текстовые принципы ----------

export function preflopNotes(game: GameKind, pos: Position, situation: 'open' | 'vsraise', callers: number): string[] {
  const notes: string[] = []
  if (game === 'holdem') {
    if (situation === 'open') {
      notes.push('Открытие рейзом 2–3bb: чем раньше позиция, тем тайтовее диапазон.')
      if (pos === 'BTN') notes.push('С баттона открывается самый широкий диапазон — вы играете в позиции на всех блайндах.')
      if (pos === 'UTG') notes.push('С UTG после вас до 8 игроков: нужна сила руки, а не потенциал.')
      if (pos === 'SB') notes.push('С SB против одного BB можно открывать шире, но без позиции постфлоп сложнее.')
    } else {
      notes.push('Против рейза: премиум — 3бет, играбельные — колл, остальное — фолд.')
      if (callers > 0) notes.push(`Рейз уже поддержали ${callers} ${callers === 1 ? 'игрок' : 'игрока'}: коллы требуют более сильных рук, мультпот — для натс-потенциала.`)
      if (pos === 'BB') notes.push('BB защищается шире всех — колл со скидкой блайнда.')
      if (pos === 'BTN') notes.push('С баттона против рейза много коллов в позиции и 3беты с премиумом.')
    }
  } else {
    if (situation === 'open') {
      notes.push('В Омахе открывайте координированные руки: тузы, мастевость и связки вместе сильнее, чем по отдельности.')
      if (pos === 'UTG') notes.push('С UTG — тайтово: двойномастные тузы, бродвей-связки, высокие пары.')
      if (pos === 'BTN') notes.push('С баттона — самый широкий диапазон: все двойномастные, связки, пары и A-хай руки.')
      if (pos === 'SB') notes.push('С SB открывайте чуть тайтовее BTN: без позиции играется сложнее.')
      notes.push(`Ориентир: примерно топ ${Math.round(PLO_OPEN[game as 'omaha4' | 'omaha5'][pos] * tableScale(6))}% рук для этой позиции за столом 6-max.`)
    } else {
      notes.push('Против рейза в Омахе: 3бет — только премиум (AAxx, AKQJ ds, высокие связки), играбельное — колл, слабое — фолд.')
      if (callers > 0) notes.push(`В банке уже ${callers + 1} ${callers + 1 === 1 ? 'игрок' : 'игроков'}: коллируйте руки с натс-потенциалом, маргинальные — фолд.`)
      if (pos === 'BB') notes.push('BB защищается шире всех: скидка блайнда делает колл прибыльным.')
      notes.push('Изолированные тузы (AAxx без мастей/связок) в Омахе — рука «на один постфлоп»: не переоценивайте их.')
    }
  }
  return notes
}
