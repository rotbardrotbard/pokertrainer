// Игральная карта: rank 2..14 (2,3,4,5,6,7,8,9,T,J,Q,K,A), suit 0..3
export interface Card {
  r: number
  s: number
}

export const SUIT_SYMBOLS = ['\u2660', '\u2665', '\u2666', '\u2663'] as const // ♠ ♥ ♦ ♣
export const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const

export const RANK_NAMES_NOM: Record<number, string> = {
  14: 'туз', 13: 'король', 12: 'дама', 11: 'валет', 10: 'десятка',
  9: 'девятка', 8: 'восьмёрка', 7: 'семёрка', 6: 'шестёрка',
  5: 'пятёрка', 4: 'четвёрка', 3: 'тройка', 2: 'двойка',
}
export const RANK_NAMES_GEN_PL: Record<number, string> = {
  14: 'тузов', 13: 'королей', 12: 'дам', 11: 'валетов', 10: 'десяток',
  9: 'девяток', 8: 'восьмёрок', 7: 'семёрок', 6: 'шестёрок',
  5: 'пятёрок', 4: 'четвёрок', 3: 'троек', 2: 'двоек',
}
export const RANK_NAMES_RU: Record<number, string> = {
  14: 'Туз', 13: 'Король', 12: 'Дама', 11: 'Валет', 10: 'Десятка',
  9: 'Девятка', 8: 'Восьмёрка', 7: 'Семёрка', 6: 'Шестёрка',
  5: 'Пятёрка', 4: 'Четвёрка', 3: 'Тройка', 2: 'Двойка',
}

export function cardToString(c: Card): string {
  return RANK_CHARS[c.r - 2] + SUIT_SYMBOLS[c.s]
}

export function cardToCode(c: Card): string {
  return RANK_CHARS[c.r - 2] + 'shdc'[c.s]
}

export function parseCard(code: string): Card | null {
  if (code.length !== 2) return null
  const ri = RANK_CHARS.indexOf(code[0].toUpperCase() as (typeof RANK_CHARS)[number])
  const si = 'shdc'.indexOf(code[1].toLowerCase())
  if (ri < 0 || si < 0) return null
  return { r: ri + 2, s: si }
}

export function fullDeck(): Card[] {
  const deck: Card[] = []
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s })
  return deck
}

/** Fisher-Yates (возвращает копию) */
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardsOverlap(cards: Card[]): boolean {
  const seen = new Set<string>()
  for (const c of cards) {
    const k = cardToCode(c)
    if (seen.has(k)) return true
    seen.add(k)
  }
  return false
}

/** Случайная раздача: hero 2 карты + опционально villain 2 карты + доска n карт */
export function dealRandom(opts: { board?: number; villain?: boolean; rand?: () => number }): {
  hero: Card[]
  villain: Card[] | null
  board: Card[]
} {
  const rand = opts.rand ?? Math.random
  const deck = shuffle(fullDeck(), rand)
  const hero = [deck[0], deck[1]]
  let idx = 2
  let villain: Card[] | null = null
  if (opts.villain) {
    villain = [deck[2], deck[3]]
    idx = 4
  }
  const boardCount = opts.board ?? 0
  const board = deck.slice(idx, idx + boardCount)
  return { hero, villain, board }
}

/** Название масти по-русски (для объяснений) */
export const SUIT_NAMES_RU = ['пики', 'червы', 'бубны', 'трефы'] as const
