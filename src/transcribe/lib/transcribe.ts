import type { BasicPitch } from '@spotify/basic-pitch'

export interface Note {
  pitch: number
  start: number
  duration: number
  velocity: number
}

const MODEL_URL = '/basic-pitch/model.json'
const MODEL_SAMPLE_RATE = 22050

let model: BasicPitch | null = null

export async function decodeFile(file: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer())
  } finally {
    void ctx.close()
  }
}

async function toModelInput(buffer: AudioBuffer): Promise<Float32Array> {
  const length = Math.ceil(buffer.duration * MODEL_SAMPLE_RATE)
  const offline = new OfflineAudioContext(1, length, MODEL_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = buffer
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export async function transcribe(
  buffer: AudioBuffer,
  onProgress: (fraction: number) => void,
): Promise<Note[]> {
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } = await import(
    '@spotify/basic-pitch'
  )
  model ??= new BasicPitch(MODEL_URL)
  const input = await toModelInput(buffer)

  const frames: number[][] = []
  const onsets: number[][] = []
  const contours: number[][] = []
  await model.evaluateModel(
    input,
    (f, o, c) => {
      frames.push(...f)
      onsets.push(...o)
      contours.push(...c)
    },
    onProgress,
  )

  // Stricter than the library defaults: only confident onsets inside the piano range,
  // and short low-energy tails are cut off instead of becoming extra notes.
  const events = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.7, 0.45, 10, true, 4200, 27, true, 4),
    ),
  )

  const notes = events
    .map((e) => ({
      pitch: e.pitchMidi,
      start: e.startTimeSeconds,
      duration: e.durationSeconds,
      velocity: e.amplitude,
    }))
    .filter((n) => n.pitch >= 21 && n.pitch <= 108 && n.duration >= 0.07 && n.velocity >= 0.35)

  return dropHarmonicGhosts(notes).sort((a, b) => a.start - b.start)
}

const HARMONIC_INTERVALS = new Set([12, 19, 24])

/** A quiet note sitting on top of a louder one an octave or a twelfth away is a harmonic, not a key. */
function dropHarmonicGhosts(notes: Note[]): Note[] {
  return notes.filter((note) => {
    const ghost = notes.some(
      (other) =>
        other !== note &&
        other.velocity > note.velocity * 1.4 &&
        HARMONIC_INTERVALS.has(note.pitch - other.pitch) &&
        note.start < other.start + other.duration &&
        other.start < note.start + note.duration,
    )
    return !ghost
  })
}
