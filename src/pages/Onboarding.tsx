import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Toast, useT } from '../ui'
import type { AppSettings, DailyGoal, GoalKind, Lang } from '../types'
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

const STEPS = 4

function uiLangFromNative(code: string): Lang {
  return code === 'ar' ? 'ar' : 'en'
}

function fromSettings(s: AppSettings): Draft {
  return {
    nativeLang: s.onboarded ? s.nativeLang || 'en' : '',
    nativeLangOther: s.nativeLangOther ?? '',
    targetLangs: s.onboarded && s.targetLangs?.length ? s.targetLangs : [],
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

function Chips({
  items,
  active,
  onPick,
  lang,
}: {
  items: { id: string; ar: string; en: string }[]
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
          className={`choice-chip ${active(o.id) ? 'active' : ''}`}
          onClick={() => onPick(o.id)}
        >
          {lang === 'ar' ? o.ar : o.en}
        </button>
      ))}
    </div>
  )
}

export function PrefsForm({ onSaved, saveLabel }: { onSaved?: () => void; saveLabel?: string }) {
  const tr = useT()
  const { settings, setSettings, lang } = useStore()
  const [draft, setDraft] = useState<Draft>(() => fromSettings(settings))
  const [toast, setToast] = useState<string | null>(null)

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
      <Chips
        items={NATIVE_LANG_OPTS.map((o) => ({ id: o.code, ar: o.ar, en: o.en }))}
        active={(id) => draft.nativeLang === id}
        onPick={(id) => {
          setDraft({ ...draft, nativeLang: id })
          void setSettings({ language: uiLangFromNative(id), nativeLang: id })
        }}
        lang={lang}
      />
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
      <Chips
        items={TARGET_LANG_OPTS.map((o) => ({ id: o.code, ar: o.ar, en: o.en }))}
        active={(id) => draft.targetLangs.includes(id)}
        onPick={(id) => setDraft({ ...draft, targetLangs: toggle(draft.targetLangs, id) })}
        lang={lang}
      />
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
      <Chips
        items={GOAL_OPTS.map((o) => ({ id: o.id, ar: o.ar, en: o.en }))}
        active={(id) => draft.goal === id}
        onPick={(id) => setDraft({ ...draft, goal: id as GoalKind })}
        lang={lang}
      />
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
      <Chips
        items={FIELD_OPTS}
        active={(id) => draft.fields.includes(id)}
        onPick={(id) => setDraft({ ...draft, fields: toggle(draft.fields, id) })}
        lang={lang}
      />
      {draft.fields.includes('other') ? (
        <input
          className="field"
          value={draft.fieldOther}
          placeholder={tr('otherSpecify')}
          onChange={(e) => setDraft({ ...draft, fieldOther: e.target.value })}
        />
      ) : null}

      <label className="label">{tr('dailyGoalQ')}</label>
      <Chips
        items={DAILY_OPTS.map((o) => ({ id: o.id, ar: o.ar, en: o.en }))}
        active={(id) => draft.dailyGoal === id}
        onPick={(id) => setDraft({ ...draft, dailyGoal: id as DailyGoal })}
        lang={lang}
      />

      <button
        className="btn block"
        type="button"
        disabled={!valid}
        onClick={async () => {
          await setSettings({
            ...draft,
            onboarded: true,
            language: uiLangFromNative(draft.nativeLang),
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
  const { settings, setSettings, lang } = useStore()
  const [step, setStep] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => fromSettings(settings))

  const canNext = useMemo(() => {
    if (step === 0) {
      if (!draft.nativeLang) return false
      if (draft.nativeLang === 'other' && !draft.nativeLangOther.trim()) return false
      if (!draft.targetLangs.length) return false
      if (draft.targetLangs.includes('other') && !draft.targetLangOther.trim()) return false
      return true
    }
    if (step === 1) return draft.goal !== 'other' || !!draft.goalOther.trim()
    if (step === 2) return !draft.fields.includes('other') || !!draft.fieldOther.trim()
    return true
  }, [draft, step])

  function go(next: number) {
    setLeaving(true)
    window.setTimeout(() => {
      setStep(next)
      setLeaving(false)
    }, 180)
  }

  async function finish(skipRest = false) {
    await setSettings({
      nativeLang: draft.nativeLang || 'en',
      nativeLangOther: draft.nativeLangOther,
      targetLangs: draft.targetLangs.length ? draft.targetLangs : ['en'],
      targetLangOther: draft.targetLangOther,
      goal: skipRest && step < 1 ? 'study' : draft.goal,
      goalOther: draft.goalOther,
      fields: draft.fields,
      fieldOther: draft.fieldOther,
      dailyGoal: skipRest && step < 3 ? '15' : draft.dailyGoal,
      onboarded: true,
      language: uiLangFromNative(draft.nativeLang || 'en'),
    })
    nav('/', { replace: true })
  }

  return (
    <div className="onboard">
      <div className="onboard-card wizard-card">
        <div className="spread">
          <div className="muted" style={{ fontSize: 13 }}>
            {step + 1} / {STEPS}
          </div>
          <button className="chip" type="button" onClick={() => void finish(true)}>
            {tr('skip')}
          </button>
        </div>
        <div className="wizard-dots">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`wizard-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        <div className={`wizard-step ${leaving ? 'out' : 'in'}`}>
          {step === 0 ? (
            <>
              <h1 className="page-title" style={{ marginTop: 0 }}>
                {tr('nativeLangQ')}
              </h1>
              <p className="muted">{tr('pickOne')}</p>
              <Chips
                items={NATIVE_LANG_OPTS.map((o) => ({ id: o.code, ar: o.ar, en: o.en }))}
                active={(id) => draft.nativeLang === id}
                onPick={(id) => {
                  setDraft({ ...draft, nativeLang: id })
                  void setSettings({ language: uiLangFromNative(id), nativeLang: id })
                }}
                lang={lang}
              />
              {draft.nativeLang === 'other' ? (
                <input
                  className="field"
                  value={draft.nativeLangOther}
                  placeholder={tr('otherSpecify')}
                  onChange={(e) => setDraft({ ...draft, nativeLangOther: e.target.value })}
                />
              ) : null}
              <label className="label" style={{ marginTop: 10 }}>
                {tr('targetLangsQ')}
              </label>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {tr('pickSome')}
              </p>
              <Chips
                items={TARGET_LANG_OPTS.map((o) => ({ id: o.code, ar: o.ar, en: o.en }))}
                active={(id) => draft.targetLangs.includes(id)}
                onPick={(id) => setDraft({ ...draft, targetLangs: toggle(draft.targetLangs, id) })}
                lang={lang}
              />
              {draft.targetLangs.includes('other') ? (
                <input
                  className="field"
                  value={draft.targetLangOther}
                  placeholder={tr('otherSpecify')}
                  onChange={(e) => setDraft({ ...draft, targetLangOther: e.target.value })}
                />
              ) : null}
            </>
          ) : null}
          {step === 1 ? (
            <>
              <h1 className="page-title" style={{ marginTop: 0 }}>
                {tr('goalQ')}
              </h1>
              <p className="muted">{tr('pickOne')}</p>
              <Chips
                items={GOAL_OPTS.map((o) => ({ id: o.id, ar: o.ar, en: o.en }))}
                active={(id) => draft.goal === id}
                onPick={(id) => setDraft({ ...draft, goal: id as GoalKind })}
                lang={lang}
              />
              {draft.goal === 'other' ? (
                <input
                  className="field"
                  value={draft.goalOther}
                  placeholder={tr('otherSpecify')}
                  onChange={(e) => setDraft({ ...draft, goalOther: e.target.value })}
                />
              ) : null}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <h1 className="page-title" style={{ marginTop: 0 }}>
                {tr('fieldsQ')}
              </h1>
              <p className="muted">{tr('pickSome')}</p>
              <Chips
                items={FIELD_OPTS}
                active={(id) => draft.fields.includes(id)}
                onPick={(id) => setDraft({ ...draft, fields: toggle(draft.fields, id) })}
                lang={lang}
              />
              {draft.fields.includes('other') ? (
                <input
                  className="field"
                  value={draft.fieldOther}
                  placeholder={tr('otherSpecify')}
                  onChange={(e) => setDraft({ ...draft, fieldOther: e.target.value })}
                />
              ) : null}
            </>
          ) : null}
          {step === 3 ? (
            <>
              <h1 className="page-title" style={{ marginTop: 0 }}>
                {tr('dailyGoalQ')}
              </h1>
              <p className="muted">{tr('pickOne')}</p>
              <Chips
                items={DAILY_OPTS.map((o) => ({ id: o.id, ar: o.ar, en: o.en }))}
                active={(id) => draft.dailyGoal === id}
                onPick={(id) => setDraft({ ...draft, dailyGoal: id as DailyGoal })}
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
            <span />
          )}
          <button
            className="btn"
            type="button"
            disabled={!canNext}
            onClick={() => {
              if (step < STEPS - 1) go(step + 1)
              else void finish(false)
            }}
          >
            {step < STEPS - 1 ? tr('next') : tr('startApp')}
          </button>
        </div>
      </div>
    </div>
  )
}
