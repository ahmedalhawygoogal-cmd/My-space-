import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useStore } from '../store'
import { CloseBtn, Toast, useT } from '../ui'
import type { DailyGoal, GoalKind, InputPref, Labeled, Lang, UserLevel } from '../types'
import {
  DAILY_OPTS,
  GOAL_OPTS,
  INPUT_PREF_OPTS,
  LEARN_LANGS,
  LEVEL_OPTS,
  labeled,
  uiLangFromNative,
} from '../types'

const SURVEY_STEPS = 4

function langName(code: string, ui: Lang) {
  const row = LEARN_LANGS.find((l) => l.code === code)
  return row ? labeled(ui, row) : code
}

export function LanguageSheet({
  open,
  title,
  selected,
  onClose,
  onPick,
}: {
  open: boolean
  title: string
  selected?: string
  onClose: () => void
  onPick: (code: string) => void
}) {
  const tr = useT()
  const { lang } = useStore()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return LEARN_LANGS
        return LEARN_LANGS.filter((l) => {
          const blob = Object.values(l).join(' ').toLowerCase()
          return blob.includes(needle)
        })
  }, [q])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet bg-card border-border text-foreground" onClick={(e) => e.stopPropagation()}>
        <CloseBtn variant="modal" onClick={onClose} />
        <div className="sheet-handle" />
        <h3 className="page-title" style={{ margin: '0 0 12px' }}>
          {title}
        </h3>
        <input
          className="field"
          value={q}
          placeholder={tr('searchLang')}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="lang-list">
          {rows.length ? (
            rows.map((l) => {
              const on = selected === l.code
              return (
                <button
                  key={l.code}
                  type="button"
                  className={`lang-row${on ? ' active' : ''}`}
                  onClick={() => {
                    onPick(l.code)
                    setQ('')
                    onClose()
                  }}
                >
                  <span>{labeled(lang, l)}</span>
                  {on ? <Check size={18} /> : null}
                </button>
              )
            })
          ) : (
            <p className="muted">{tr('noLangMatch')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Chips({
  items,
  active,
  onPick,
  lang,
}: {
  items: ({ id: string } & Labeled)[]
  active: (id: string) => boolean
  onPick: (id: string) => void
  lang: Lang
}) {
  return (
    <div className="chip-row wrap">
      {items.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`choice-chip${active(o.id) ? ' active' : ''}`}
          onClick={() => onPick(o.id)}
        >
          {labeled(lang, o)}
        </button>
      ))}
    </div>
  )
}

export function LanguagePrefs({ onContinue }: { onContinue?: () => void }) {
  const tr = useT()
  const { settings, setSettings, lang } = useStore()
  const [sheet, setSheet] = useState<'native' | 'target' | null>(null)
  const native = settings.nativeLang && settings.nativeLang !== 'other' ? settings.nativeLang : ''
  const target = settings.targetLangs?.find((c) => c && c !== 'other') || ''

  return (
    <div className="stack">
      <button className="lang-pick-btn" type="button" onClick={() => setSheet('native')}>
        <span className="muted">{tr('selectNativeLang')}</span>
        <strong>{native ? langName(native, lang) : tr('pickOne')}</strong>
      </button>
      <button className="lang-pick-btn" type="button" onClick={() => setSheet('target')}>
        <span className="muted">{tr('selectTargetLang')}</span>
        <strong>{target ? langName(target, lang) : tr('pickOne')}</strong>
      </button>
      {onContinue ? (
        <button className="btn block" type="button" disabled={!native || !target} onClick={onContinue}>
          {tr('next')}
        </button>
      ) : null}
      <LanguageSheet
        open={sheet === 'native'}
        title={tr('selectNativeLang')}
        selected={native}
        onClose={() => setSheet(null)}
        onPick={(code) => {
          void setSettings({ language: uiLangFromNative(code), nativeLang: code, nativeLangOther: '' })
        }}
      />
      <LanguageSheet
        open={sheet === 'target'}
        title={tr('selectTargetLang')}
        selected={target}
        onClose={() => setSheet(null)}
        onPick={(code) => {
          void setSettings({ targetLangs: [code], targetLangOther: '' })
        }}
      />
    </div>
  )
}

export default function OnboardingPage() {
  const tr = useT()
  const nav = useNavigate()
  const { settings, setSettings, lang } = useStore()
  const [phase, setPhase] = useState<'langs' | 'survey'>('langs')
  const [step, setStep] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [goal, setGoal] = useState<GoalKind>(settings.goal === 'productivity' || settings.goal === 'record' || settings.goal === 'all' ? settings.goal : 'study')
  const [dailyGoal, setDailyGoal] = useState<DailyGoal>(settings.dailyGoal === '10' || settings.dailyGoal === '60' ? settings.dailyGoal : '30')
  const [inputPref, setInputPref] = useState<InputPref>(settings.inputPref === 'type' || settings.inputPref === 'voice' ? settings.inputPref : 'both')
  const [userLevel, setUserLevel] = useState<UserLevel>(
    settings.userLevel === 'intermediate' || settings.userLevel === 'advanced' ? settings.userLevel : 'beginner',
  )

  const native = settings.nativeLang && settings.nativeLang !== 'other' ? settings.nativeLang : ''
  const target = settings.targetLangs?.find((c) => c && c !== 'other') || ''

  function go(next: number) {
    setLeaving(true)
    window.setTimeout(() => {
      setStep(next)
      setLeaving(false)
    }, 180)
  }

  async function finish() {
    await setSettings({
      nativeLang: native || 'en',
      nativeLangOther: '',
      targetLangs: target ? [target] : ['en'],
      targetLangOther: '',
      goal,
      dailyGoal,
      inputPref,
      userLevel,
      onboarded: true,
      language: uiLangFromNative(native || 'en'),
    })
    setToast(tr('prefsSaved'))
    nav('/', { replace: true })
  }

  return (
    <div className="onboard bg-background text-foreground">
      <div className="onboard-card wizard-card bg-card border-border">
        {phase === 'langs' ? (
          <>
            <h1 className="page-title" style={{ marginTop: 0 }}>
              {tr('onboardTitle')}
            </h1>
            <p className="muted">{tr('onboardHint')}</p>
            <LanguagePrefs onContinue={() => setPhase('survey')} />
          </>
        ) : (
          <>
            <div className="spread">
              <div className="muted" style={{ fontSize: 13 }}>
                {step + 1} / {SURVEY_STEPS}
              </div>
              <button className="chip" type="button" onClick={() => void finish()}>
                {tr('skip')}
              </button>
            </div>
            <div className="wizard-dots">
              {Array.from({ length: SURVEY_STEPS }, (_, i) => (
                <span key={i} className={`wizard-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} />
              ))}
            </div>
            <div className={`wizard-step ${leaving ? 'out' : 'in'}`}>
              {step === 0 ? (
                <>
                  <h1 className="page-title" style={{ marginTop: 0 }}>
                    {tr('goalQ')}
                  </h1>
                  <p className="muted">{tr('pickOne')}</p>
                  <Chips items={GOAL_OPTS} active={(id) => goal === id} onPick={(id) => setGoal(id as GoalKind)} lang={lang} />
                </>
              ) : null}
              {step === 1 ? (
                <>
                  <h1 className="page-title" style={{ marginTop: 0 }}>
                    {tr('dailyGoalQ')}
                  </h1>
                  <p className="muted">{tr('pickOne')}</p>
                  <Chips
                    items={DAILY_OPTS}
                    active={(id) => dailyGoal === id}
                    onPick={(id) => setDailyGoal(id as DailyGoal)}
                    lang={lang}
                  />
                </>
              ) : null}
              {step === 2 ? (
                <>
                  <h1 className="page-title" style={{ marginTop: 0 }}>
                    {tr('inputPrefQ')}
                  </h1>
                  <p className="muted">{tr('pickOne')}</p>
                  <Chips
                    items={INPUT_PREF_OPTS}
                    active={(id) => inputPref === id}
                    onPick={(id) => setInputPref(id as InputPref)}
                    lang={lang}
                  />
                </>
              ) : null}
              {step === 3 ? (
                <>
                  <h1 className="page-title" style={{ marginTop: 0 }}>
                    {tr('levelQ')}
                  </h1>
                  <p className="muted">{tr('pickOne')}</p>
                  <Chips
                    items={LEVEL_OPTS}
                    active={(id) => userLevel === id}
                    onPick={(id) => setUserLevel(id as UserLevel)}
                    lang={lang}
                  />
                </>
              ) : null}
            </div>
            <div className="wizard-actions">
              {step > 0 ? (
                <button className="btn ghost" type="button" onClick={() => go(step - 1)}>
                  {tr('back')}
                </button>
              ) : (
                <button className="btn ghost" type="button" onClick={() => setPhase('langs')}>
                  {tr('back')}
                </button>
              )}
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (step < SURVEY_STEPS - 1) go(step + 1)
                  else void finish()
                }}
              >
                {step < SURVEY_STEPS - 1 ? tr('next') : tr('startApp')}
              </button>
            </div>
          </>
        )}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}
