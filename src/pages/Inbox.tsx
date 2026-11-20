import { useMemo, useState } from 'react'
import { CheckSquare, Inbox as InboxIcon, Mic, Send, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { SpaceSwitcher } from '../components/Spaces'
import { Empty, Sheet, useT } from '../ui'
import type { InboxItem } from '../types'

type TriageAction = 'task' | 'note' | 'delete'

export default function InboxPage() {
  const tr = useT()
  const { inboxItems, activeSpaceId, addInboxItem, triageInboxItem, deleteInboxItem } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [triage, setTriage] = useState<InboxItem | null>(null)

  const items = useMemo(
    () => (activeSpaceId ? inboxItems.filter((x) => x.space_id === activeSpaceId) : inboxItems),
    [inboxItems, activeSpaceId],
  )

  async function capture() {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      await addInboxItem({ type: 'note', title: value, body: value })
      setText('')
    } finally {
      setBusy(false)
    }
  }

  async function run(action: TriageAction) {
    const target = triage
    if (!target) return
    setTriage(null)
    if (action === 'delete') {
      await deleteInboxItem(target.id)
      return
    }
    await triageInboxItem(target.id, action)
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title">{tr('inbox')}</h1>
        <SpaceSwitcher />
      </div>

      <div className="card inbox-capture">
        <input
          className="field"
          value={text}
          placeholder={tr('capturePlaceholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void capture()
          }}
        />
        <div className="row" style={{ gap: 8 }}>
          <button
            className="icon-btn"
            type="button"
            disabled
            aria-label={tr('voiceCaptureSoon')}
            title={tr('voiceCaptureSoon')}
          >
            <Mic size={18} />
          </button>
          <button className="btn" type="button" disabled={!text.trim() || busy} onClick={() => void capture()}>
            <Send size={16} />
            {tr('addToInbox')}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty icon={<InboxIcon size={36} />} title={tr('noInboxItems')} hint={tr('noInboxItemsHint')} />
      ) : (
        items.map((item) => (
          <div key={item.id} className="card inbox-item">
            <div className="grow" style={{ minWidth: 0, textAlign: 'start' }}>
              <b style={{ display: 'block', overflowWrap: 'anywhere' }}>{item.title}</b>
              {item.body && item.body !== item.title ? (
                <p className="muted" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
                  {item.body}
                </p>
              ) : null}
              <span className="muted" style={{ fontSize: 12 }}>
                {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
            <button className="btn ghost" type="button" onClick={() => setTriage(item)}>
              {tr('triage')}
            </button>
          </div>
        ))
      )}

      <Sheet open={!!triage} onClose={() => setTriage(null)} title={tr('triage')}>
        <p className="muted" style={{ marginTop: 0, overflowWrap: 'anywhere' }}>
          {triage?.title}
        </p>
        <div className="stack">
          <button className="btn" type="button" onClick={() => void run('task')}>
            <CheckSquare size={16} />
            {tr('convertToTask')}
          </button>
          <button className="btn" type="button" onClick={() => void run('note')}>
            <StickyNote size={16} />
            {tr('convertToNote')}
          </button>
          <button className="btn danger" type="button" onClick={() => void run('delete')}>
            <Trash2 size={16} />
            {tr('deleteFromInbox')}
          </button>
        </div>
      </Sheet>
    </div>
  )
}
