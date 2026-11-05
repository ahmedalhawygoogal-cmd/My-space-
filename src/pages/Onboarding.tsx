import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Toast, useT } from '../ui'
import type { AppSettings, DailyGoal, GoalKind } from '../types'
import { DAILY_OPTS, FIELD_OPTS, GOAL_OPTS, NATIVE_LANG_OPTS, TARGET_LANG_OPTS } from '../types'

type Draft = Pick<
  AppSettings,
  | 'nativeLang'
  | 'nativeLangOther'
  | 'targetLangs'
  | 'targetLangOther'
  | 'goal'
  | 'goalOther'
  | 'fields'
  | 'fieldOther'
  | 'dailyGoal'
>

function fromSettings(s: AppSettings): Draft {
  return {
    nativeLang: s.nativeLang || 'ar',
    nativeLangOther: s.nativeLangOther ?? '',
    targetLangs: s.targetLangs?.length ? s.targetLangs : ['en'],
    targetLangOther: s.targetLangOther ?? '',
    goal: s.goal || 'study',
    goalOther: s.goalOther ?? '',
    fields: s.fields ?? [],
    fieldOther: s.fieldOther ?? '',
    dailyGoal: s.dailyGoal || '15',
  }
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function PrefsForm({ onSaved, saveLabel }: { onSaved?: () => void; saveLabel?: string }) {
  const tr = useT()
  const { settings, setSettings, lang } = useStore()
  const [draft, setDraft] = useState<Draft>(() => fromSettings(settings))
  const [toast, setToast] = useState<string | null>(null)
  const label = (ar: string, en: string) => (lang === 'ar' ? ar : en)

  const valid = useMemo(() => {
    if (!draft.nativeLang) return false
    if (draft.nativeLang === 'other' && !draft.nativeLangOther.trim()) return false
    if (!draft.targetLangs.length) return false
    if (draft.targetLangs.includes('other') && !draft.targetLangOther.trim()) return false
    if (draft.goal === 'other' && !draft.goalOther.trim()) return false
    if (draft.fields.includes('other') && !draft.fieldOther.trim()) return false
    return true
  }, [draft])

  return (
    <div className="stack">
      <label className="label">{tr('nativeLangQ')}</label>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {tr('pickOne')}
      </p>
      <div className="chip-row wrap">
        {NATIVE_LANG_OPTS.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`chip ${draft.nativeLang === o.code ? 'active' : ''}`}
            onClick={() => setDraft({ ...draft, nativeLang: o.code })}
          >
            {label(o.ar, o.en)}
          </button>
        ))}
      </div>
      {draft.nativeLang === 'other' ? (
        <input
          className="field"
          value={draft.nativeLangOther}
          placeholder={tr('otherSpecify')}
          onChange={(e) => setDraft({ ...draft, nativeLangOther: e.target.value })}
        />
      ) : null}

      <label className="label">{tr('targetLangsQ')}</label>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {tr('pickSome')}
      </p>
      <div className="chip-row wrap">
        {TARGET_LANG_OPTS.map((o) => (
          <button
            key={o.code}
            type="button"
            className={`chip ${draft.targetLangs.includes(o.code) ? 'active' : ''}`}
            onClick={() => setDraft({ ...draft, targetLangs: toggle(draft.targetLangs, o.code) })}
          >
            {label(o.ar, o.en)}
          </button>
        ))}
      </div>
      {draft.targetLangs.includes('other') ? (
        <input
          className="field"
          value={draft.targetLangOther}
          placeholder={tr('otherSpecify')}
          onChange={(e) => setDraft({ ...draft, targetLangOther: e.target.value })}
        />
      ) : null}

      <label className="label">{tr('goalQ')}</label>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {tr('pickOne')}
      </p>
      <div className="chip-row wrap">
        {GOAL_OPTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`chip ${draft.goal === o.id ? 'active' : ''}`}
            onClick={() => setDraft({ ...draft, goal: o.id as GoalKind })}
          >
            {label(o.ar, o.en)}
          </button>
        ))}
      </div>
      {draft.goal === 'other' ? (
        <input
          className="field"
          value={draft.goalOther}
          placeholder={tr('otherSpecify')}
          onChange={(e) => setDraft({ ...draft, goalOther: e.target.value })}
        />
      ) : null}

      <label className="label">{tr('fieldsQ')}</label>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {tr('pickSome')}
      </p>
      <div className="chip-row wrap">
        {FIELD_OPTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`chip ${draft.fields.includes(o.id) ? 'active' : ''}`}
            onClick={() => setDraft({ ...draft, fields: toggle(draft.fields, o.id) })}
          >
            {label(o.ar, o.en)}
          </button>
        ))}
      </div>
      {draft.fields.includes('other') ? (
        <input
          className="field"
          value={draft.fieldOther}
          placeholder={tr('otherSpecify')}
          onChange={(e) => setDraft({ ...draft, fieldOther: e.target.value })}
        />
      ) : null}

      <label className="label">{tr('dailyGoalQ')}</label>
      <div className="chip-row wrap">
        {DAILY_OPTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`chip ${draft.dailyGoal === o.id ? 'active' : ''}`}
            onClick={() => setDraft({ ...draft, dailyGoal: o.id as DailyGoal })}
          >
            {label(o.ar, o.en)}
          </button>
        ))}
      </div>

      <button
        className="btn block"
        type="button"
        disabled={!valid}
        onClick={async () => {
          await setSettings({
            ...draft,
            onboarded: true,
            language: draft.nativeLang === 'en' ? 'en' : 'ar',
          })
          setToast(tr('prefsSaved'))
          onSaved?.()
        }}
      >
        {saveLabel ?? tr('save')}
      </button>
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}

export default function OnboardingPage() {
  const tr = useT()
  const nav = useNavigate()
  return (
    <div className="onboard">
      <div className="onboard-card">
        <h1 className="page-title" style={{ marginTop: 0 }}>
          {tr('onboardTitle')}
        </h1>
        <p className="muted">{tr('onboardHint')}</p>
        <PrefsForm saveLabel={tr('startApp')} onSaved={() => nav('/', { replace: true })} />
      </div>
    </div>
  )
}
