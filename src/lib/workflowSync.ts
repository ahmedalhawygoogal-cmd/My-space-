import type { Workflow, WorkflowRun } from '../types'
import * as db from '../db'
import { SPACE_STORES } from '../db'
import { isCloudSyncEnabled } from './cloudPref'
import { supabase } from './supabase'
import { isUuid } from './taskSync'

type RemoteWorkflow = {
  id: string
  user_id: string
  space_id?: string | null
  name?: string | null
  description?: string | null
  trigger?: unknown
  steps?: unknown
  enabled?: boolean | null
  run_count?: number | null
  last_run_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type RemoteWorkflowRun = {
  id: string
  workflow_id: string
  user_id: string
  status: string
  trigger_payload?: unknown
  step_results?: unknown
  error?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at?: string | null
}

function remoteToLocal(row: RemoteWorkflow, prev?: Workflow): Workflow {
  const iso = new Date().toISOString()
  return {
    id: row.id,
    user_id: row.user_id,
    space_id: row.space_id ?? prev?.space_id ?? null,
    name: row.name ?? prev?.name ?? 'Workflow',
    description: row.description ?? prev?.description ?? null,
    trigger: (row.trigger as Workflow['trigger']) ?? prev?.trigger ?? { kind: 'manual' },
    steps: Array.isArray(row.steps) ? (row.steps as Workflow['steps']) : prev?.steps ?? [],
    enabled: row.enabled ?? prev?.enabled ?? true,
    run_count: row.run_count ?? prev?.run_count ?? 0,
    last_run_at: row.last_run_at ?? prev?.last_run_at ?? null,
    created_at: row.created_at ?? prev?.created_at ?? iso,
    updated_at: row.updated_at ?? prev?.updated_at ?? iso,
  }
}

function localToRemote(wf: Workflow, userId: string): RemoteWorkflow {
  return {
    id: wf.id,
    user_id: userId,
    space_id: wf.space_id ?? null,
    name: wf.name,
    description: wf.description ?? null,
    trigger: wf.trigger,
    steps: wf.steps,
    enabled: wf.enabled,
    run_count: wf.run_count,
    last_run_at: wf.last_run_at ?? null,
    created_at: wf.created_at,
    updated_at: wf.updated_at,
  }
}

async function currentUserId(): Promise<string | null> {
  if (!supabase || !isCloudSyncEnabled()) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

export async function upsertRemoteWorkflow(wf: Workflow): Promise<void> {
  if (!isUuid(wf.id)) return
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    await supabase.from('workflows').upsert(localToRemote(wf, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteWorkflow(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    await supabase.from('workflows').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

/** Append-only execution log; a failed upload must never fail the run. */
export async function pushRemoteWorkflowRun(run: WorkflowRun): Promise<void> {
  if (!isUuid(run.id) || !isUuid(run.workflow_id)) return
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    const row: RemoteWorkflowRun = {
      id: run.id,
      workflow_id: run.workflow_id,
      user_id: uid,
      status: run.status,
      trigger_payload: run.trigger_payload,
      step_results: run.step_results,
      error: run.error,
      started_at: run.started_at,
      finished_at: run.finished_at,
      created_at: run.created_at,
    }
    await supabase.from('workflow_runs').upsert(row, { onConflict: 'id' })
  } catch {
    return
  }
}

/** Pulls cloud workflows into IndexedDB, keeping local-only ones and pushing them up. */
export async function syncWorkflowsFromCloud(): Promise<boolean> {
  const uid = await currentUserId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase.from('workflows').select('*').eq('user_id', uid)
    if (error || !data) return false
    const local = await db.getAll<Workflow>(SPACE_STORES.workflows)
    const localById = new Map(local.map((x) => [x.id, x]))
    const seen = new Set<string>()
    const merged: Workflow[] = []
    for (const row of data as RemoteWorkflow[]) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      merged.push(remoteToLocal(row, localById.get(row.id)))
    }
    const localOnly = local.filter((x) => !seen.has(x.id))
    merged.push(...localOnly)
    if (merged.length) await db.putMany(SPACE_STORES.workflows, merged)
    for (const wf of localOnly) await upsertRemoteWorkflow(wf)
    return true
  } catch {
    return false
  }
}
