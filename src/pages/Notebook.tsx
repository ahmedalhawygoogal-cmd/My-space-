import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Eye,
  Headphones,
  Italic,
  List,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  Volume2,
} from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, Toast, useT } from '../ui'
import { contrastInk, fileToDataUrl, firstNoteImage, formatDate, formatDuration } from '../utils'
import { NOTE_COLORS } from '../types'
import type { Note } from '../types'

function audioOf(n: Note) {
  return n.audioId || n.recordingIds[0]
}

function noteInk(bg?: string) {
  if (!bg) return 'var(--ink)'
  return contrastInk(bg)
}

export default function NotebookPage() {
  const tr = useT()
  const nav = useNavigate()
  const { notes, recordings, updateNote, lang, getAudioBlob } = useStore()
  const [q, setQ] = useState('')
  const playing = useRef<HTMLAudioElement | null>(null)
  const [active, setActive] = useState<string | null>(null)

  const list = useMemo(() => {
    let rows = notes
    if (q.trim()) {
      const needle = q.toLowerCase()
      rows = rows.filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.type.toLowerCase().includes(needle) ||
          n.content.toLowerCase().includes(needle),
      )
    }
    return [...rows].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [notes, q])

  async function playNote(n: Note) {
    const id = audioOf(n)
    if (!id) return
    if (playing.current) {
      playing.current.pause()
      playing.current = null
      if (active === n.id) {
        setActive(null)
        return
      }
    }
    const blob = await getAudioBlob(id)
    if (!blob) return
    const el = new Audio(URL.createObjectURL(blob))
    playing.current = el
    setActive(n.id)
    el.onended = () => {
      setActive(null)
      playing.current = null
    }
    void el.play()
  }

  function create() {
    nav('/notes/new')
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('notebook')}</h1>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('search')} />
      {list.length === 0 ? (
        <Empty icon={<BookOpen size={36} />} title={tr('noNotes')} hint={tr('noNotesHint')} />
      ) : (
        list.map((n) => {
          const rec = recordings.find((r) => r.id === audioOf(n))
          const ink = noteInk(n.color)
          return (
            <div key={n.id} className="note-card" style={{ background: n.color || 'var(--bg-elev)', color: ink }}>
              <div className="grow">
                <div className="ellipsis" style={{ fontWeight: 800, color: ink }}>
                  {n.title || tr('untitled')}
                </div>
                <div className="meta" style={{ color: ink, opacity: 0.72 }}>
                  {n.type || tr('note')} · {formatDate(n.updatedAt, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className="row" style={{ gap: 2 }}>
                {rec ? (
                  <button className="icon-btn note-action" type="button" aria-label={tr('play')} onClick={() => void playNote(n)}>
                    {active === n.id ? <Pause size={16} /> : <Headphones size={16} />}
                  </button>
                ) : null}
                <button className="icon-btn note-action" type="button" aria-label={tr('readNote')} onClick={() => nav(`/notes/${n.id}`)}>
                  <Eye size={16} />
                </button>
                <button className="icon-btn note-action" type="button" aria-label={tr('edit')} onClick={() => nav(`/notes/${n.id}/edit`)}>
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn note-action"
                  type="button"
                  aria-label={n.pinned ? tr('unpin') : tr('pin')}
                  onClick={() => void updateNote(n.id, { pinned: !n.pinned })}
                >
                  <Pin size={16} fill={n.pinned ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          )
        })
      )}
      <button className="fab" type="button" onClick={create} aria-label={tr('newNote')}>
        <Plus size={22} />
      </button>
    </div>
  )
}

export function NoteEditorPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const { notes, notebooks, recordings, addNote, updateNote, deleteNote } = useStore()
  const existing = id && id !== 'new' ? notes.find((n) => n.id === id) : undefined
  const editor = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [type, setType] = useState(existing?.type ?? '')
  const [color, setColor] = useState(existing?.color || NOTE_COLORS[0]!)
  const [audioId, setAudioId] = useState(existing?.audioId || existing?.recordingIds[0] || '')
  const [confirm, setConfirm] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [noteId, setNoteId] = useState(existing?.id ?? '')
  const inited = useRef(false)
  const ink = noteInk(color)

  useEffect(() => {
    if (inited.current) return
    if (editor.current && existing) editor.current.innerHTML = existing.content
    inited.current = true
  }, [existing])

  function exec(cmd: string, val?: string) {
    editor.current?.focus()
    document.execCommand(cmd, false, val)
  }

  async function save() {
    const content = editor.current?.innerHTML ?? ''
    const book = notebooks[0]
    if (!book) return
    const patch: Partial<Note> = {
      title: title.trim(),
      type: type.trim(),
      content,
      color,
      audioId: audioId || undefined,
      recordingIds: audioId ? [audioId] : [],
    }
    if (noteId) {
      await updateNote(noteId, patch)
    } else {
      const created = await addNote(book.id, patch)
      setNoteId(created.id)
      nav(`/notes/${created.id}/edit`, { replace: true })
    }
    setToast(tr('noteSaved'))
  }

  return (
    <div className="stack note-surface" style={{ background: color, color: ink, margin: '-16px', padding: 16, minHeight: '100%' }}>
      <div className="spread">
        <button className="chip" type="button" onClick={() => nav('/notes')}>
          {tr('back')}
        </button>
        <button className="btn" type="button" onClick={() => void save()}>
          {tr('save')}
        </button>
      </div>
      <input className="note-title" value={title} placeholder={tr('title')} onChange={(e) => setTitle(e.target.value)} style={{ color: ink }} />
      <label className="label">{tr('noteType')}</label>
      <input className="field" value={type} placeholder={tr('noteType')} onChange={(e) => setType(e.target.value)} />
      <label className="label">{tr('noteColor')}</label>
      <div className="chip-row">
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${color === c ? 'on' : ''}`}
            type="button"
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>
      <div className="editor-wrap">
        <div className="toolbar">
          <select
            className="tool-select"
            defaultValue="Cairo"
            aria-label={tr('editorFont')}
            onChange={(e) => exec('fontName', e.target.value)}
          >
            <option value="Cairo">Cairo</option>
            <option value="Tajawal">Tajawal</option>
            <option value="Almarai">Almarai</option>
          </select>
          <select
            className="tool-select"
            defaultValue="4"
            aria-label={tr('editorSize')}
            onChange={(e) => exec('fontSize', e.target.value)}
          >
            <option value="2">12</option>
            <option value="3">14</option>
            <option value="4">16</option>
            <option value="5">20</option>
            <option value="6">24</option>
          </select>
          <button type="button" onClick={() => exec('bold')} aria-label={tr('bold')}>
            <Bold size={16} />
          </button>
          <button type="button" onClick={() => exec('italic')} aria-label={tr('italic')}>
            <Italic size={16} />
          </button>
          <button type="button" onClick={() => exec('insertUnorderedList')} aria-label={tr('list')}>
            <List size={16} />
          </button>
          <button type="button" onClick={() => exec('justifyLeft')} aria-label={tr('alignLeft')}>
            <AlignLeft size={16} />
          </button>
          <button type="button" onClick={() => exec('justifyCenter')} aria-label={tr('alignCenter')}>
            <AlignCenter size={16} />
          </button>
          <button type="button" onClick={() => exec('justifyRight')} aria-label={tr('alignRight')}>
            <AlignRight size={16} />
          </button>
          <label className="tool-file">
            <ImageIcon size={16} />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const dataUrl = await fileToDataUrl(f)
                exec('insertImage', dataUrl)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <div ref={editor} className="editor" contentEditable data-placeholder={tr('writing')} style={{ color: ink }} />
      </div>
      <label className="label">{tr('attachAudio')}</label>
      {audioId ? (
        <div className="list-item">
          <Volume2 size={16} />
          <div className="grow ellipsis">{recordings.find((r) => r.id === audioId)?.name || tr('attachAudio')}</div>
          <button className="chip" type="button" onClick={() => setAudioId('')}>
            {tr('removeAudio')}
          </button>
        </div>
      ) : (
        <button className="btn secondary block" type="button" onClick={() => setAudioOpen(true)}>
          {tr('pickAudio')}
        </button>
      )}
      {noteId ? (
        <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
          {tr('delete')}
        </button>
      ) : null}
      <Confirm
        open={confirm}
        title={tr('deleteNoteConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          if (noteId) await deleteNote(noteId)
          nav('/notes')
        }}
      />
      <Sheet open={audioOpen} onClose={() => setAudioOpen(false)} title={tr('pickAudio')}>
        {recordings.length === 0 ? (
          <p className="muted">{tr('noRecordings')}</p>
        ) : (
          recordings.map((r) => (
            <button
              key={r.id}
              className="list-item"
              type="button"
              onClick={() => {
                setAudioId(r.id)
                setAudioOpen(false)
              }}
            >
              {r.name}
            </button>
          ))
        )}
      </Sheet>
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}

export function NoteReadPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const { notes, lang } = useStore()
  const note = notes.find((n) => n.id === id)
  if (!note) return <Empty icon={<BookOpen />} title={tr('noNotes')} />
  const img = firstNoteImage(note.content)
  const audioId = audioOf(note)
  const ink = noteInk(note.color)

  return (
    <div className="stack note-surface" style={{ background: note.color || undefined, color: ink, margin: '-16px', padding: 16, minHeight: '100%' }}>
      <div className="spread">
        <button className="chip" type="button" onClick={() => nav('/notes')}>
          {tr('back')}
        </button>
        <button className="icon-btn note-action" type="button" aria-label={tr('edit')} onClick={() => nav(`/notes/${note.id}/edit`)}>
          <Pencil size={16} />
        </button>
      </div>
      <h1 className="page-title" style={{ marginBottom: 0, color: ink }}>
        {note.title || tr('untitled')}
      </h1>
      <div className="muted" style={{ color: ink, opacity: 0.72 }}>
        {note.type || tr('note')} · {formatDate(note.updatedAt, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      {img ? <img className="note-hero" src={img} alt="" /> : null}
      {audioId ? <NotePlayer id={audioId} /> : null}
      <div className="note-body" style={{ color: ink }} dangerouslySetInnerHTML={{ __html: note.content }} />
    </div>
  )
}

function NotePlayer({ id }: { id: string }) {
  const tr = useT()
  const { getAudioBlob, recordings } = useStore()
  const rec = recordings.find((r) => r.id === id)
  const audio = useRef<HTMLAudioElement | null>(null)
  const [src, setSrc] = useState('')
  const [on, setOn] = useState(false)
  const [pos, setPos] = useState(0)
  const [dur, setDur] = useState(rec?.durationMs ?? 0)
  const [rate, setRate] = useState(1)

  useEffect(() => {
    let url = ''
    void getAudioBlob(id).then((blob) => {
      if (!blob) return
      url = URL.createObjectURL(blob)
      setSrc(url)
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, getAudioBlob])

  useEffect(() => {
    const el = audio.current
    if (!el) return
    el.playbackRate = rate
  }, [rate])

  function seek(delta: number) {
    const el = audio.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta))
  }

  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0

  return (
    <div className="player">
      <audio
        ref={audio}
        src={src}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration * 1000)}
        onEnded={() => setOn(false)}
      />
      <div className="spread">
        <b className="ellipsis">{rec?.name || tr('attachAudio')}</b>
        <span className="muted">
          {formatDuration(pos)} / {formatDuration(dur)}
        </span>
      </div>
      <input
        className="seek"
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => {
          const el = audio.current
          if (!el || !dur) return
          el.currentTime = (Number(e.target.value) / 100) * (dur / 1000)
        }}
      />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="icon-btn" type="button" aria-label={tr('rewind')} onClick={() => seek(-10)}>
          <RotateCcw size={18} />
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const el = audio.current
            if (!el) return
            if (on) {
              el.pause()
              setOn(false)
            } else {
              void el.play()
              setOn(true)
            }
          }}
        >
          {on ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="icon-btn" type="button" aria-label={tr('forward')} onClick={() => seek(10)}>
          <RotateCw size={18} />
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
        >
          {rate}x
        </button>
      </div>
    </div>
  )
}
