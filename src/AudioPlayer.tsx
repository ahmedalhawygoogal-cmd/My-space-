import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { Toast, useT } from './ui'
import { audioFileName, formatDuration } from './utils'
import { saveBlobToDevice } from './lib/nativeFiles'

const RATES = [1, 1.5, 2] as const

export function AudioPlayer({
  src,
  name,
  durationMs,
  mimeType,
  onArchive,
}: {
  src?: string
  name: string
  durationMs?: number
  mimeType?: string
  onArchive?: (blob: Blob) => void | Promise<void>
}) {
  const tr = useT()
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [dur, setDur] = useState(durationMs ?? 0)
  const [rate, setRate] = useState<(typeof RATES)[number]>(1)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const el = audio.current
    if (el) el.playbackRate = rate
  }, [rate])

  useEffect(() => {
    setPos(0)
    setPlaying(false)
    if (durationMs) setDur(durationMs)
  }, [src, durationMs])

  function seek(delta: number) {
    const el = audio.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta))
  }

  async function exportAudio() {
    const el = audio.current
    if (!el?.src) return
    try {
      const res = await fetch(el.src)
      const blob = await res.blob()
      const filename = audioFileName(name, mimeType || blob.type)
      const dest = await saveBlobToDevice(blob, filename)
      await onArchive?.(blob)
      setToast(dest === 'native' ? tr('savedToDocuments') : tr('downloaded'))
    } catch {
      setToast(tr('error'))
    }
  }

  const max = Math.max(1, dur)

  return (
    <div className="card player">
      {src ? (
        <audio
          ref={audio}
          src={src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={() => setPos((audio.current?.currentTime ?? 0) * 1000)}
          onLoadedMetadata={(e) => {
            const next = e.currentTarget.duration * 1000
            if (Number.isFinite(next) && next > 0) setDur(next)
            e.currentTarget.playbackRate = rate
          }}
        />
      ) : null}
      <div className="row player-line">
        <button
          className="icon-btn"
          type="button"
          aria-label={tr('play')}
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
          max={max}
          value={Math.min(pos, max)}
          onChange={(e) => {
            const v = Number(e.target.value)
            setPos(v)
            if (audio.current) audio.current.currentTime = v / 1000
          }}
        />
        <span className="muted" style={{ fontSize: 12, minWidth: 40 }}>
          {formatDuration(pos)}
        </span>
      </div>
      <div className="row player-actions">
        <button className="icon-btn" type="button" aria-label={tr('rewind')} onClick={() => seek(-10)}>
          <RotateCcw size={16} />
        </button>
        <button className="icon-btn" type="button" aria-label={tr('forward')} onClick={() => seek(10)}>
          <RotateCw size={16} />
        </button>
        <button
          className="chip"
          type="button"
          aria-label={tr('speed')}
          onClick={() => setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
        >
          {rate}x
        </button>
        <button className="icon-btn" type="button" aria-label={tr('download')} onClick={() => void exportAudio()} disabled={!src}>
          <Download size={16} />
        </button>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}
