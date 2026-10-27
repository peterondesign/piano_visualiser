import { Midi } from '@tonejs/midi'
import type { Note } from './transcribe'

export function exportMidi(notes: Note[], transpose: number, split: number, name: string) {
  const midi = new Midi()
  midi.header.name = name
  const right = midi.addTrack()
  right.name = 'Right hand'
  const left = midi.addTrack()
  left.name = 'Left hand'

  for (const n of notes) {
    const pitch = n.pitch + transpose
    if (pitch < 0 || pitch > 127) continue
    const track = n.pitch >= split ? right : left
    track.addNote({ midi: pitch, time: n.start, duration: n.duration, velocity: n.velocity })
  }

  const blob = new Blob([midi.toArray() as Uint8Array<ArrayBuffer>], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/\.[^.]+$/, '') || 'transcription'}.mid`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
