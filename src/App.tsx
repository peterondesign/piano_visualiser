import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { HandOverlay } from './components/HandOverlay'
import { playChord } from './lib/audio'
import { BLACK_KEYS, WHITE_KEYS, blackCenter, label } from './lib/notes'
import {
  emptyChord,
  loadPrefs,
  loadSongs,
  newId,
  savePrefs,
  saveSongs,
  type Chord,
  type Song,
} from './lib/songs'

const ICONS = ['♪', '♫', '✶', '♩']

function cloneChords(chords: Chord[]): Chord[] {
  return chords.map((chord) => ({ id: chord.id, notes: [...chord.notes] }))
}

function sameChords(a: Chord[], b: Chord[]) {
  if (a.length !== b.length) return false
  return a.every((chord, i) => {
    const other = b[i]
    if (chord.id !== other.id || chord.notes.length !== other.notes.length) return false
    const set = new Set(chord.notes)
    return other.notes.every((n) => set.has(n))
  })
}

export default function App() {
  const initialPrefs = loadPrefs()
  const [songs, setSongs] = useState<Song[]>(() => loadSongs())
  const [openId, setOpenId] = useState<string | null>(null)
  const [labelsOn, setLabelsOn] = useState(initialPrefs.labelsOn)
  const [dark, setDark] = useState(initialPrefs.dark)
  const [handsOn, setHandsOn] = useState(initialPrefs.handsOn)
  const [draftName, setDraftName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    saveSongs(songs)
  }, [songs])

  useEffect(() => {
    savePrefs({ dark, labelsOn, handsOn })
  }, [dark, labelsOn, handsOn])

  function createSong(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const song: Song = {
      id: newId(),
      name: trimmed,
      chords: [emptyChord()],
      updated: Date.now(),
    }
    setSongs((list) => [song, ...list])
    setDraftName('')
    setOpenId(song.id)
  }

  function deleteSong(id: string) {
    setSongs((list) => list.filter((song) => song.id !== id))
    if (openId === id) setOpenId(null)
  }

  function renameSong(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setSongs((list) =>
      list.map((song) => (song.id === id ? { ...song, name: trimmed, updated: Date.now() } : song)),
    )
    setRenaming(null)
  }

  const open = songs.find((song) => song.id === openId) ?? null

  function updateOpen(chords: Chord[]) {
    if (!openId) return
    setSongs((list) =>
      list.map((song) => (song.id === openId ? { ...song, chords, updated: Date.now() } : song)),
    )
  }

  return (
    <div className={`app ${dark ? 'dark' : ''}`}>
      {open ? (
        <Editor
          key={open.id}
          song={open}
          labelsOn={labelsOn}
          dark={dark}
          handsOn={handsOn}
          onChords={updateOpen}
          onBack={() => setOpenId(null)}
          onLabels={setLabelsOn}
          onDark={setDark}
          onHands={setHandsOn}
        />
      ) : (
        <Library
          songs={songs}
          draftName={draftName}
          renaming={renaming}
          renameValue={renameValue}
          onDraft={setDraftName}
          onCreate={() => createSong(draftName)}
          onOpen={setOpenId}
          onDelete={deleteSong}
          onStartRename={(song) => {
            setRenaming(song.id)
            setRenameValue(song.name)
          }}
          onRenameValue={setRenameValue}
          onRename={renameSong}
          onCancelRename={() => setRenaming(null)}
          labelsOn={labelsOn}
          dark={dark}
          onLabels={setLabelsOn}
          onDark={setDark}
        />
      )}
    </div>
  )
}

function Library({
  songs,
  draftName,
  renaming,
  renameValue,
  onDraft,
  onCreate,
  onOpen,
  onDelete,
  onStartRename,
  onRenameValue,
  onRename,
  onCancelRename,
  labelsOn,
  dark,
  onLabels,
  onDark,
}: {
  songs: Song[]
  draftName: string
  renaming: string | null
  renameValue: string
  onDraft: (value: string) => void
  onCreate: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onStartRename: (song: Song) => void
  onRenameValue: (value: string) => void
  onRename: (id: string, name: string) => void
  onCancelRename: () => void
  labelsOn: boolean
  dark: boolean
  onLabels: (value: boolean | ((v: boolean) => boolean)) => void
  onDark: (value: boolean | ((v: boolean) => boolean)) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="library">
      <header className="lib-head">
        <h1>Songs</h1>
        <p>{songs.length === 0 ? 'Name a song to start a chord series.' : 'Open a song, or add another.'}</p>
      </header>
      <form
        className="create"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate()
        }}
      >
        <input
          value={draftName}
          onChange={(event) => onDraft(event.target.value)}
          placeholder="Song name"
          aria-label="Song name"
          autoFocus={songs.length === 0}
        />
        <button type="submit" disabled={!draftName.trim()}>
          <PlusIcon />
          Create
        </button>
      </form>
      {songs.length === 0 ? (
        <p className="empty">No songs yet.</p>
      ) : (
        <ul className="song-list">
          {songs.map((song) => (
            <li key={song.id}>
              {renaming === song.id ? (
                <form
                  className="rename"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onRename(song.id, renameValue)
                  }}
                >
                  <input
                    value={renameValue}
                    onChange={(event) => onRenameValue(event.target.value)}
                    aria-label="Rename song"
                    autoFocus
                  />
                  <button type="submit">Save</button>
                  <button type="button" onClick={onCancelRename}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="song-row">
                  <button type="button" className="song-open" onClick={() => onOpen(song.id)}>
                    <strong>{song.name}</strong>
                    <span>
                      {song.chords.length} chord{song.chords.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  <button type="button" onClick={() => onStartRename(song)}>
                    Rename
                  </button>
                  <button type="button" onClick={() => onDelete(song.id)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <nav className="dock" aria-label="Utilities">
        <div className="menu">
          <button type="button" aria-label="More" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="menu-pop" role="menu">
              <button type="button" className={labelsOn ? 'on' : ''} onClick={() => onLabels((v) => !v)}>
                Notes
              </button>
              <button type="button" className={dark ? 'on' : ''} onClick={() => onDark((v) => !v)}>
                Dark mode
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}

function Editor({
  song,
  labelsOn,
  dark,
  handsOn,
  onChords,
  onBack,
  onLabels,
  onDark,
  onHands,
}: {
  song: Song
  labelsOn: boolean
  dark: boolean
  handsOn: boolean
  onChords: (chords: Chord[]) => void
  onBack: () => void
  onLabels: (value: boolean | ((v: boolean) => boolean)) => void
  onDark: (value: boolean | ((v: boolean) => boolean)) => void
  onHands: (value: boolean | ((v: boolean) => boolean)) => void
}) {
  const [past, setPast] = useState<Chord[][]>([])
  const [future, setFuture] = useState<Chord[][]>([])
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [swapped, setSwapped] = useState(false)
  const inputRef = useRef<HTMLElement>(null)
  const playRef = useRef<HTMLElement>(null)
  const chords = song.chords

  function commit(next: Chord[]) {
    if (sameChords(next, chords)) return
    setPast((p) => [...p, cloneChords(chords)])
    setFuture([])
    onChords(next)
  }

  function toggle(index: number, midi: number) {
    const next = cloneChords(chords)
    const notes = next[index].notes
    next[index].notes = notes.includes(midi)
      ? notes.filter((n) => n !== midi)
      : [...notes, midi].sort((a, b) => a - b)
    commit(next)
  }

  function addChord() {
    commit([...cloneChords(chords), emptyChord()])
  }

  function deleteChord(index: number) {
    if (chords.length <= 1) return
    commit(cloneChords(chords).filter((_, i) => i !== index))
  }

  function moveChord(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= chords.length) return
    const next = cloneChords(chords)
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    commit(next)
  }

  function undo() {
    if (past.length === 0) return
    const prev = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture((f) => [cloneChords(chords), ...f])
    onChords(cloneChords(prev))
  }

  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast((p) => [...p, cloneChords(chords)])
    onChords(cloneChords(next))
  }

  async function playOne(index: number) {
    const notes = chords[index]?.notes
    if (!notes?.length || playingIndex !== null) return
    setPlayingIndex(index)
    try {
      await playChord(notes)
    } finally {
      window.setTimeout(() => setPlayingIndex(null), 500)
    }
  }

  async function playSeries() {
    if (playingIndex !== null) return
    if (!chords.some((c) => c.notes.length > 0)) return
    setPlayingIndex(-1)
    try {
      for (let i = 0; i < chords.length; i++) {
        if (chords[i].notes.length === 0) continue
        setPlayingIndex(i)
        await playChord(chords[i].notes)
        await new Promise((resolve) => window.setTimeout(resolve, 900))
      }
    } finally {
      setPlayingIndex(null)
    }
  }

  function swapCards() {
    const input = inputRef.current
    const playback = playRef.current
    if (!input || !playback) {
      setSwapped((v) => !v)
      return
    }
    const firstIn = input.getBoundingClientRect()
    const firstPlay = playback.getBoundingClientRect()
    setSwapped((v) => !v)
    requestAnimationFrame(() => {
      const nextIn = input.getBoundingClientRect()
      const nextPlay = playback.getBoundingClientRect()
      flip(input, firstIn.top - nextIn.top)
      flip(playback, firstPlay.top - nextPlay.top)
    })
  }

  return (
    <>
      <header className="editor-bar">
        <button type="button" onClick={onBack}>
          Songs
        </button>
        <h1>{song.name}</h1>
      </header>
      <main className={`stage ${swapped ? 'swapped' : ''}`}>
        <section className="panel input" aria-label="Input" ref={inputRef}>
          {chords.map((chord, index) => (
            <div className="chord-line" key={chord.id}>
              <div className="chord-tools">
                <span className="chord-num">{index + 1}</span>
                <button type="button" aria-label="Move chord up" disabled={index === 0} onClick={() => moveChord(index, -1)}>
                  <UpIcon />
                </button>
                <button
                  type="button"
                  aria-label="Move chord down"
                  disabled={index === chords.length - 1}
                  onClick={() => moveChord(index, 1)}
                >
                  <DownIcon />
                </button>
                <button type="button" aria-label="Delete chord" disabled={chords.length <= 1} onClick={() => deleteChord(index)}>
                  <TrashIcon />
                </button>
              </div>
              <Piano
                notes={chord.notes}
                labelsOn={labelsOn}
                interactive
                active={playingIndex === index}
                onToggle={(midi) => toggle(index, midi)}
              />
            </div>
          ))}
        </section>

        <div className="divider" aria-hidden />

        <section className="panel playback" aria-label="Playback" ref={playRef}>
          {chords.map((chord, index) => (
            <div className="slot" key={chord.id}>
              <Piano notes={chord.notes} labelsOn={labelsOn} active={playingIndex === index} />
              {handsOn && <HandOverlay notes={chord.notes} />}
              <button
                type="button"
                className="play"
                disabled={chord.notes.length === 0 || playingIndex !== null}
                onClick={() => playOne(index)}
              >
                <PlayIcon />
                Play
              </button>
            </div>
          ))}
        </section>
      </main>

      <button type="button" className="swap" onClick={swapCards}>
        Swap panels
      </button>

      <nav className="dock" aria-label="Utilities">
        <button type="button" onClick={undo} disabled={past.length === 0}>
          <UndoIcon />
          Undo
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0}>
          <RedoIcon />
          Redo
        </button>
        <button type="button" onClick={addChord}>
          <PlusIcon />
          Add chord
        </button>
        <button type="button" onClick={playSeries} disabled={playingIndex !== null}>
          <PlayIcon />
          Play series
        </button>
        <div className="menu">
          <button type="button" aria-label="More" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="menu-pop" role="menu">
              <button type="button" className={labelsOn ? 'on' : ''} onClick={() => onLabels((v) => !v)}>
                Notes
              </button>
              <button type="button" className={dark ? 'on' : ''} onClick={() => onDark((v) => !v)}>
                Dark mode
              </button>
              <button type="button" className={handsOn ? 'on' : ''} onClick={() => onHands((v) => !v)}>
                Hand placement
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}

function flip(el: HTMLElement, dy: number) {
  if (!dy) return
  el.style.transition = 'none'
  el.style.transform = `translateY(${dy}px)`
  requestAnimationFrame(() => {
    el.style.transition = 'transform 420ms cubic-bezier(.2,.8,.2,1)'
    el.style.transform = ''
  })
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="glyph" viewBox="0 0 16 16" aria-hidden>
      {children}
    </svg>
  )
}

function UndoIcon() {
  return (
    <Icon>
      <path d="M6.5 3.5 3 7l3.5 3.5M3.5 7H10a3.5 3.5 0 0 1 0 7H8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

function RedoIcon() {
  return (
    <Icon>
      <path d="M9.5 3.5 13 7 9.5 10.5M12.5 7H6a3.5 3.5 0 0 0 0 7h2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

function PlusIcon() {
  return (
    <Icon>
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

function PlayIcon() {
  return (
    <Icon>
      <path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor" />
    </Icon>
  )
}

function MoreIcon() {
  return (
    <Icon>
      <circle cx="8" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.1" fill="currentColor" />
    </Icon>
  )
}

function UpIcon() {
  return (
    <Icon>
      <path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

function DownIcon() {
  return (
    <Icon>
      <path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

function TrashIcon() {
  return (
    <Icon>
      <path d="M3.5 5h9M6 5V3.5h4V5M5 5l.5 8h5L11 5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

function Piano({
  notes,
  labelsOn,
  interactive,
  active,
  onToggle,
}: {
  notes: number[]
  labelsOn: boolean
  interactive?: boolean
  active?: boolean
  onToggle?: (midi: number) => void
}) {
  const selected = new Set(notes)
  return (
    <div className={`piano ${active ? 'active' : ''}`} role={interactive ? 'group' : undefined} aria-label="61-key piano">
      <div className="whites">
        {WHITE_KEYS.map((midi) => (
          <Key
            key={midi}
            midi={midi}
            black={false}
            on={selected.has(midi)}
            labelsOn={labelsOn}
            interactive={interactive}
            onToggle={onToggle}
          />
        ))}
      </div>
      <div className="blacks">
        {BLACK_KEYS.map((midi) => (
          <Key
            key={midi}
            midi={midi}
            black
            on={selected.has(midi)}
            labelsOn={labelsOn}
            interactive={interactive}
            onToggle={onToggle}
            style={{ left: `${blackCenter(midi) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function Key({
  midi,
  black,
  on,
  labelsOn,
  interactive,
  onToggle,
  style,
}: {
  midi: number
  black: boolean
  on: boolean
  labelsOn: boolean
  interactive?: boolean
  onToggle?: (midi: number) => void
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      className={`key ${black ? 'black' : 'white'} ${on ? 'on' : ''}`}
      style={style}
      disabled={!interactive}
      aria-pressed={on}
      aria-label={label(midi)}
      onClick={() => onToggle?.(midi)}
    >
      {on && interactive && (
        <span className="burst" aria-hidden>
          {ICONS.map((icon, i) => (
            <span key={i} className={`icon i${i}`}>
              {icon}
            </span>
          ))}
        </span>
      )}
      {labelsOn && <span className="name">{label(midi)}</span>}
    </button>
  )
}
