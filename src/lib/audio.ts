import * as Tone from 'tone'
import { midiToName } from './notes'

let sampler: Tone.Sampler | null = null
let starting: Promise<void> | null = null

const SALAMANDER: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
}

export async function ensureAudio(): Promise<void> {
  if (sampler && Tone.getContext().state === 'running') return
  if (!starting) {
    starting = (async () => {
      await Tone.start()
      if (!sampler) {
        sampler = new Tone.Sampler({
          urls: SALAMANDER,
          baseUrl: 'https://tonejs.github.io/audio/salamander/',
          release: 1.2,
        }).toDestination()
        sampler.volume.value = -4
        await Tone.loaded()
      }
    })()
  }
  await starting
}

export async function playChord(midi: number[]): Promise<void> {
  if (midi.length === 0) return
  await ensureAudio()
  const names = midi.map((m) => midiToName(m))
  sampler?.triggerAttackRelease(names, 1.8, Tone.now(), 0.9)
}
