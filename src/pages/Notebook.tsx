import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bold,
  BookOpen,
  CheckSquare,
  Heading,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  Mic,
  Pin,
  Plus,
} from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, SubjectSelect, TagInput, Toast, useT } from '../ui'
import { debounce, excerpt, fileToDataUrl, stripHtml, uid } from '../utils'
import type { Note } from '../types'

export default function NotebookPage() {
  const tr = useT()
  const nav = useNavigate()
  const { notebooks, notes, addNotebook, addNote } = useStore()
  const [nb, setNb] = useState<string | 'all'>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'updated' | 'created'>('updated')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const list = useMemo(() => {
    let rows = notes
    if (nb !== 'all') rows = rows.filter((n) => n.notebookId === nb)
    if (q.trim()) {
      const needle = q.toLowerCase()
      rows = rows.filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          stripHtml(n.content).toLowerCase().includes(needle) ||
          n.tags.some((t) => t.toLowerCase().includes(needle)),
      )
    }
    rows = [...rows].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return sort === 'updated' ? b.updatedAt - a.updatedAt : b.createdAt - a.createdAt
    })
    return rows
  }, [notes, nb, q, sort])

  async function createNote() {
    const book = notebooks.find((n) => n.id === nb) ?? notebooks[0]
    if (!book) return
    const note = await addNote(book.id, { title: '' })
    nav(`/notes/${note.id}`)
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('notebook')}</h1>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('search')} />
      <div className="chip-row">
        <button className={`chip ${nb === 'all' ? 'active' : ''}`} type="button" onClick={() => setNb('all')}>
          {tr('all')}
        </button>
        {notebooks.map((n) => (
          <button key={n.id} className={`chip ${nb === n.id ? 'active' : ''}`} type="button" onClick={() => setNb(n.id)}>
            {n.name}
          </button>
        ))}
        <button className="chip" type="button" onClick={() => setOpen(true)}>
          {tr('newNotebook')}
        </button>
      </div>
      <div className="chip-row">
        <button className={`chip ${sort === 'updated' ? 'active' : ''}`} type="button" onClick={() => setSort('updated')}>
          {tr('sortModified')}
        </button>
        <button className={`chip ${sort === 'created' ? 'active' : ''}`} type="button" onClick={() => setSort('created')}>
          {tr('sortDate')}
        </button>
      </div>
      {list.length === 0 ? (
        <Empty icon={<BookOpen size={36} />} title={tr('noNotes')} hint={tr('noNotesHint')} />
      ) : (
        list.map((n) => (
          <Link key={n.id} className="list-item pressable" to={`/notes/${n.id}`}>
            {n.pinned ? <Pin size={14} /> : <div className="dot" style={{ background: 'var(--brand)' }} />}
            <div className="grow">
              <div className="ellipsis">{n.title || tr('untitled')}</div>
              <div className="meta ellipsis">{excerpt(stripHtml(n.content))}</div>
            </div>
          </Link>
        ))
      )}
      <button className="fab" type="button" onClick={() => void createNote()} aria-label={tr('newNote')}>
        <Plus size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newNotebook')}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('name')} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!name.trim()) return
            await addNotebook(name.trim())
            setName('')
            setOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
    </div>
  )
}

export function NoteEditorPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const {
    notes,
    notebooks,
    recordings,
    tasks,
    updateNote,
    deleteNote,
    addDeck,
    addCard,
    addTask,
    linkEntities,
  } = useStore()
  const note = notes.find((n) => n.id === id)
  const editor = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const saveRef = useRef(note)

  useEffect(() => {
    saveRef.current = note
  }, [note])

  useEffect(() => {
    if (editor.current && note && editor.current.innerHTML !== note.content) {
      editor.current.innerHTML = note.content
    }
  }, [id])

  const persist = useMemo(
    () =>
      debounce((patch: Partial<Note>) => {
        const cur = saveRef.current
        if (!cur) return
        void updateNote(cur.id, patch).then(() => setSaved(true))
      }, 400),
    [updateNote],
  )

  if (!note) return <Empty icon={<BookOpen />} title={tr('noNotes')} />
  const book = notebooks.find((n) => n.id === note.notebookId)
  const linkedRec = recordings.filter((r) => note.recordingIds.includes(r.id))
  const linkedTasks = tasks.filter((t) => note.taskIds.includes(t.id) || t.noteId === note.id)

  function exec(cmd: string, val?: string) {
    editor.current?.focus()
    document.execCommand(cmd, false, val)
    persist({ content: editor.current?.innerHTML ?? '' })
  }

  return (
    <div className="stack">
      <div className="spread">
        <span className="muted">{book?.name}</span>
        <div className="row">
          {saved ? <span className="badge">{tr('autoSaved')}</span> : null}
          <button className="icon-btn" type="button" onClick={() => void updateNote(note.id, { pinned: !note.pinned })}>
            <Pin size={16} />
          </button>
        </div>
      </div>
      <input
        className="note-title"
        value={note.title}
        placeholder={tr('title')}
        onChange={(e) => {
          void updateNote(note.id, { title: e.target.value })
        }}
      />
      <div className="editor-wrap">
        <div className="toolbar">
          <button type="button" onClick={() => exec('bold')} aria-label={tr('bold')}>
            <Bold size={16} />
          </button>
          <button type="button" onClick={() => exec('italic')} aria-label={tr('italic')}>
            <Italic size={16} />
          </button>
          <button type="button" onClick={() => exec('formatBlock', 'H2')} aria-label={tr('heading')}>
            <Heading size={16} />
          </button>
          <button type="button" onClick={() => exec('insertUnorderedList')} aria-label={tr('list')}>
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => exec('insertHTML', '<div>☐ </div>')}
            aria-label={tr('checklist')}
          >
            <CheckSquare size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('URL')
              if (url) exec('createLink', url)
            }}
            aria-label={tr('link')}
          >
            <LinkIcon size={16} />
          </button>
          <button type="button" onClick={() => setAudioOpen(true)} aria-label={tr('attachAudio')}>
            <Mic size={16} />
          </button>
          <label style={{ display: 'grid', placeItems: 'center', width: 36, height: 36 }}>
            <ImageIcon size={16} />
            <input
              type="file"
              accept="image/*,.pdf,.txt,.md"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const dataUrl = await fileToDataUrl(f)
                await updateNote(note.id, {
                  attachments: [...note.attachments, { id: uid(), name: f.name, mime: f.type, dataUrl }],
                })
              }}
            />
          </label>
        </div>
        <div
          ref={editor}
          className="editor"
          contentEditable
          data-placeholder={tr('writing')}
          onInput={() => persist({ content: editor.current?.innerHTML ?? '' })}
        />
      </div>
      <label className="label">{tr('tags')}</label>
      <TagInput value={note.tags} onChange={(tags) => void updateNote(note.id, { tags })} />
      <label className="label">{tr('subject')}</label>
      <SubjectSelect value={note.subjectId} onChange={(subjectId) => void updateNote(note.id, { subjectId })} />
      {linkedRec.length > 0 && (
        <>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{tr('linkedRecordings')}</h3>
          {linkedRec.map((r) => (
            <Link key={r.id} className="list-item" to={`/record/${r.id}`}>
              {r.name}
            </Link>
          ))}
        </>
      )}
      {linkedTasks.length > 0 && (
        <>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{tr('linkedTasks')}</h3>
          {linkedTasks.map((tk) => (
            <Link key={tk.id} className="list-item" to={`/tasks/${tk.id}`}>
              {tk.title}
            </Link>
          ))}
        </>
      )}
      {note.attachments.map((a) => (
        <div key={a.id} className="attach">
          {a.mime.startsWith('image/') ? <img src={a.dataUrl} alt={a.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} /> : null}
          <span className="ellipsis grow">{a.name}</span>
        </div>
      ))}
      <div className="grid-2">
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            const sel = window.getSelection()?.toString().trim() || stripHtml(note.content)
            setFront(sel.split('\n')[0] ?? '')
            setBack(sel)
            setCardOpen(true)
          }}
        >
          {tr('createCards')}
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={async () => {
            const tk = await addTask({ title: note.title || tr('untitled'), noteId: note.id, subjectId: note.subjectId })
            await linkEntities('task', tk.id, 'note', note.id)
            nav(`/tasks/${tk.id}`)
          }}
        >
          {tr('createTask')}
        </button>
      </div>
      <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
        {tr('delete')}
      </button>
      <Confirm
        open={confirm}
        title={tr('deleteNoteConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteNote(note.id)
          nav('/notes')
        }}
      />
      <Sheet open={audioOpen} onClose={() => setAudioOpen(false)} title={tr('attachAudio')}>
        {recordings.map((r) => (
          <button
            key={r.id}
            className="list-item"
            type="button"
            onClick={async () => {
              await linkEntities('note', note.id, 'recording', r.id)
              setAudioOpen(false)
            }}
          >
            {r.name}
          </button>
        ))}
      </Sheet>
      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} title={tr('createCards')}>
        <label className="label">{tr('front')}</label>
        <input className="field" value={front} onChange={(e) => setFront(e.target.value)} />
        <label className="label">{tr('cardBack')}</label>
        <textarea className="field textarea" value={back} onChange={(e) => setBack(e.target.value)} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!front.trim() || !back.trim()) return
            const deck = await addDeck(note.title || tr('fromNote'), { noteId: note.id, subjectId: note.subjectId })
            const lines = back.split('\n').map((l) => l.trim()).filter(Boolean)
            if (lines.length > 1) {
              for (const line of lines) {
                const [a, b] = line.split(/[-–—:=]/).map((x) => x.trim())
                await addCard(deck.id, { front: a || line, back: b || front })
              }
            } else {
              await addCard(deck.id, { front: front.trim(), back: back.trim() })
            }
            setCardOpen(false)
            nav(`/cards/${deck.id}`)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
      <Toast text={saved ? tr('autoSaved') : null} onDone={() => setSaved(false)} />
    </div>
  )
}
