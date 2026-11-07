import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Download, Languages } from 'lucide-react'
import { useStore } from '../store'
import { Button, Confirm, Segment, Toast, useT } from '../ui'
import { downloadBlob, formatDateTime } from '../utils'
import { exportSnapshot, type Snapshot } from '../db'
import type { AppFont, AppFontSize, NotifySound, Theme } from '../types'
import { APP_FONTS, NOTIFY_SOUNDS, labeled } from '../types'
import { resolveColor } from '../utils'
import { getNative } from '../native'
import { LanguagePrefs } from './Onboarding'

export default function SettingsPage() {
  const tr = useT()
  const nav = useNavigate()
  const { settings, setSettings, subjects, addSubject, deleteSubject, importData, markBackup, lang } = useStore()
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState<Snapshot | null>(null)
  const [newSub, setNewSub] = useState('')
  const [colorDraft, setColorDraft] = useState(settings.accentColor || '')
  const [prefs, setPrefs] = useState(false)
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
      <motion.button className="list-item pressable" type="button" onClick={() => nav('/downloads')} whileTap={{ scale: 0.95 }}>
        <Download size={18} />
        <div className="grow">{tr('downloads')}</div>
      </motion.button>
      <label className="label">{tr('yourName')}</label>
      <input className="field" value={settings.userName} onChange={(e) => void setSettings({ userName: e.target.value })} />
      <motion.button className="list-item pressable" type="button" onClick={() => setPrefs(true)} whileTap={{ scale: 0.95 }}>
        <Languages size={18} />
        <div className="grow">{tr('changeLang')}</div>
      </motion.button>
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
      <label className="label">{tr('fontFamily')}</label>
      <select
        className="field"
        value={settings.fontFamily || 'cairo'}
        onChange={(e) => void setSettings({ fontFamily: e.target.value as AppFont })}
      >
        {APP_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <label className="label">{tr('fontSize')}</label>
      <Segment
        value={settings.fontSize || 'medium'}
        onChange={(v) => void setSettings({ fontSize: v as AppFontSize })}
        options={[
          { id: 'small', label: tr('fontSmall') },
          { id: 'medium', label: tr('fontMedium') },
          { id: 'large', label: tr('fontLarge') },
        ]}
      />
      <label className="label">{tr('appColor')}</label>
      <input
        className="field"
        value={colorDraft}
        placeholder={tr('colorHint')}
        onChange={(e) => setColorDraft(e.target.value)}
      />
      <Button
        className="btn block"
        onClick={() => {
          const resolved = resolveColor(colorDraft)
          if (!resolved) {
            setToast(tr('invalidColor'))
            return
          }
          void setSettings({ accentColor: resolved })
        }}
      >
        {tr('applyColor')}
      </Button>
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
            {labeled(lang, s)}
          </option>
        ))}
      </select>
      <h3 style={{ marginBottom: 0 }}>{tr('subjects')}</h3>
      {subjects.map((s) => (
        <div key={s.id} className="list-item">
          <div className="dot" style={{ background: s.color }} />
          <div className="grow">{s.name}</div>
          <motion.button className="chip" type="button" onClick={() => void deleteSubject(s.id)} whileTap={{ scale: 0.95 }}>
            {tr('delete')}
          </motion.button>
        </div>
      ))}
      <div className="row">
        <input className="field" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder={tr('newSubject')} />
        <Button
          className="btn secondary"
          onClick={async () => {
            if (!newSub.trim()) return
            await addSubject(newSub.trim())
            setNewSub('')
          }}
        >
          {tr('add')}
        </Button>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{tr('backup')}</h3>
        <p className="muted">{tr('backupHint')}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          {tr('lastBackup')}: {settings.lastBackupAt ? formatDateTime(settings.lastBackupAt, lang) : tr('never')}
        </p>
        <Button className="btn block" onClick={() => void doExport()}>
          {tr('exportData')}
        </Button>
        <p className="muted">{tr('restoreHint')}</p>
        <Button className="btn ghost block" onClick={() => fileRef.current?.click()}>
          {tr('importData')}
        </Button>
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
      <AnimatePresence>
        {prefs ? (
          <motion.div
            className="sheet-backdrop backdrop-blur-sm"
            onClick={() => setPrefs(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="sheet bg-card border-border text-foreground"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="sheet-handle" />
              <h3 className="page-title" style={{ margin: '0 0 12px' }}>
                {tr('changeLang')}
              </h3>
              <LanguagePrefs />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
