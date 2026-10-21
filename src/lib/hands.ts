import { WHITE_KEYS, blackCenter, isBlackKey } from './notes'

/** C3 */
export const SPLIT_MIDI = 48
export const WHITE_KEY_WIDTH = 1 / WHITE_KEYS.length

export type HandName = 'lh' | 'rh'

export type FingerAnchor = {
  midi: number
  finger: number
  x: number
  y: number
}

export type HandPlacement = {
  hand: HandName
  pose: number
  anchors: FingerAnchor[]
}

const FINGER_SETS: Record<number, number[]> = {
  1: [1],
  2: [1, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
}

export function keyCenter(midi: number): { x: number; y: number } {
  if (isBlackKey(midi)) return { x: blackCenter(midi), y: 0.42 }
  const index = WHITE_KEYS.indexOf(midi)
  return { x: (index + 0.5) / WHITE_KEYS.length, y: 0.78 }
}

function whiteSpan(notes: number[]): number {
  const indexes = notes.map((note) => WHITE_KEYS.filter((key) => key <= note).length)
  return Math.max(...indexes) - Math.min(...indexes)
}

function overflows(notes: number[]): boolean {
  if (notes.length > 5) return true
  if (whiteSpan(notes) > 5) return true
  return notes.some((note) => notes.filter((other) => other >= note && other < note + 12).length > 5)
}

const POSES: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9, 10],
  4: [11, 12, 13],
  5: [14, 15, 16],
}

function poseFor(notes: number[]): number {
  const sorted = [...notes].sort((a, b) => a - b)
  const count = Math.min(5, Math.max(1, sorted.length))
  const span = sorted[sorted.length - 1] - sorted[0]
  const width = span <= 4 ? 0 : span <= 8 ? 1 : 2
  const row = POSES[count]
  return row[Math.min(width, row.length - 1)]
}

function assignFingers(notes: number[], hand: HandName): FingerAnchor[] {
  const sorted = [...notes].sort((a, b) => a - b).slice(0, 5)
  const fingers = [...(FINGER_SETS[sorted.length] ?? FINGER_SETS[5])]
  if (hand === 'lh') fingers.reverse()
  return sorted.map((midi, index) => {
    const point = keyCenter(midi)
    return { midi, finger: fingers[index], x: point.x, y: point.y }
  })
}

/** Notes below C3 are left hand. C3 and above are right hand. A reach wider than five keys uses both hands. */
export function placeHands(notes: number[]): HandPlacement[] {
  const sorted = [...new Set(notes)].sort((a, b) => a - b)
  if (sorted.length === 0) return []

  const lh: number[] = sorted.filter((note) => note < SPLIT_MIDI)
  const rh: number[] = sorted.filter((note) => note >= SPLIT_MIDI)

  while (lh.length && overflows(lh)) rh.unshift(lh.pop()!)
  while (rh.length && overflows(rh)) lh.push(rh.shift()!)

  const placements: HandPlacement[] = []
  if (lh.length) placements.push({ hand: 'lh', pose: poseFor(lh), anchors: assignFingers(lh, 'lh') })
  if (rh.length) placements.push({ hand: 'rh', pose: poseFor(rh), anchors: assignFingers(rh, 'rh') })
  return placements
}

export function handImage(hand: HandName, pose: number): string {
  return `/hands/${hand}-${String(pose).padStart(2, '0')}.png`
}
