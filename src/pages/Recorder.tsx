import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FolderPlus, Mic, Pause, Play, Sparkles, Square, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { AudioPlayer } from '../AudioPlayer'
import { Confirm, Empty, Segment, Sheet, SubjectSelect, TagInput, Toast, useT } from '../ui'
import {
  cancelNativeRecording,
  closeProcessedRecordingGraph,
  createProcessedRecordingGraph,
  isNativePlatform,
  nativeAmplitude,
  pauseNativeRecording,
  resumeNativeRecording,
  startNativeRecording,
  stopNativeRecording,
  WEB_AUDIO_CONSTRAINTS,
} from '../record'
import { formatDateTime, formatDuration, pickMime } from '../utils'

const ENHANCE_KEY = 'myspace.enhanceAudio'

function readEnhance(): boolean {
  try {
    return localStorage.getItem(ENHANCE_KEY) === '1'
  } catch {
    return false
  }
}

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
      <div className="spread">
        <button className="chip" type="button" onClick={() => nav('/')}>
          {tr('back')}
        </button>
      </div>
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
  const { addRecording, addFolder, folders, lang } = useStore()
  const [status, setStatus] = useState<'idle' | 'live' | 'paused'>('idle')
  const [ms, setMs] = useState(0)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState<string | undefined>()
  const [subjectId, setSubjectId] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [enhance, setEnhance] = useState(readEnhance)
  const [nameOpen, setNameOpen] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const nativeRef = useRef(false)
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
  const ampBuf = useRef<number[]>(Array.from({ length: 80 }, () => 0.5))
  const saving = useRef(false)
  const pending = useRef<{ blob: Blob; mimeType: string; durationMs: number } | null>(null)

  function defaultRecName() {
    const locale = lang === 'ar' ? 'ar-EG' : lang
    return `${tr('newRecording')} - ${new Date().toLocaleTimeString(locale)}`
  }

  function setEnhancePersist(next: boolean) {
    setEnhance(next)
    try {
      localStorage.setItem(ENHANCE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  function releaseCapture() {
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(raf.current)
      raf.current = 0
    }
    recRef.current?.stream.getTracks().forEach((t) => t.stop())
    streamRef.current?.getTracks().forEach((t) => t.stop())
    void closeProcessedRecordingGraph(audioCtx.current)
    recRef.current = null
    streamRef.current = null
    audioCtx.current = null
    analyser.current = null
  }

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current)
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(raf.current)
    }
    recRef.current?.stream.getTracks().forEach((t) => t.stop())
    streamRef.current?.getTracks().forEach((t) => t.stop())
    void closeProcessedRecordingGraph(audioCtx.current)
    recRef.current = null
    audioCtx.current = null
    analyser.current = null
    if (nativeRef.current) {
      nativeRef.current = false
      void cancelNativeRecording()
    }
  }

  function tick() {
    setMs(acc.current + (Date.now() - started.current))
  }

  function paintWave(samples: number[]) {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const w = (cv.width = cv.clientWidth * 2)
    const h = (cv.height = cv.clientHeight * 2)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-muted') || '#eee'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#0f6e6b'
    ctx.lineWidth = 3
    ctx.beginPath()
    const n = Math.max(1, samples.length)
    for (let i = 0; i < n; i++) {
      const x = (i / Math.max(1, n - 1)) * w
      const y = samples[i] * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  function draw() {
    const an = analyser.current
    if (!an) return
    const data = new Uint8Array(an.fftSize)
    an.getByteTimeDomainData(data)
    const step = Math.max(1, Math.floor(data.length / 80))
    const samples: number[] = []
    for (let i = 0; i < data.length; i += step) samples.push(data[i] / 256)
    paintWave(samples)
    raf.current = requestAnimationFrame(draw)
  }

  async function drawNative() {
    if (!nativeRef.current) return
    const amp = await nativeAmplitude()
    if (!nativeRef.current) return
    const next = ampBuf.current.slice(1)
    next.push(0.5 + (amp - 0.5) * 0.9)
    ampBuf.current = next
    paintWave(next)
    raf.current = window.setTimeout(() => {
      void drawNative()
    }, 80) as unknown as number
  }

  function beginClock() {
    started.current = Date.now()
    acc.current = 0
    timer.current = window.setInterval(tick, 200)
    setStatus('live')
  }

  async function startWeb() {
    let raw: MediaStream
    try {
      raw = await navigator.mediaDevices.getUserMedia({ audio: WEB_AUDIO_CONSTRAINTS })
    } catch {
      raw = await navigator.mediaDevices.getUserMedia({ audio: true })
    }
    streamRef.current = raw
    let graph
    try {
      graph = await createProcessedRecordingGraph(raw, { enhance })
    } catch {
      raw.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      throw new Error('audio-graph')
    }
    audioCtx.current = graph.context
    analyser.current = graph.analyser
    const mime = pickMime()
    const recOpts: MediaRecorderOptions = { audioBitsPerSecond: 256000 }
    if (mime) recOpts.mimeType = mime
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(graph.stream, recOpts)
    } catch {
      rec = mime ? new MediaRecorder(graph.stream, { mimeType: mime }) : new MediaRecorder(graph.stream)
    }
    chunks.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    recRef.current = rec
    rec.start(200)
    beginClock()
    draw()
  }

  async function start() {
    setError('')
    try {
      if (isNativePlatform()) {
        nativeRef.current = true
        await startNativeRecording()
        ampBuf.current = Array.from({ length: 80 }, () => 0.5)
        beginClock()
        void drawNative()
        return
      }
      nativeRef.current = false
      await startWeb()
    } catch (err) {
      nativeRef.current = false
      const e = err as DOMException
      setError(e.name === 'NotAllowedError' ? tr('micDenied') : tr('micError'))
    }
  }

  async function pause() {
    try {
      if (nativeRef.current) {
        await pauseNativeRecording()
      } else {
        const rec = recRef.current
        if (!rec || rec.state !== 'recording') return
        rec.pause()
      }
    } catch {
      setError(tr('micError'))
      return
    }
    acc.current += Date.now() - started.current
    pausedAt.current = Date.now()
    if (timer.current) window.clearInterval(timer.current)
    setStatus('paused')
  }

  async function resume() {
    try {
      if (nativeRef.current) {
        await resumeNativeRecording()
      } else {
        const rec = recRef.current
        if (!rec || rec.state !== 'paused') return
        rec.resume()
      }
    } catch {
      setError(tr('micError'))
      return
    }
    started.current = Date.now()
    timer.current = window.setInterval(tick, 200)
    setStatus('live')
  }

  async function stopAndPrompt() {
    if (saving.current) return
    if (!nativeRef.current && !recRef.current) return
    saving.current = true
    try {
      if (timer.current) window.clearInterval(timer.current)
      const duration = acc.current + (status === 'live' ? Date.now() - started.current : 0)
      let blob: Blob
      let mimeType: string
      let durationMs = duration
      if (nativeRef.current) {
        const result = await stopNativeRecording()
        nativeRef.current = false
        blob = result.blob
        mimeType = result.mimeType
        if (result.durationMs > 0) durationMs = result.durationMs
      } else {
        const rec = recRef.current
        if (!rec) {
          saving.current = false
          return
        }
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve()
          if (rec.state !== 'inactive') rec.stop()
          else resolve()
        })
        blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        mimeType = blob.type || 'audio/webm'
      }
      pending.current = { blob, mimeType, durationMs }
      releaseCapture()
      setStatus('idle')
      setName((prev) => prev.trim() || defaultRecName())
      setNameOpen(true)
      saving.current = false
    } catch {
      setError(tr('micError'))
      saving.current = false
    }
  }

  async function confirmSave() {
    const data = pending.current
    if (!data || saving.current) return
    saving.current = true
    try {
      const item = await addRecording(
        {
          name: name.trim() || defaultRecName(),
          durationMs: data.durationMs,
          mimeType: data.mimeType,
          sizeBytes: data.blob.size,
          folderId,
          subjectId,
        },
        data.blob,
      )
      pending.current = null
      setNameOpen(false)
      cleanup()
      nav(`/record/${item.id}`, { replace: true })
    } catch {
      setError(tr('micError'))
      saving.current = false
    }
  }

  function cancelSave() {
    pending.current = null
    setNameOpen(false)
    cleanup()
    setStatus('idle')
    setMs(0)
    setName('')
    saving.current = false
  }

  return (
    <div className="stack">
      <div className="spread">
        <button className="chip" type="button" onClick={() => nav('/record')}>
          {tr('back')}
        </button>
      </div>
      <h1 className="page-title">{tr('newRecording')}</h1>
      <div className="card rec-stage">
        <div className="muted">{status === 'live' ? tr('recording') : status === 'paused' ? tr('paused') : tr('record')}</div>
        <div className="rec-time">{formatDuration(ms)}</div>
        <canvas ref={canvas} className="wave" />
        <button
          className={`choice-chip ${enhance ? 'active' : ''}`}
          type="button"
          onClick={() => status === 'idle' && setEnhancePersist(!enhance)}
          style={{ marginTop: 14 }}
          aria-pressed={enhance}
          disabled={status !== 'idle'}
        >
          <Sparkles size={14} />
          {tr('enhanceAudio')}
        </button>
        <div className="row" style={{ marginTop: 18, gap: 16 }}>
          {status !== 'idle' && (
            <button className="icon-btn" type="button" onClick={status === 'live' ? pause : resume} aria-label={tr('pause')}>
              {status === 'live' ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
          <button
            className={`rec-btn ${status === 'live' ? 'live' : ''}`}
            type="button"
            onClick={status === 'idle' ? start : stopAndPrompt}
            aria-label={status === 'idle' ? tr('record') : tr('stop')}
          >
            {status === 'idle' ? <Mic size={28} /> : <Square size={22} />}
          </button>
        </div>
        {error ? <p className="muted" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      </div>
      <label className="label">{tr('folder')}</label>
      <select
        className="field"
        value={folderId ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setFolderOpen(true)
            return
          }
          setFolderId(e.target.value || undefined)
        }}
      >
        <option value="">{tr('none')}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
        <option value="__new__">{tr('createNewFolder')}</option>
      </select>
      <label className="label">{tr('subject')}</label>
      <SubjectSelect value={subjectId} onChange={setSubjectId} />
      <Sheet open={folderOpen} onClose={() => setFolderOpen(false)} title={tr('newFolder')}>
        <label className="label">{tr('name')}</label>
        <input className="field" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!folderName.trim()) return
            const folder = await addFolder(folderName.trim(), 'recording')
            setFolderId(folder.id)
            setFolderName('')
            setFolderOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
      <Sheet open={nameOpen} onClose={cancelSave} title={tr('recName')}>
        <label className="label">{tr('recName')}</label>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr('recNamePlaceholder')}
        />
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn ghost" type="button" onClick={cancelSave}>
            {tr('cancel')}
          </button>
          <button className="btn accent" type="button" onClick={() => void confirmSave()}>
            {tr('save')}
          </button>
        </div>
      </Sheet>
    </div>
  )
}

export function RecordingDetailPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const { recordings, notes, notebooks, updateRecording, deleteRecording, getAudioBlob, addNote, addDownload, linkEntities, lang } = useStore()
  const rec = recordings.find((r) => r.id === id)
  const [url, setUrl] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
      <div className="spread">
        <button className="chip" type="button" onClick={() => nav('/record')}>
          {tr('back')}
        </button>
      </div>
      <input className="note-title" value={rec.name} onChange={(e) => void updateRecording(rec.id, { name: e.target.value })} />
      <div className="muted">
        {formatDateTime(rec.createdAt, lang)} · {formatDuration(rec.durationMs)}
      </div>
      <AudioPlayer
        src={url}
        name={rec.name}
        durationMs={rec.durationMs}
        mimeType={rec.mimeType}
        onArchive={async (blob) => {
          await addDownload(rec.name, blob, rec.mimeType || blob.type)
          setToast(tr('downloaded'))
        }}
      />
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
            audioId: rec.id,
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
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}
