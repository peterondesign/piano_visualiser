import * as Tone from 'tone'
import { getSampler } from '../../lib/audio'
import { midiToName } from '../../lib/notes'
import type { Note } from './transcribe'

export type Source = 'original' | 'transcribed'

/**
 * One clock for both sources. In "original" mode the <audio> element is the master clock;
 * in "transcribed" mode a wall-clock anchor drives the sampler.
 */
export class Player {
  readonly audio = new Audio()
  notes: Note[] = []
  duration = 0
  speed = 1
  transpose = 0
  source: Source = 'transcribed'
  loop: { a: number; b: number } | null = null
  playing = false
  onEnd?: () => void

  private anchorTime = 0
  private anchorWall = 0
  private cursor = 0
  private raf = 0
  private sampler: Tone.Sampler | null = null
  private shifter: Tone.PitchShift | null = null

  constructor() {
    this.audio.preload = 'auto'
    this.audio.preservesPitch = true
  }

  load(notes: Note[], duration: number, audioUrl: string | null) {
    this.pause()
    this.notes = notes
    this.duration = duration
    this.audio.src = audioUrl ?? ''
    if (!audioUrl) this.source = 'transcribed'
    this.seek(0)
  }

  hasAudio() {
    return !!this.audio.src && this.audio.src !== location.href
  }

  time(): number {
    if (!this.playing) return this.anchorTime
    if (this.source === 'original') return this.audio.currentTime
    return this.anchorTime + ((performance.now() - this.anchorWall) / 1000) * this.speed
  }

  async play() {
    if (this.playing) return
    this.sampler ??= await getSampler()
    this.ensureShifter()
    if (this.anchorTime >= this.duration - 0.01) this.anchorTime = this.loop?.a ?? 0
    this.playing = true
    this.rebase(this.anchorTime)
    if (this.source === 'original') {
      this.audio.currentTime = this.anchorTime
      this.audio.playbackRate = this.speed
      await this.audio.play().catch(() => {})
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    if (!this.playing) return
    this.anchorTime = this.time()
    this.playing = false
    cancelAnimationFrame(this.raf)
    this.audio.pause()
    this.sampler?.releaseAll()
  }

  seek(t: number) {
    const time = Math.min(Math.max(0, t), this.duration)
    this.sampler?.releaseAll()
    this.rebase(time)
    if (this.hasAudio()) this.audio.currentTime = time
  }

  setSpeed(speed: number) {
    const t = this.time()
    this.speed = speed
    this.audio.playbackRate = speed
    this.rebase(t)
  }

  setTranspose(semitones: number) {
    this.transpose = semitones
    if (this.shifter) {
      this.shifter.pitch = semitones
      this.shifter.wet.value = semitones === 0 ? 0 : 1
    }
  }

  async setSource(source: Source) {
    if (source === this.source) return
    const wasPlaying = this.playing
    const t = this.time()
    this.pause()
    this.source = source
    this.seek(t)
    if (wasPlaying) await this.play()
  }

  dispose() {
    this.pause()
    this.audio.src = ''
  }

  private rebase(t: number) {
    this.anchorTime = t
    this.anchorWall = performance.now()
    this.cursor = this.notes.findIndex((n) => n.start >= t - 0.001)
    if (this.cursor < 0) this.cursor = this.notes.length
  }

  /** Routes the <audio> element through a pitch shifter so transpose applies to the original too. */
  private ensureShifter() {
    if (this.shifter) return
    const ctx = Tone.getContext().rawContext as AudioContext
    const node = ctx.createMediaElementSource(this.audio)
    this.shifter = new Tone.PitchShift({ pitch: this.transpose, wet: this.transpose === 0 ? 0 : 1 })
    this.shifter.toDestination()
    Tone.connect(node, this.shifter)
  }

  private tick = () => {
    if (!this.playing) return
    let t = this.time()

    if (this.loop && t >= this.loop.b) {
      this.seek(this.loop.a)
      t = this.loop.a
    } else if (t >= this.duration) {
      this.pause()
      this.seek(this.duration)
      this.onEnd?.()
      return
    }

    if (this.source === 'transcribed' && this.sampler) {
      while (this.cursor < this.notes.length && this.notes[this.cursor].start <= t) {
        const n = this.notes[this.cursor++]
        const pitch = n.pitch + this.transpose
        if (pitch >= 21 && pitch <= 108 && t - n.start < 0.1) {
          this.sampler.triggerAttackRelease(midiToName(pitch), n.duration / this.speed, Tone.now(), n.velocity)
        }
      }
    }

    this.raf = requestAnimationFrame(this.tick)
  }
}
