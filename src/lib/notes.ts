export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** 61-key range: C2–C7 */
export const FIRST_MIDI = 36
export const LAST_MIDI = 96

const BLACK_PCS = new Set([1, 3, 6, 8, 10])

export function midiToName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PCS.has(((midi % 12) + 12) % 12)
}

export function label(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12]
}

export const KEYS: number[] = Array.from({ length: LAST_MIDI - FIRST_MIDI + 1 }, (_, i) => FIRST_MIDI + i)

export const WHITE_KEYS = KEYS.filter((m) => !isBlackKey(m))
export const BLACK_KEYS = KEYS.filter((m) => isBlackKey(m))

/** Horizontal center of a black key as a fraction of the keyboard width. */
export function blackCenter(midi: number): number {
  const whitesBefore = WHITE_KEYS.filter((w) => w < midi).length
  return whitesBefore / WHITE_KEYS.length
}
