import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Confirm, Segment, Toast, useT } from '../ui'
import { downloadBlob, formatDateTime } from '../utils'
import { exportSnapshot, type Snapshot } from '../db'
import type { Lang, NotifySound, Theme } from '../types'
import { NOTIFY_SOUNDS } from '../types'
import { getNative } from '../native'

export default function SettingsPage() {
  const tr = useT()
  const { settings, setSettings, subjects, addSubject, deleteSubject, importData, markBackup, lang } = useStore()
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState<Snapshot | null>(null)
  const [newSub, setNewSub] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function doExport() {
    const snap = await exportSnapshot()
    const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' })
    downloadBlob(blob, `myspace-backup-${new Date().toISOString().slice(0, 10)}.json`)
    await markBackup()
    setToast(tr('exported'))
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('settings')}</h1>
      <label className="label">{tr('yourName')}</label>
      <input className="field" value={settings.userName} onChange={(e) => void setSettings({ userName: e.target.value })} />
      <label className="label">{tr('language')}</label>
      <Segment
        value={settings.language}
        onChange={(v) => void setSettings({ language: v as Lang })}
        options={[
          { id: 'ar', label: tr('arabic') },
          { id: 'en', label: tr('english') },
        ]}
      />
      <label className="label">{tr('theme')}</label>
      <Segment
        value={settings.theme}
        onChange={(v) => void setSettings({ theme: v as Theme })}
        options={[
          { id: 'light', label: tr('light') },
          { id: 'dark', label: tr('dark') },
          { id: 'system', label: tr('system') },
        ]}
      />
      <label className="label">{tr('speakRepeats')}</label>
      <Segment
        value={String(settings.speakRepeats ?? 1)}
        onChange={(v) => void setSettings({ speakRepeats: Number(v) as 1 | 2 | 3 | 5 })}
        options={[
          { id: '1', label: '1' },
          { id: '2', label: '2' },
          { id: '3', label: '3' },
          { id: '5', label: '5' },
        ]}
      />
      <label className="label">{tr('cardReminders')}</label>
      <Segment
        value={settings.cardReminders ? 'on' : 'off'}
        onChange={(v) => {
          void (async () => {
            if (v === 'on') {
              const native = await getNative()
              if (native) {
                const ok = await native.requestNotify()
                if (!ok) {
                  setToast(tr('notifyDenied'))
                  return
                }
              }
            }
            await setSettings({ cardReminders: v === 'on' })
          })()
        }}
        options={[
          { id: 'on', label: tr('on') },
          { id: 'off', label: tr('off') },
        ]}
      />
      <label className="label">{tr('notifySound')}</label>
      <select
        className="field"
        value={settings.notifySound ?? 'default'}
        onChange={(e) => void setSettings({ notifySound: e.target.value as NotifySound })}
      >
        {NOTIFY_SOUNDS.map((s) => (
          <option key={s.id} value={s.id}>
            {lang === 'ar' ? s.ar : s.en}
          </option>
        ))}
      </select>
      <h3 style={{ marginBottom: 0 }}>{tr('subjects')}</h3>
      {subjects.map((s) => (
        <div key={s.id} className="list-item">
          <div className="dot" style={{ background: s.color }} />
          <div className="grow">{s.name}</div>
          <button className="chip" type="button" onClick={() => void deleteSubject(s.id)}>
            {tr('delete')}
          </button>
        </div>
      ))}
      <div className="row">
        <input className="field" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder={tr('newSubject')} />
        <button
          className="btn secondary"
          type="button"
          onClick={async () => {
            if (!newSub.trim()) return
            await addSubject(newSub.trim())
            setNewSub('')
          }}
        >
          {tr('add')}
        </button>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{tr('backup')}</h3>
        <p className="muted">{tr('backupHint')}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          {tr('lastBackup')}: {settings.lastBackupAt ? formatDateTime(settings.lastBackupAt, lang) : tr('never')}
        </p>
        <button className="btn block" type="button" onClick={() => void doExport()}>
          {tr('exportData')}
        </button>
        <p className="muted">{tr('restoreHint')}</p>
        <button className="btn ghost block" type="button" onClick={() => fileRef.current?.click()}>
          {tr('importData')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const text = await f.text()
            try {
              const snap = JSON.parse(text) as Snapshot
              setPending(snap)
              setConfirm(true)
            } catch {
              setToast(tr('error'))
            }
            e.target.value = ''
          }}
        />
      </div>
      <div className="card-quiet">
        <h3 style={{ marginTop: 0 }}>{tr('about')}</h3>
        <p className="muted">{tr('aboutText')}</p>
        <div className="muted">
          {tr('version')} 1.0.0 · {tr('offline')}
        </div>
      </div>
      <Confirm
        open={confirm}
        title={tr('restoreConfirm')}
        danger
        onClose={() => {
          setConfirm(false)
          setPending(null)
        }}
        onConfirm={async () => {
          if (pending) {
            await importData(pending)
            setToast(tr('imported'))
          }
          setConfirm(false)
          setPending(null)
        }}
      />
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}
