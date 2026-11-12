import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Flame, Plus } from 'lucide-react'
import { useStore } from '../store'
import { CloseBtn, Confirm, Empty, FormActions, Segment, Sheet, Toast, useT } from '../ui'
import { quoteField, type Habit, type HabitLog, type QuoteCharacter } from '../types'
import { DEFAULT_QUOTES } from '../data/defaultQuotes'
import {
  currentStreak,
  draftFromHabit,
  emptyHabitDraft,
  HABIT_ICONS,
  habitIcon,
  isDayComplete,
  isFutureDay,
  isoDate,
  logKey,
  logsByHabitDate,
  weekDays,
  type HabitDraft,
} from '../lib/habits'
import {
  fetchHabitLogs,
  fetchHabits,
  removeHabit,
  removeHabitLog,
  upsertHabit,
  upsertHabitLog,
} from '../lib/habitSync'
const REWARD_KEY = 'myspace-habit-rewards'

function loadRewarded(): Record<string, number> {
  try {
    const raw = localStorage.getItem(REWARD_KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch {
    /* ignore */
  }
  return {}
}

function saveRewarded(map: Record<string, number>) {
  localStorage.setItem(REWARD_KEY, JSON.stringify(map))
}

function pickQuote(): QuoteCharacter {
  return DEFAULT_QUOTES[Math.floor(Math.random() * DEFAULT_QUOTES.length)] ?? DEFAULT_QUOTES[0]!
}

export default function HabitsPage() {
  const tr = useT()
  const nav = useNavigate()
  const { lang } = useStore()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [reward, setReward] = useState<QuoteCharacter | null>(null)
  const days = useMemo(() => weekDays(), [])
  const todayIso = isoDate()
  const logMap = useMemo(() => logsByHabitDate(logs), [logs])

  const reload = useCallback(async () => {
    const [h, l] = await Promise.all([fetchHabits(), fetchHabitLogs()])
    setHabits(h)
    setLogs(l)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function toggleDay(habit: Habit, ts: number) {
    if (isFutureDay(ts)) return
    const date = isoDate(ts)
    const existing = logMap.get(logKey(habit.id, date))
    const done = isDayComplete(habit, existing)
    if (done && existing) {
      const ok = await removeHabitLog(existing.id)
      if (!ok) {
        setToast(tr('error'))
        return
      }
      setLogs((prev) => prev.filter((x) => x.id !== existing.id))
      return
    }
    const nextCount = habit.isMeasurable ? Math.max(1, habit.targetCount) : 1
    const row: HabitLog = existing
      ? { ...existing, count: nextCount }
      : {
          id: crypto.randomUUID(),
          habitId: habit.id,
          date,
          count: nextCount,
          createdAt: Date.now(),
        }
    const saved = await upsertHabitLog(row)
    if (!saved) {
      setToast(tr('error'))
      return
    }
    const nextLogs = existing
      ? logs.map((x) => (x.id === saved.id ? saved : x))
      : [...logs, saved]
    setLogs(nextLogs)
    const streak = currentStreak(habit, nextLogs)
    if (streak >= 7 && date === todayIso) {
      const shown = loadRewarded()
      if ((shown[habit.id] ?? 0) < 7) {
        shown[habit.id] = 7
        saveRewarded(shown)
        setReward(pickQuote())
      }
    }
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('habits')}</h1>
      {habits.length === 0 ? (
        <Empty icon={<Activity size={36} />} title={tr('noHabits')} hint={tr('noHabitsHint')} />
      ) : (
        <div className="habit-week">
          <div className="habit-week-head">
            <div className="habit-week-name" />
            {days.map((ts) => (
              <div key={ts} className={`habit-dow${isoDate(ts) === todayIso ? ' is-today' : ''}`}>
                {new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(ts))}
                <span>{new Date(ts).getDate()}</span>
              </div>
            ))}
          </div>
          {habits.map((h) => {
            const Icon = habitIcon(h.icon)
            const streak = currentStreak(h, logs)
            return (
              <div key={h.id} className="habit-row">
                <button className="habit-week-name pressable" type="button" onClick={() => nav(`/habits/${h.id}`)}>
                  <span className="habit-ico">
                    <Icon size={16} />
                  </span>
                  <span className="ellipsis" style={{ fontWeight: 700 }}>
                    {h.name}
                  </span>
                  {streak > 0 ? (
                    <span className="habit-streak">
                      <Flame size={12} />
                      {streak}
                    </span>
                  ) : null}
                </button>
                {days.map((ts) => {
                  const future = isFutureDay(ts)
                  const log = logMap.get(logKey(h.id, isoDate(ts)))
                  const on = isDayComplete(h, log)
                  return (
                    <button
                      key={ts}
                      type="button"
                      className={`habit-dot${on ? ' on' : ''}${future ? ' is-future' : ''}`}
                      disabled={future}
                      aria-label={h.name}
                      onClick={() => void toggleDay(h, ts)}
                    >
                      {on ? '✓' : ''}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      <button className="fab" type="button" onClick={() => setOpen(true)} aria-label={tr('newHabit')}>
        <Plus size={22} />
      </button>
      <HabitForm
        open={open}
        onClose={() => setOpen(false)}
        onSaved={async () => {
          setOpen(false)
          await reload()
        }}
      />
      {reward ? <RewardModal character={reward} lang={lang} onClose={() => setReward(null)} /> : null}
      {toast ? <Toast text={toast} onDone={() => setToast(null)} /> : null}
    </div>
  )
}

export function HabitForm({
  open,
  onClose,
  habit,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  habit?: Habit
  onSaved: () => void | Promise<void>
  onDeleted?: () => void | Promise<void>
}) {
  const tr = useT()
  const [draft, setDraft] = useState<HabitDraft>(emptyHabitDraft)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setConfirm(false)
    setDraft(habit ? draftFromHabit(habit) : emptyHabitDraft())
  }, [open, habit])

  return (
    <Sheet open={open} onClose={onClose} title={habit ? tr('edit') : tr('newHabit')}>
      <label className="label">{tr('habitName')}</label>
      <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <label className="label">{tr('isMeasurable')}</label>
      <Segment
        value={draft.isMeasurable ? 'yes' : 'no'}
        onChange={(v) => setDraft({ ...draft, isMeasurable: v === 'yes' })}
        options={[
          { id: 'yes', label: tr('yes') },
          { id: 'no', label: tr('no') },
        ]}
      />
      {draft.isMeasurable ? (
        <>
          <label className="label">{tr('targetCount')}</label>
          <input
            className="field"
            type="number"
            min={1}
            value={draft.targetCount}
            onChange={(e) => setDraft({ ...draft, targetCount: Math.max(1, Number(e.target.value) || 1) })}
          />
        </>
      ) : null}
      <label className="label">{tr('frequency')}</label>
      <Segment
        value={draft.frequency}
        onChange={(v) => setDraft({ ...draft, frequency: v as Habit['frequency'] })}
        options={[
          { id: 'daily', label: tr('recDaily') },
          { id: 'weekly', label: tr('recWeekly') },
          { id: 'monthly', label: tr('recMonthly') },
          { id: 'yearly', label: tr('recYearly') },
        ]}
      />
      <label className="label">{tr('reminderTime')}</label>
      <input className="field" type="time" value={draft.reminder} onChange={(e) => setDraft({ ...draft, reminder: e.target.value })} />
      <label className="label">{tr('habitWhy')}</label>
      <input className="field" value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} />
      <label className="label">{tr('habitIcon')}</label>
      <div className="habit-icon-grid">
        {HABIT_ICONS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            className={`habit-icon-pick${draft.icon === id ? ' on' : ''}`}
            onClick={() => setDraft({ ...draft, icon: id })}
            aria-label={id}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <FormActions
        saveLabel={tr('save')}
        deleteLabel={habit ? tr('delete') : undefined}
        saveDisabled={!draft.name.trim() || busy}
        onSave={async () => {
          if (!draft.name.trim() || busy) return
          setBusy(true)
          const t = Date.now()
          const payload: Habit = {
            id: habit?.id ?? crypto.randomUUID(),
            name: draft.name.trim(),
            isMeasurable: draft.isMeasurable,
            targetCount: draft.isMeasurable ? Math.max(1, draft.targetCount) : 1,
            frequency: draft.frequency,
            reminder: draft.reminder,
            why: draft.why.trim(),
            icon: draft.icon,
            createdAt: habit?.createdAt ?? t,
            updatedAt: t,
          }
          const saved = await upsertHabit(payload)
          setBusy(false)
          if (!saved) return
          await onSaved()
        }}
        onDelete={habit ? () => setConfirm(true) : undefined}
      />
      <Confirm
        open={confirm}
        title={tr('deleteHabitConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          if (!habit) return
          await removeHabit(habit.id)
          setConfirm(false)
          if (onDeleted) await onDeleted()
          else await onSaved()
        }}
      />
    </Sheet>
  )
}

export function RewardModal({
  character,
  lang,
  onClose,
}: {
  character: QuoteCharacter
  lang: string
  onClose: () => void
}) {
  const tr = useT()
  const name = quoteField(character.name, lang)
  const quote = quoteField(character.quote, lang)
  return (
    <div className="sheet-backdrop habit-reward-backdrop" onClick={onClose}>
      <div className="habit-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className={`habit-confetti-piece p${i % 6}`} />
        ))}
      </div>
      <div className="dialog habit-reward" onClick={(e) => e.stopPropagation()}>
        <CloseBtn variant="modal" onClick={onClose} />
        <div className="habit-sparkles" aria-hidden="true" />
        <h3 style={{ marginTop: 8, textAlign: 'center' }}>{tr('habitRewardTitle')}</h3>
        {character.imageUrl ? (
          <img className="habit-reward-img" src={character.imageUrl} alt="" />
        ) : null}
        <b style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>{name}</b>
        <p className="muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>
          “{quote}”
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
          {tr('habitRewardBody')}
        </p>
      </div>
    </div>
  )
}
