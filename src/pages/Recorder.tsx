import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, CloudUpload, FolderPlus, Loader2, Mic, Pause, Pencil, Play, Sparkles, Square, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { AudioPlayer } from '../AudioPlayer'
import { Confirm, Empty, Segment, Sheet, SubjectSelect, TagInput, Toast, useT } from '../ui'
import type { RecDistance, Recording } from '../types'
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

import { Waveform } from '../components/Waveform'
import { formatDateTime, formatDuration, pickMime } from '../utils'

const WAVE_BARS = 48

function RecDistanceSeg({
  value,
  onChange,
  disabled,
}: {
  value: RecDistance
  onChange: (v: RecDistance) => void
  disabled?: boolean
}) {
  const tr = useT()
  return (
    <div className="rec-distance">
      <label className="label text-muted-foreground">{tr('recDistance')}</label>
      <Segment
        value={value}
        onChange={(v) => {
          if (disabled) return
          onChange(v as RecDistance)
        }}
        options={[
          { id: 'near', label: tr('distNear') },
          { id: 'medium', label: tr('distMedium') },
          { id: 'far', label: tr('distFar') },
        ]}
      />
    </div>
  )
}

function RecListCard({ rec }: { rec: Recording }) {
  const tr = useT()
  const nav = useNavigate()
  const { subjects, lang, getAudioBlob, getOriginalAudioBlob, enhanceRecordingAudio, updateRecording, deleteRecording, addDownload } = useStore()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cloudStep, setCloudStep] = useState<'upload' | 'process'>('upload')
  const [playerKey, setPlayerKey] = useState(0)
  const sub = subjects.find((s) => s.id === rec.subjectId)

  useEffect(() => {
    if (!open) return
    let alive = true
    let objectUrl: string | undefined
    void getAudioBlob(rec.id).then((blob) => {
      if (!alive || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, rec.id, rec.updatedAt, getAudioBlob])

  async function enhance() {
    if (enhancing) return
    setEnhancing(true)
    try {
      const src = (await getOriginalAudioBlob(rec.id)) || (await getAudioBlob(rec.id))
      if (!src) throw new Error('missing')
      const { enhanceAudioBlob } = await import('../enhanceAudio')
      const next = await enhanceAudioBlob(src, rec.distance)
      await enhanceRecordingAudio(rec.id, next.blob, {
        mimeType: next.mimeType,
        durationMs: next.durationMs,
        sizeBytes: next.blob.size,
      })
      setPlayerKey((k) => k + 1)
      setToast(tr('enhanceAudioDone'))
    } catch {
      setToast(tr('enhanceAudioError'))
    } finally {
      setEnhancing(false)
    }
  }

  async function uploadCloud() {
    if (uploading || enhancing) return
    setUploading(true)
    setCloudStep('upload')
    try {
      const src = (await getOriginalAudioBlob(rec.id)) || (await getAudioBlob(rec.id))
      if (!src) throw new Error('missing')
      const { uploadRecordingToCloud } = await import('../utils/cloudUpload')
      const { url: cloudUrl } = await uploadRecordingToCloud(rec.id, src)
      await updateRecording(rec.id, { cloudUrl })
      setCloudStep('process')
      const { enhanceAudioWithNVIDIA } = await import('../utils/nvidiaAI')
      const enhanced = await enhanceAudioWithNVIDIA(src)
      await enhanceRecordingAudio(rec.id, enhanced, {
        mimeType: enhanced.type || 'audio/wav',
        sizeBytes: enhanced.size,
        cloudUrl,
      })
      setPlayerKey((k) => k + 1)
      setToast(tr('cloudEnhanceDone'))
    } catch {
      setToast(tr('cloudEnhanceError'))
    } finally {
      setUploading(false)
      setCloudStep('upload')
    }
  }

  return (
    <div className="card rec-card bg-card border">
      <div className="rec-card-head">
        <div className="dot" style={{ background: sub?.color ?? 'var(--accent)' }} />
        <div className="rec-card-body grow">
          <div className="rec-card-title ellipsis text-foreground">{rec.name}</div>
          <div className="rec-card-date">
            {formatDateTime(rec.createdAt, lang)} · {formatDuration(rec.durationMs)}
          </div>
        </div>
        <div className="rec-card-actions">
          <button className="icon-btn" type="button" aria-label={tr('edit')} onClick={() => nav(`/record/${rec.id}`)}>
            <Pencil size={16} />
          </button>
          <button className="icon-btn" type="button" aria-label={tr('delete')} onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
          </button>
          <button
            className={`icon-btn chev ${open ? 'open' : ''}`}
            type="button"
            aria-expanded={open}
            aria-label={tr('seeAll')}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="rec-card-panel">
          <div className="rec-player-wrap bg-muted/50 rounded-xl p-4">
            <AudioPlayer
              key={playerKey}
              src={url}
              name={rec.name}
              durationMs={rec.durationMs}
              mimeType={rec.mimeType}
              onArchive={async (blob) => {
                await addDownload(rec.name, blob, rec.mimeType || blob.type)
                setToast(tr('downloaded'))
              }}
            />
            <button
              className="btn accent"
              type="button"
              onClick={() => void enhance()}
              disabled={enhancing || uploading}
              style={{ marginTop: 12, width: '100%' }}
            >
              {enhancing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {enhancing ? tr('enhanceAudioBusy') : tr('enhanceAudio')}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => void uploadCloud()}
              disabled={enhancing || uploading}
              style={{ marginTop: 8, width: '100%' }}
            >
              {uploading ? <Loader2 size={16} className="spin" /> : <CloudUpload size={16} />}
              {uploading
                ? tr(cloudStep === 'process' ? 'cloudEnhanceProcessing' : 'cloudEnhanceBusy')
                : tr('cloudEnhance')}
            </button>
          </div>
          <div className="rec-card-meta">
            <div className="rec-meta-row">
              <div className="rec-meta-label text-muted-foreground">{tr('description')}:</div>
              <div className="rec-meta-value text-foreground">{rec.description.trim() || tr('none')}</div>
            </div>
            <div className="rec-meta-row">
              <div className="rec-meta-label text-muted-foreground">{tr('tags')}:</div>
              <div className="rec-meta-value text-foreground">
                {rec.tags.length ? (
                  <div className="rec-card-tags">
                    {rec.tags.map((t) => (
                      <span key={t} className="chip">{t}</span>
                    ))}
                  </div>
                ) : (
                  tr('none')
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Confirm
        open={confirm}
        title={tr('deleteRecConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteRecording(rec.id)
        }}
      />
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}

export default function RecorderPage() {
  const tr = useT()
  const nav = useNavigate()
  const { recordings, folders, addFolder } = useStore()
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
    <div className="stack rec-list">
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
        list.map((r) => <RecListCard key={r.id} rec={r} />)
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
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [hasPending, setHasPending] = useState(false)
  const [distance, setDistance] = useState<RecDistance>('medium')
  const recRef = useRef<MediaRecorder | null>(null)
  const nativeRef = useRef(false)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | null>(null)
  const started = useRef(0)
  const pausedAt = useRef(0)
  const acc = useRef(0)
  const audioCtx = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const raf = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const ampBuf = useRef<number[]>(Array.from({ length: WAVE_BARS }, () => 0))
  const lastLevelAt = useRef(0)
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: WAVE_BARS }, () => 0))
  const saving = useRef(false)
  const pending = useRef<{ blob: Blob; mimeType: string; durationMs: number } | null>(null)

  function defaultRecName() {
    const locale = lang === 'ar' ? 'ar-EG' : lang
    return `${tr('newRecording')} - ${new Date().toLocaleTimeString(locale)}`
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
    ampBuf.current = Array.from({ length: WAVE_BARS }, () => 0)
    setLevels(ampBuf.current)
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

  function pushLevel(amp: number, force = false) {
    const v = Math.max(0, Math.min(1, Number.isFinite(amp) ? amp : 0))
    const next = ampBuf.current.slice(1)
    next.push(v)
    ampBuf.current = next
    const now = Date.now()
    if (!force && now - lastLevelAt.current < 50) return
    lastLevelAt.current = now
    setLevels(next)
  }

  function draw() {
    const an = analyser.current
    if (!an) return
    const data = new Uint8Array(an.fftSize)
    an.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const s = (data[i] - 128) / 128
      sum += s * s
    }
    pushLevel(Math.sqrt(sum / data.length) * 1.8)
    raf.current = requestAnimationFrame(draw)
  }

  async function drawNative() {
    if (!nativeRef.current) return
    const amp = await nativeAmplitude()
    if (!nativeRef.current) return
    pushLevel(amp)
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
      graph = await createProcessedRecordingGraph(raw)
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
    if (hasPending) cancelSave()
    setError('')
    try {
      if (isNativePlatform()) {
        nativeRef.current = true
        await startNativeRecording()
        ampBuf.current = Array.from({ length: WAVE_BARS }, () => 0)
        setLevels(ampBuf.current)
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
      setHasPending(true)
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
          description,
          tags,
          distance,
        },
        data.blob,
      )
      pending.current = null
      setHasPending(false)
      cleanup()
      nav(`/record/${item.id}`, { replace: true })
    } catch {
      setError(tr('micError'))
      saving.current = false
    }
  }

  function cancelSave() {
    pending.current = null
    setHasPending(false)
    cleanup()
    setStatus('idle')
    setMs(0)
    setName('')
    setDescription('')
    setTags([])
    saving.current = false
  }

  const busy = status !== 'idle'

  return (
    <div className="stack">
      <div className="spread">
        <button
          className="chip"
          type="button"
          onClick={() => {
            cancelSave()
            nav('/record')
          }}
        >
          {tr('back')}
        </button>
      </div>
      <h1 className="page-title">{tr('newRecording')}</h1>
      <div className="card rec-stage bg-card border">
        <div className="text-muted-foreground">
          {status === 'live' ? tr('recording') : status === 'paused' ? tr('paused') : tr('record')}
        </div>
        <div className="rec-time text-5xl font-bold text-foreground">{formatDuration(ms)}</div>
        <Waveform amplitudes={levels} distance={distance} />
        <RecDistanceSeg value={distance} onChange={setDistance} />
        <div className="row" style={{ marginTop: 18, gap: 16 }}>
          {busy && (
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
            {status === 'idle' ? <Mic size={32} /> : <Square size={26} />}
          </button>
        </div>
        {error ? <p className="text-muted-foreground">{error}</p> : null}
      </div>
      <div className="rec-form bg-card border rounded-2xl p-4">
        <label className="label text-muted-foreground">{tr('name')}</label>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr('recNamePlaceholder')}
        />
        <label className="label text-muted-foreground">{tr('description')}</label>
        <textarea className="field textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="label text-muted-foreground">{tr('tags')}</label>
        <TagInput value={tags} onChange={setTags} />
        <label className="label text-muted-foreground">{tr('folder')}</label>
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
        <label className="label text-muted-foreground">{tr('subject')}</label>
        <SubjectSelect value={subjectId} onChange={setSubjectId} />
      </div>
      <button
        className="btn block rec-save bg-primary text-primary-foreground"
        type="button"
        disabled={!hasPending}
        onClick={() => void confirmSave()}
      >
        {tr('save')}
      </button>
      <Sheet open={folderOpen} onClose={() => setFolderOpen(false)} title={tr('newFolder')}>
        <label className="label">{tr('name')}</label>
        <input className="field" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        <button
          className="btn block"
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
    </div>
  )
}

export function RecordingDetailPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const { recordings, notes, notebooks, updateRecording, getAudioBlob, addNote, addDownload, linkEntities, lang } = useStore()
  const rec = recordings.find((r) => r.id === id)
  const [url, setUrl] = useState<string>()
  const [noteOpen, setNoteOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [subjectId, setSubjectId] = useState<string | undefined>()
  const [distance, setDistance] = useState<RecDistance>('medium')
  const loaded = useRef('')

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

  useEffect(() => {
    if (!rec || loaded.current === rec.id) return
    loaded.current = rec.id
    setName(rec.name)
    setDescription(rec.description)
    setTags(rec.tags)
    setSubjectId(rec.subjectId)
    setDistance(rec.distance || 'medium')
  }, [rec])

  if (!rec) return <Empty icon={<Mic />} title={tr('noRecordings')} />

  const item = rec
  const linked = notes.filter((n) => item.noteIds.includes(n.id) || n.recordingIds.includes(item.id))

  async function persist() {
    await updateRecording(item.id, {
      name: name.trim() || item.name,
      description,
      tags,
      subjectId,
      distance,
    })
    nav('/record')
  }

  return (
    <div className="stack">
      <div className="spread">
        <button className="chip" type="button" onClick={() => nav('/record')}>
          {tr('back')}
        </button>
      </div>
      <div className="card rec-stage bg-card border">
        <div className="text-muted-foreground">
          {formatDateTime(item.createdAt, lang)}
        </div>
        <div className="rec-time text-5xl font-bold text-foreground">{formatDuration(item.durationMs)}</div>
        <div className="rec-player-wrap bg-muted/50 rounded-xl p-4 w-full">
          <AudioPlayer
            src={url}
            name={name || item.name}
            durationMs={item.durationMs}
            mimeType={item.mimeType}
            onArchive={async (blob) => {
              await addDownload(name || item.name, blob, item.mimeType || blob.type)
              setToast(tr('downloaded'))
            }}
          />
        </div>
      </div>
      <div className="rec-form bg-card border rounded-2xl p-4">
        <label className="label text-muted-foreground">{tr('name')}</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label text-muted-foreground">{tr('description')}</label>
        <textarea className="field textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="label text-muted-foreground">{tr('tags')}</label>
        <TagInput value={tags} onChange={setTags} />
        <label className="label text-muted-foreground">{tr('subject')}</label>
        <SubjectSelect value={subjectId} onChange={setSubjectId} />
        <RecDistanceSeg value={distance} onChange={setDistance} />
      </div>
      <div className="spread">
        <h3 className="text-foreground" style={{ margin: 0, fontSize: '1rem' }}>{tr('attachedNotes')}</h3>
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
            title: name.trim() || item.name,
            content: description,
            subjectId,
            audioId: item.id,
            recordingIds: [item.id],
          })
          await linkEntities('recording', item.id, 'note', note.id)
          nav(`/notes/${note.id}`)
        }}
      >
        {tr('createNoteFromRec')}
      </button>
      <button className="btn block rec-save bg-primary text-primary-foreground" type="button" onClick={() => void persist()}>
        {tr('save')}
      </button>
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={tr('attachToNote')}>
        {notes.map((n) => (
          <button
            key={n.id}
            className="list-item"
            type="button"
            onClick={async () => {
              await linkEntities('recording', item.id, 'note', n.id)
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
