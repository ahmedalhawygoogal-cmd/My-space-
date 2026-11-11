import { useMemo, useState } from 'react'
import { Download, Pause, Play, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, useT } from '../ui'
import { AudioPlayer } from '../AudioPlayer'
import { formatBytes, formatDateTime } from '../utils'

const PAGE = 10

export default function DownloadsPage() {
  const tr = useT()
  const { downloads, lang, getDownloadBlob, deleteDownload } = useStore()
  const [shown, setShown] = useState(PAGE)
  const [active, setActive] = useState<string | null>(null)
  const [src, setSrc] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const list = useMemo(
    () => [...downloads].sort((a, b) => b.createdAt - a.createdAt),
    [downloads],
  )
  const visible = list.slice(0, shown)

  async function play(id: string) {
    if (active === id) {
      setActive(null)
      if (src) URL.revokeObjectURL(src)
      setSrc('')
      return
    }
    const blob = await getDownloadBlob(id)
    if (!blob) return
    if (src) URL.revokeObjectURL(src)
    setSrc(URL.createObjectURL(blob))
    setActive(id)
  }

  const current = list.find((d) => d.id === active)

  return (
    <div className="stack">
      <h1 className="page-title">{tr('downloads')}</h1>
      {list.length === 0 ? (
        <Empty icon={<Download size={36} />} title={tr('noDownloads')} hint={tr('noDownloadsHint')} />
      ) : (
        visible.map((d) => (
          <div key={d.id} className="list-item">
            <div className="grow">
              <div className="ellipsis">{d.name}</div>
              <div className="meta">
                {formatBytes(d.sizeBytes, tr('kb'), tr('mb'))} · {formatDateTime(d.createdAt, lang)}
              </div>
            </div>
            <button className="icon-btn" type="button" aria-label={tr('play')} onClick={() => void play(d.id)}>
              {active === d.id ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button className="icon-btn" type="button" aria-label={tr('delete')} onClick={() => setPending(d.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
      {current && src ? (
        <AudioPlayer src={src} name={current.name} mimeType={current.mimeType} durationMs={undefined} />
      ) : null}
      {shown < list.length ? (
        <button className="btn secondary block" type="button" onClick={() => setShown((n) => n + PAGE)}>
          {tr('loadMore')}
        </button>
      ) : null}
      <Confirm
        open={!!pending}
        title={tr('deleteDownloadConfirm')}
        danger
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) {
            if (active === pending) {
              setActive(null)
              if (src) URL.revokeObjectURL(src)
              setSrc('')
            }
            await deleteDownload(pending)
          }
          setPending(null)
        }}
      />
    </div>
  )
}
