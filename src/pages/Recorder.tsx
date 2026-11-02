import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FolderPlus, Mic, Pause, Play, Square, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Segment, Sheet, SubjectSelect, TagInput, useT } from '../ui'
import { formatDateTime, formatDuration, pickMime } from '../utils'

export default function RecorderPage() {
  const tr = useT()
  const nav = useNavigate()
  const { recordings, folders, subjects, addFolder, lang } = useStore()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'date' | 'duration' | 'name'>('date')
  const [folderId, setFolderId] = useState<string | 'all'>('all')
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')

  const list = useMemo(() => {
    let rows = recordings
    if (folderId !== 'all') rows = rows.filter((r) => r.folderId === folderId)
    if (q.trim()) {
      const n = q.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(n) ||
          r.description.toLowerCase().includes(n) ||
          r.tags.some((t) => t.toLowerCase().includes(n)),
      )
    }
    rows = [...rows]
    if (sort === 'date') rows.sort((a, b) => b.createdAt - a.createdAt)
    if (sort === 'duration') rows.sort((a, b) => b.durationMs - a.durationMs)
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name))
    return rows
  }, [recordings, folderId, q, sort])

  return (
    <div className="stack">
      <h1 className="page-title">{tr('recorder')}</h1>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('search')} />
      <div className="chip-row">
        <button className={`chip ${folderId === 'all' ? 'active' : ''}`} type="button" onClick={() => setFolderId('all')}>
          {tr('all')}
        </button>
        {folders
          .filter((f) => f.kind === 'recording' || f.kind === 'mixed')
          .map((f) => (
            <button key={f.id} className={`chip ${folderId === f.id ? 'active' : ''}`} type="button" onClick={() => setFolderId(f.id)}>
              {f.name}
            </button>
          ))}
        <button className="chip" type="button" onClick={() => setFolderOpen(true)}>
          <FolderPlus size={14} /> {tr('newFolder')}
        </button>
      </div>
      <Segment
        value={sort}
        onChange={(v) => setSort(v as typeof sort)}
        options={[
          { id: 'date', label: tr('sortDate') },
          { id: 'duration', label: tr('sortDuration') },
          { id: 'name', label: tr('sortName') },
        ]}
      />
      {list.length === 0 ? (
        <Empty icon={<Mic size={36} />} title={tr('noRecordings')} hint={tr('noRecordingsHint')} />
      ) : (
        list.map((r) => {
          const sub = subjects.find((s) => s.id === r.subjectId)
          return (
            <Link key={r.id} className="list-item pressable" to={`/record/${r.id}`}>
              <div className="dot" style={{ background: sub?.color ?? 'var(--accent)' }} />
              <div className="grow">
                <div className="ellipsis">{r.name}</div>
                <div className="meta">
                  {formatDuration(r.durationMs)} · {formatDateTime(r.createdAt, lang)}
                </div>
              </div>
            </Link>
          )
        })
      )}
      <button className="fab accent" type="button" onClick={() => nav('/record/live')} aria-label={tr('record')}>
        <Mic size={22} />
      </button>
      <Sheet open={folderOpen} onClose={() => setFolderOpen(false)} title={tr('newFolder')}>
        <label className="label">{tr('name')}</label>
        <input className="field" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!folderName.trim()) return
            await addFolder(folderName.trim(), 'recording')
            setFolderName('')
            setFolderOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
    </div>
  )
}

export function LiveRecordPage() {
  const tr = useT()
  const nav = useNavigate()
  const { addRecording, folders } = useStore()
  const [status, setStatus] = useState<'idle' | 'live' | 'paused'>('idle')
  const [ms, setMs] = useState(0)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState<string | undefined>()
  const [subjectId, setSubjectId] = useState<string | undefined>()
  const [error, setError] = useState('')
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | null>(null)
  const started = useRef(0)
  const pausedAt = useRef(0)
  const acc = useRef(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const raf = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current)
    if (raf.current) cancelAnimationFrame(raf.current)
    recRef.current?.stream.getTracks().forEach((t) => t.stop())
    streamRef.current?.getTracks().forEach((t) => t.stop())
    void audioCtx.current?.close()
    recRef.current = null
    audioCtx.current = null
  }

  function tick() {
    setMs(acc.current + (Date.now() - started.current))
  }

  function draw() {
    const an = analyser.current
    const cv = canvas.current
    if (!an || !cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const w = (cv.width = cv.clientWidth * 2)
    const h = (cv.height = cv.clientHeight * 2)
    const data = new Uint8Array(an.fftSize)
    an.getByteTimeDomainData(data)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-muted') || '#eee'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#e85d4c'
    ctx.lineWidth = 3
    ctx.beginPath()
    const step = Math.max(1, Math.floor(data.length / 80))
    for (let i = 0, x = 0; i < data.length; i += step, x += w / 80) {
      const v = data[i] / 128
      const y = (v * h) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    raf.current = requestAnimationFrame(draw)
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      const mime = pickMime()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 }) : new MediaRecorder(stream)
      chunks.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      recRef.current = rec
      rec.start(200)
      started.current = Date.now()
      acc.current = 0
      timer.current = window.setInterval(tick, 200)
      setStatus('live')
      const ctx = new AudioContext()
      audioCtx.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      src.connect(an)
      analyser.current = an
      draw()
    } catch (err) {
      const e = err as DOMException
      setError(e.name === 'NotAllowedError' ? tr('micDenied') : tr('micError'))
    }
  }

  function pause() {
    const rec = recRef.current
    if (!rec || rec.state !== 'recording') return
    rec.pause()
    acc.current += Date.now() - started.current
    pausedAt.current = Date.now()
    if (timer.current) window.clearInterval(timer.current)
    setStatus('paused')
  }

  function resume() {
    const rec = recRef.current
    if (!rec || rec.state !== 'paused') return
    rec.resume()
    started.current = Date.now()
    timer.current = window.setInterval(tick, 200)
    setStatus('live')
  }

  async function stopAndSave() {
    const rec = recRef.current
    if (!rec) return
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve()
      if (rec.state !== 'inactive') rec.stop()
      else resolve()
    })
    if (timer.current) window.clearInterval(timer.current)
    const duration = acc.current + (status === 'live' ? Date.now() - started.current : 0)
    const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
    const item = await addRecording(
      {
        name: name.trim() || `${tr('recording')} ${new Date().toLocaleString()}`,
        durationMs: duration,
        mimeType: blob.type,
        sizeBytes: blob.size,
        folderId,
        subjectId,
      },
      blob,
    )
    cleanup()
    nav(`/record/${item.id}`, { replace: true })
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('newRecording')}</h1>
      <div className="card rec-stage">
        <div className="muted">{status === 'live' ? tr('recording') : status === 'paused' ? tr('paused') : tr('record')}</div>
        <div className="rec-time">{formatDuration(ms)}</div>
        <canvas ref={canvas} className="wave" />
        <div className="row" style={{ marginTop: 18, gap: 16 }}>
          {status !== 'idle' && (
            <button className="icon-btn" type="button" onClick={status === 'live' ? pause : resume} aria-label={tr('pause')}>
              {status === 'live' ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
          <button
            className={`rec-btn ${status === 'live' ? 'live' : ''}`}
            type="button"
            onClick={status === 'idle' ? start : stopAndSave}
            aria-label={tr('record')}
          >
            {status === 'idle' ? <Mic size={28} /> : <Square size={22} />}
          </button>
        </div>
        {error ? <p className="muted" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      </div>
      <label className="label">{tr('recName')}</label>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('recNamePlaceholder')} />
      <label className="label">{tr('folder')}</label>
      <select className="field" value={folderId ?? ''} onChange={(e) => setFolderId(e.target.value || undefined)}>
        <option value="">{tr('none')}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <label className="label">{tr('subject')}</label>
      <SubjectSelect value={subjectId} onChange={setSubjectId} />
    </div>
  )
}

export function RecordingDetailPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const { recordings, notes, notebooks, updateRecording, deleteRecording, getAudioBlob, addNote, linkEntities, lang } = useStore()
  const rec = recordings.find((r) => r.id === id)
  const [url, setUrl] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    let objectUrl: string | undefined
    void getAudioBlob(id).then((blob) => {
      if (!alive || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, getAudioBlob])

  if (!rec) return <Empty icon={<Mic />} title={tr('noRecordings')} />

  const linked = notes.filter((n) => rec.noteIds.includes(n.id) || n.recordingIds.includes(rec.id))

  return (
    <div className="stack">
      <input className="note-title" value={rec.name} onChange={(e) => void updateRecording(rec.id, { name: e.target.value })} />
      <div className="muted">
        {formatDateTime(rec.createdAt, lang)} · {formatDuration(rec.durationMs)}
      </div>
      <div className="card player">
        <button
          className="icon-btn"
          type="button"
          onClick={() => {
            const el = audio.current
            if (!el) return
            if (el.paused) void el.play()
            else el.pause()
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input
          className="seek"
          type="range"
          min={0}
          max={Math.max(1, rec.durationMs)}
          value={cur}
          onChange={(e) => {
            const v = Number(e.target.value)
            setCur(v)
            if (audio.current) audio.current.currentTime = v / 1000
          }}
        />
        <span className="muted" style={{ fontSize: 12, minWidth: 40 }}>
          {formatDuration(cur)}
        </span>
        {url ? (
          <audio
            ref={audio}
            src={url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={() => setCur((audio.current?.currentTime ?? 0) * 1000)}
          />
        ) : null}
      </div>
      <label className="label">{tr('description')}</label>
      <textarea className="field textarea" value={rec.description} onChange={(e) => void updateRecording(rec.id, { description: e.target.value })} />
      <label className="label">{tr('tags')}</label>
      <TagInput value={rec.tags} onChange={(tags) => void updateRecording(rec.id, { tags })} />
      <label className="label">{tr('subject')}</label>
      <SubjectSelect value={rec.subjectId} onChange={(subjectId) => void updateRecording(rec.id, { subjectId })} />
      <div className="spread">
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{tr('attachedNotes')}</h3>
        <button className="chip" type="button" onClick={() => setNoteOpen(true)}>
          {tr('attachToNote')}
        </button>
      </div>
      {linked.map((n) => (
        <Link key={n.id} className="list-item" to={`/notes/${n.id}`}>
          <div className="grow ellipsis">{n.title || tr('untitled')}</div>
        </Link>
      ))}
      <button
        className="btn secondary block"
        type="button"
        onClick={async () => {
          const nb = notebooks[0]
          if (!nb) return
          const note = await addNote(nb.id, {
            title: rec.name,
            content: rec.description,
            subjectId: rec.subjectId,
            recordingIds: [rec.id],
          })
          await linkEntities('recording', rec.id, 'note', note.id)
          nav(`/notes/${note.id}`)
        }}
      >
        {tr('createNoteFromRec')}
      </button>
      <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
        <Trash2 size={16} /> {tr('delete')}
      </button>
      <Confirm
        open={confirm}
        title={tr('deleteRecConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteRecording(rec.id)
          nav('/record')
        }}
      />
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={tr('attachToNote')}>
        {notes.map((n) => (
          <button
            key={n.id}
            className="list-item"
            type="button"
            onClick={async () => {
              await linkEntities('recording', rec.id, 'note', n.id)
              setNoteOpen(false)
            }}
          >
            {n.title || tr('untitled')}
          </button>
        ))}
      </Sheet>
    </div>
  )
}
