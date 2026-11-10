import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Languages } from 'lucide-react'
import { useStore } from '../store'
import { useAuth } from '../auth'
import { Confirm, Segment, Toast, useT } from '../ui'
import { formatDateTime } from '../utils'
import { exportSnapshot, type Snapshot } from '../db'
import type { AppFont, AppFontSize, NotifySound, Theme } from '../types'
import { APP_FONTS, NOTIFY_SOUNDS, labeled } from '../types'
import { resolveColor } from '../utils'
import { getNative } from '../native'
import { LanguagePrefs } from './Onboarding'
import { InfoTooltip } from '../components/InfoTooltip'
import { PAGE_BG, PageBg } from '../components/PageBg'
import { isCloudSyncEnabled, setCloudSyncEnabled } from '../lib/cloudPref'
import { uploadLocalDataToCloud } from '../lib/cloudUpload'
import { saveBlobToDevice, shareBlob } from '../lib/nativeFiles'
import { version } from '../../package.json'

export default function SettingsPage() {
  const tr = useT()
  const nav = useNavigate()
  const { settings, setSettings, subjects, addSubject, deleteSubject, importData, markBackup, lang } = useStore()
  const { signOut } = useAuth()
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState<Snapshot | null>(null)
  const [newSub, setNewSub] = useState('')
  const [colorDraft, setColorDraft] = useState(settings.accentColor || '')
  const [prefs, setPrefs] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [cloudOn, setCloudOn] = useState(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false
    return isCloudSyncEnabled()
  })
  const [consent, setConsent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const backupRef = useRef<{ blob: Blob; file: File } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function forceCloudOff() {
      setOnline(false)
      setCloudOn(false)
      setCloudSyncEnabled(false)
      setConsent(false)
    }
    function onOnline() {
      setOnline(true)
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) forceCloudOff()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', forceCloudOff)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', forceCloudOff)
    }
  }, [])

  async function prepareBackup() {
    if (backupRef.current) return backupRef.current
    const snap = await exportSnapshot()
    const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' })
    const file = new File([blob], 'myspace-backup.json', { type: 'application/json' })
    backupRef.current = { blob, file }
    return backupRef.current
  }

  async function openExport() {
    setExportBusy(true)
    try {
      await prepareBackup()
      setExportOpen(true)
    } catch {
      setToast(tr('error'))
    } finally {
      setExportBusy(false)
    }
  }

  async function exportDownload() {
    try {
      const { blob } = await prepareBackup()
      const dest = await saveBlobToDevice(blob, 'myspace-backup.json')
      await markBackup()
      setExportOpen(false)
      backupRef.current = null
      setToast(dest === 'native' ? tr('savedToDocuments') : tr('downloadedToDownloads'))
    } catch {
      setToast(tr('error'))
    }
  }

  async function exportShare() {
    try {
      const { blob } = await prepareBackup()
      const result = await shareBlob(blob, 'myspace-backup.json', 'MySpace Backup')
      if (result === 'aborted') return
      await markBackup()
      setExportOpen(false)
      backupRef.current = null
      if (result === 'shared') setToast(tr('exported'))
      else setToast(tr('shareUnsupported'))
    } catch {
      setToast(tr('error'))
    }
  }

  return (
    <PageBg src={PAGE_BG.settings}>
    <div className="stack">
      <h1 className="page-title">{tr('settings')}</h1>
      <button className="list-item pressable" type="button" onClick={() => nav('/downloads')}>
        <Download size={18} />
        <div className="grow">{tr('downloads')}</div>
      </button>
      <label className="label">{tr('yourName')}</label>
      <input className="field" value={settings.userName} onChange={(e) => void setSettings({ userName: e.target.value })} />
      <button className="list-item pressable" type="button" onClick={() => setPrefs(true)}>
        <Languages size={18} />
        <div className="grow">{tr('changeLang')}</div>
      </button>
      <h3 style={{ marginTop: 0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {tr('cloudSync')}
        <InfoTooltip text={tr('cloudSyncHint')} />
      </h3>
      <Segment
        value={cloudOn ? 'on' : 'off'}
        disabled={!online}
        onChange={(v) => {
          if (!online) return
          const on = v === 'on'
          setCloudOn(on)
          setCloudSyncEnabled(on)
          if (on) setConsent(true)
        }}
        options={[
          { id: 'on', label: tr('on') },
          { id: 'off', label: tr('off') },
        ]}
      />
      {!online ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {tr('cloudOfflineHint')}
        </p>
      ) : null}
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
      <button
        className="btn block"
        type="button"
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
      </button>
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
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {tr('backup')}
          <InfoTooltip text={tr('backupShareHint')} />
        </h3>
        <p className="muted">{tr('backupHint')}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          {tr('lastBackup')}: {settings.lastBackupAt ? formatDateTime(settings.lastBackupAt, lang) : tr('never')}
        </p>
        <button className="btn block" type="button" disabled={exportBusy} onClick={() => void openExport()}>
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
      <button className="btn ghost block" type="button" onClick={() => setLogoutOpen(true)}>
        {tr('logout')}
      </button>
      <div className="card-quiet">
        <h3 style={{ marginTop: 0 }}>{tr('about')}</h3>
        <p className="muted">{tr('aboutText')}</p>
        <div className="muted">
          {tr('version')} {version}
        </div>
      </div>
      {prefs ? (
        <div className="sheet-backdrop" onClick={() => setPrefs(false)}>
          <div className="sheet bg-card border-border text-foreground" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="page-title" style={{ margin: '0 0 12px' }}>
              {tr('changeLang')}
            </h3>
            <LanguagePrefs />
          </div>
        </div>
      ) : null}
      {exportOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            setExportOpen(false)
            backupRef.current = null
          }}
        >
          <div className="dialog modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{tr('exportData')}</h3>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn block" type="button" onClick={() => void exportDownload()}>
                {tr('download')}
              </button>
              <button className="btn ghost block" type="button" onClick={() => void exportShare()}>
                {tr('share')}
              </button>
              <button
                className="btn ghost block"
                type="button"
                onClick={() => {
                  setExportOpen(false)
                  backupRef.current = null
                }}
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {logoutOpen ? (
        <div className="modal-backdrop" onClick={() => setLogoutOpen(false)}>
          <div className="dialog modal-panel" onClick={(e) => e.stopPropagation()}>
            <p className="muted" style={{ marginTop: 0 }}>
              {tr('logoutConfirmBody')}
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
              <button className="btn ghost" type="button" onClick={() => setLogoutOpen(false)}>
                {tr('cancel')}
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  setLogoutOpen(false)
                  void signOut()
                }}
              >
                {tr('logoutConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {consent ? (
        <div className="modal-backdrop" onClick={() => !uploading && setConsent(false)}>
          <div className="dialog modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{tr('cloudConsentTitle')}</h3>
            <p className="muted">{tr('cloudConsentBody')}</p>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
              <button className="btn ghost" type="button" disabled={uploading} onClick={() => setConsent(false)}>
                {tr('cloudConsentLater')}
              </button>
              <button
                className="btn"
                type="button"
                disabled={uploading}
                onClick={() => {
                  void (async () => {
                    setUploading(true)
                    try {
                      await uploadLocalDataToCloud()
                      setToast(tr('cloudUploadDone'))
                    } catch {
                      setToast(tr('cloudUploadError'))
                    } finally {
                      setUploading(false)
                      setConsent(false)
                    }
                  })()
                }}
              >
                {tr('cloudConsentYes')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    </PageBg>
  )
}
