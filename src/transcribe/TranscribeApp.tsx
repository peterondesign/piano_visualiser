import { useEffect, useMemo, useRef, useState } from 'react'
import { PianoRoll, LEFT_COLOR, RIGHT_COLOR } from './PianoRoll'
import { deleteAudio, getAudio, loadRecents, putAudio, saveRecents, type Project } from './lib/library'
import { exportMidi } from './lib/midi'
import { Player, type Source } from './lib/player'
import { decodeFile, transcribe } from './lib/transcribe'
import { midiToName } from '../lib/notes'

const ACCEPT = '.mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a'
const SPEEDS = [0.5, 0.75, 1, 1.25]

type Status = { kind: 'idle' } | { kind: 'working'; label: string; progress: number } | { kind: 'error'; message: string }

function fmt(t: number) {
  const s = Math.max(0, t)
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export default function TranscribeApp() {
  const player = useMemo(() => new Player(), [])
  const [recents, setRecents] = useState<Project[]>(() => loadRecents())
  const [project, setProject] = useState<Project | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [source, setSource] = useState<Source>('transcribed')
  const [speed, setSpeed] = useState(1)
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const [loopOn, setLoopOn] = useState(false)
  const [colorHands, setColorHands] = useState(true)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    player.onEnd = () => setPlaying(false)
    let raf = 0
    const tick = () => {
      setTime(player.time())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      player.dispose()
    }
  }, [player])

  useEffect(() => {
    player.loop = loopOn && loopA !== null && loopB !== null && loopB > loopA ? { a: loopA, b: loopB } : null
  }, [player, loopOn, loopA, loopB])

  function updateProject(patch: Partial<Project>) {
    if (!project) return
    const next = { ...project, ...patch }
    setProject(next)
    setRecents((list) => saveRecents(list.map((p) => (p.id === next.id ? next : p))))
  }

  function openProject(p: Project, url: string | null) {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    player.load(p.notes, p.duration, url)
    player.setTranspose(p.transpose)
    player.setSpeed(speed)
    setProject(p)
    setAudioUrl(url)
    setSource(player.source)
    setPlaying(false)
    setLoopA(null)
    setLoopB(null)
    setLoopOn(false)
  }

  async function handleFile(file: File) {
    if (!/\.(mp3|wav|m4a)$/i.test(file.name) && !file.type.startsWith('audio/')) {
      setStatus({ kind: 'error', message: 'Please choose an mp3, wav or m4a file.' })
      return
    }
    try {
      setStatus({ kind: 'working', label: 'Decoding audio…', progress: 0 })
      const buffer = await decodeFile(file)
      setStatus({ kind: 'working', label: 'Transcribing notes…', progress: 0 })
      const notes = await transcribe(buffer, (p) =>
        setStatus({ kind: 'working', label: 'Transcribing notes…', progress: p }),
      )
      const p: Project = {
        id: crypto.randomUUID(),
        name: file.name,
        created: Date.now(),
        duration: buffer.duration,
        notes,
        transpose: 0,
        split: 60,
      }
      await putAudio(p.id, file).catch(() => {})
      setRecents((list) => saveRecents([p, ...list]))
      openProject(p, URL.createObjectURL(file))
      setStatus({ kind: 'idle' })
    } catch (err) {
      console.error(err)
      setStatus({ kind: 'error', message: `Couldn't transcribe this file: ${(err as Error).message}` })
    }
  }

  async function openRecent(p: Project) {
    const blob = await getAudio(p.id).catch(() => undefined)
    openProject(p, blob ? URL.createObjectURL(blob) : null)
  }

  function removeRecent(id: string) {
    setRecents((list) => saveRecents(list.filter((p) => p.id !== id)))
    void deleteAudio(id).catch(() => {})
    if (project?.id === id) {
      player.load([], 0, null)
      setProject(null)
    }
  }

  async function togglePlay() {
    if (player.playing) {
      player.pause()
      setPlaying(false)
    } else {
      await player.play()
      setPlaying(true)
    }
  }

  function restart() {
    player.seek(player.loop?.a ?? 0)
  }

  async function changeSource(s: Source) {
    await player.setSource(s)
    setSource(s)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!project || (e.target as HTMLElement).tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        void togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const busy = status.kind === 'working'
  const duration = project?.duration ?? 0

  return (
    <div
      className="tx"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file && !busy) void handleFile(file)
      }}
    >
      <aside className="tx-side">
        <a className="tx-back" href="/">← Chord Builder</a>
        <h1>Transcribe</h1>
        <button className="tx-upload" disabled={busy} onClick={() => fileInput.current?.click()}>
          Upload audio
        </button>
        <p className="tx-hint">mp3, wav or m4a · or drop a file anywhere</p>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />

        <h2>Recents</h2>
        {recents.length === 0 && <p className="tx-hint">Transcriptions you make are saved here.</p>}
        <ul className="tx-recents">
          {recents.map((p) => (
            <li key={p.id} className={p.id === project?.id ? 'on' : ''}>
              <button className="tx-recent" onClick={() => void openRecent(p)}>
                <span>{p.name}</span>
                <small>
                  {fmt(p.duration)} · {p.notes.length} notes · {new Date(p.created).toLocaleDateString()}
                </small>
              </button>
              <button className="tx-x" aria-label="Delete" onClick={() => removeRecent(p.id)}>×</button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="tx-main">
        <div className="tx-stage">
          <PianoRoll player={player} split={project?.split ?? 60} colorHands={colorHands} />
          {!project && !busy && (
            <div className="tx-empty">
              <p>Upload a piano recording to see it as falling notes.</p>
              <button className="tx-upload" onClick={() => fileInput.current?.click()}>Choose file</button>
            </div>
          )}
          {busy && (
            <div className="tx-empty">
              <p>{status.label}</p>
              <div className="tx-bar"><div style={{ width: `${Math.round(status.progress * 100)}%` }} /></div>
            </div>
          )}
          {dragging && <div className="tx-drop">Drop to transcribe</div>}
        </div>

        {status.kind === 'error' && (
          <div className="tx-error" onClick={() => setStatus({ kind: 'idle' })}>{status.message}</div>
        )}

        {project && (
          <div className="tx-controls">
            <div className="tx-scrub">
              <span>{fmt(time)}</span>
              <div className="tx-scrub-track">
                {loopA !== null && loopB !== null && loopB > loopA && (
                  <div
                    className={`tx-loop ${loopOn ? 'on' : ''}`}
                    style={{ left: `${(loopA / duration) * 100}%`, width: `${((loopB - loopA) / duration) * 100}%` }}
                  />
                )}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={time}
                  onChange={(e) => player.seek(Number(e.target.value))}
                />
              </div>
              <span>{fmt(duration)}</span>
            </div>

            <div className="tx-row">
              <div className="tx-group">
                <button className="tx-btn" onClick={restart} title="Restart">⏮</button>
                <button className="tx-btn tx-play" onClick={() => void togglePlay()} title="Play / pause (space)">
                  {playing ? '❚❚' : '▶'}
                </button>
              </div>

              <div className="tx-group" title="Compare the recording with the transcription">
                <button
                  className={`tx-seg ${source === 'original' ? 'on' : ''}`}
                  disabled={!audioUrl}
                  onClick={() => void changeSource('original')}
                >
                  Original
                </button>
                <button
                  className={`tx-seg ${source === 'transcribed' ? 'on' : ''}`}
                  onClick={() => void changeSource('transcribed')}
                >
                  Transcribed
                </button>
              </div>

              <div className="tx-group">
                <span className="tx-label">Speed</span>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    className={`tx-seg ${speed === s ? 'on' : ''}`}
                    onClick={() => {
                      player.setSpeed(s)
                      setSpeed(s)
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              <div className="tx-group">
                <span className="tx-label">Loop</span>
                <button className="tx-seg" onClick={() => setLoopA(player.time())}>
                  A {loopA !== null ? fmt(loopA) : ''}
                </button>
                <button className="tx-seg" onClick={() => {
                  setLoopB(player.time())
                  setLoopOn(true)
                }}>
                  B {loopB !== null ? fmt(loopB) : ''}
                </button>
                <button
                  className={`tx-seg ${loopOn ? 'on' : ''}`}
                  disabled={loopA === null || loopB === null || loopB <= loopA}
                  onClick={() => setLoopOn((v) => !v)}
                >
                  Repeat
                </button>
                <button className="tx-seg" onClick={() => {
                  setLoopA(null)
                  setLoopB(null)
                  setLoopOn(false)
                }}>
                  Clear
                </button>
              </div>
            </div>

            <div className="tx-row">
              <label className="tx-group tx-slider">
                <span className="tx-label">Transpose {project.transpose > 0 ? '+' : ''}{project.transpose}</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={project.transpose}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    player.setTranspose(v)
                    updateProject({ transpose: v })
                  }}
                />
              </label>

              <label className="tx-group tx-slider">
                <span className="tx-label">
                  <input type="checkbox" checked={colorHands} onChange={(e) => setColorHands(e.target.checked)} />
                  Hands · split at {midiToName(project.split)}
                  <i style={{ background: LEFT_COLOR }} /> L
                  <i style={{ background: RIGHT_COLOR }} /> R
                </span>
                <input
                  type="range"
                  min={36}
                  max={84}
                  step={1}
                  value={project.split}
                  disabled={!colorHands}
                  onChange={(e) => updateProject({ split: Number(e.target.value) })}
                />
              </label>

              <button
                className="tx-upload"
                onClick={() => exportMidi(project.notes, project.transpose, project.split, project.name)}
              >
                Download MIDI
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
