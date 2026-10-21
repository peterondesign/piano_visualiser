export type Chord = { id: string; notes: number[] }

export type Song = {
  id: string
  name: string
  chords: Chord[]
  updated: number
}

const SONGS_KEY = 'chord-builder-songs'
const PREFS_KEY = 'chord-builder-prefs'

export type Prefs = { dark: boolean; labelsOn: boolean; handsOn: boolean }

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptyChord(): Chord {
  return { id: newId(), notes: [] }
}

export function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(SONGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Song[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((song) => song && typeof song.name === 'string' && Array.isArray(song.chords))
  } catch {
    return []
  }
}

export function saveSongs(songs: Song[]): void {
  localStorage.setItem(SONGS_KEY, JSON.stringify(songs))
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { dark: false, labelsOn: true, handsOn: false }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      dark: Boolean(parsed.dark),
      labelsOn: parsed.labelsOn !== false,
      handsOn: Boolean(parsed.handsOn),
    }
  } catch {
    return { dark: false, labelsOn: true, handsOn: false }
  }
}

export function savePrefs(prefs: Prefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}
