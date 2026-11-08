import type { AppSettings, DailyGoal, GoalKind } from '../types'
import * as db from '../db'
import { supabase } from './supabase'
import { isUiLang, uiLangFromNative } from '../types'

export type ProfileRow = {
  native_language: string | null
  target_language: string | null
  goal: string | null
  field_of_study: string | null
  daily_goal: string | null
  onboarding_completed: boolean | null
}

function asGoal(raw: string | null | undefined): GoalKind | undefined {
  return raw === 'study' || raw === 'productivity' || raw === 'record' || raw === 'all' ? raw : undefined
}

function asDaily(raw: string | null | undefined): DailyGoal | undefined {
  return raw === '10' || raw === '30' || raw === '60' ? raw : undefined
}

function fieldOfStudy(s: AppSettings): string {
  const parts = [...(s.fields ?? []), s.fieldOther].map((x) => x.trim()).filter(Boolean)
  return parts.join(', ')
}

function parseFields(raw: string | null | undefined): { fields: string[]; fieldOther: string } {
  const text = (raw ?? '').trim()
  if (!text) return { fields: [], fieldOther: '' }
  const parts = text.split(',').map((x) => x.trim()).filter(Boolean)
  return { fields: parts, fieldOther: text }
}

export function profileToSettings(row: ProfileRow, prev: AppSettings): AppSettings {
  const native = row.native_language?.trim() || prev.nativeLang
  const target = row.target_language?.trim()
  const goal = asGoal(row.goal) ?? prev.goal
  const dailyGoal = asDaily(row.daily_goal) ?? prev.dailyGoal
  const field = parseFields(row.field_of_study)
  const language = native && isUiLang(native) ? native : uiLangFromNative(native || prev.language)
  return {
    ...prev,
    nativeLang: native && native !== 'other' ? native : prev.nativeLang,
    targetLangs: target && target !== 'other' ? [target] : prev.targetLangs,
    goal,
    dailyGoal,
    fields: field.fields.length ? field.fields : prev.fields,
    fieldOther: field.fieldOther || prev.fieldOther,
    onboarded: !!row.onboarding_completed || prev.onboarded,
    language,
  }
}

const PROFILE_COLS = 'native_language, target_language, goal, field_of_study, daily_goal, onboarding_completed'

async function sessionUserId(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

export async function fetchProfile(): Promise<ProfileRow | null> {
  if (!supabase) return null
  const uid = await sessionUserId()
  if (!uid) return null
  try {
    const byId = await supabase.from('profiles').select(PROFILE_COLS).eq('id', uid).maybeSingle()
    if (!byId.error && byId.data) return byId.data as ProfileRow
    const byUser = await supabase.from('profiles').select(PROFILE_COLS).eq('user_id', uid).maybeSingle()
    if (!byUser.error && byUser.data) return byUser.data as ProfileRow
    return null
  } catch {
    return null
  }
}

export async function saveProfile(settings: AppSettings): Promise<void> {
  if (!supabase) return
  const uid = await sessionUserId()
  if (!uid) return
  const native = settings.nativeLang && settings.nativeLang !== 'other' ? settings.nativeLang : null
  const target = settings.targetLangs?.find((c) => c && c !== 'other') || null
  const payload = {
    native_language: native,
    target_language: target,
    goal: settings.goal ?? null,
    field_of_study: fieldOfStudy(settings) || null,
    daily_goal: settings.dailyGoal ?? null,
    onboarding_completed: !!settings.onboarded,
  }
  try {
    const upserted = await supabase.from('profiles').upsert({ id: uid, ...payload }, { onConflict: 'id' })
    if (!upserted.error) return
    const updated = await supabase.from('profiles').update(payload).eq('id', uid)
    if (!updated.error && (updated.count ?? 1) > 0) return
    await supabase.from('profiles').update(payload).eq('user_id', uid)
  } catch {
    return
  }
}

export async function syncProfileFromCloud(local: AppSettings): Promise<AppSettings> {
  const row = await fetchProfile()
  if (!row) return local
  if (row.onboarding_completed) {
    const next = profileToSettings(row, local)
    await db.saveSettings(next)
    return next
  }
  if (local.onboarded) {
    await saveProfile(local)
  }
  return local
}
