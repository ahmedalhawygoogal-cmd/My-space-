import {
  AI_MESSAGES_CONVERSATION_INDEX,
  AI_STORES,
  deleteById,
  deleteByIndex,
  getAll,
  getAllByIndex,
  putOne,
} from '../db'
import type { AiConversation, AiMessage } from '../types'
import { uid } from '../utils'

/**
 * AI chat history is local-first: everything here reads and writes IndexedDB
 * and never touches Supabase, so saving a chat adds no database or network
 * load. Each message is its own record and pages are read per conversation.
 */
export const AI_MESSAGE_PAGE_SIZE = 60

/** Turns of the open conversation that are sent back to the AI as context. */
export const AI_CONTEXT_MESSAGE_LIMIT = 8
export const AI_CONTEXT_CHARS = 6000
const AI_CONTEXT_MESSAGE_CHARS = 800

const AI_TITLE_MAX = 60
const AI_TITLE_MAX_INPUT = 120

export type AiStorageIssue = 'quota' | 'unavailable'

export class AiStorageError extends Error {
  readonly issue: AiStorageIssue

  constructor(issue: AiStorageIssue, message: string, readonly detail?: unknown) {
    super(message)
    this.name = 'AiStorageError'
    this.issue = issue
  }
}

export function describeAiStorageIssue(error: unknown): AiStorageIssue {
  return error instanceof AiStorageError ? error.issue : 'unavailable'
}

function toStorageError(error: unknown): AiStorageError {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : ''
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new AiStorageError('quota', 'Device storage is full', error)
  }
  return new AiStorageError('unavailable', 'Local storage is unavailable', error)
}

/** Cheap probe so the page can warn once instead of failing on every save. */
export async function isAiHistoryAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  try {
    await getAll<AiConversation>(AI_STORES.aiConversations)
    return true
  } catch {
    return false
  }
}

/** Chats of one account on this device, newest first. Metadata only. */
export async function listConversations(userId: string): Promise<AiConversation[]> {
  try {
    const rows = await getAll<AiConversation>(AI_STORES.aiConversations)
    return rows
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (error) {
    throw toStorageError(error)
  }
}

export async function createConversation(userId: string, title: string): Promise<AiConversation> {
  const createdAt = Date.now()
  const conversation: AiConversation = {
    id: uid(),
    userId,
    title: (title.trim() || '—').slice(0, AI_TITLE_MAX_INPUT),
    createdAt,
    updatedAt: createdAt,
    messageCount: 0,
  }
  try {
    await putOne(AI_STORES.aiConversations, conversation)
  } catch (error) {
    throw toStorageError(error)
  }
  return conversation
}

/**
 * Loads one conversation's messages in order. `limit` keeps only the newest
 * page and `beforeSeq` pages backwards, so a long chat is never read whole.
 */
export async function loadMessages(
  conversationId: string,
  options: { limit?: number; beforeSeq?: number } = {},
): Promise<AiMessage[]> {
  try {
    const rows = await getAllByIndex<AiMessage>(
      AI_STORES.aiMessages,
      AI_MESSAGES_CONVERSATION_INDEX,
      conversationId,
    )
    const ordered = rows
      .filter((row) => typeof row.seq === 'number')
      .filter((row) => options.beforeSeq === undefined || row.seq < options.beforeSeq)
      .sort((a, b) => a.seq - b.seq || a.createdAt - b.createdAt)
    if (options.limit === undefined || ordered.length <= options.limit) return ordered
    return ordered.slice(ordered.length - Math.max(0, options.limit))
  } catch (error) {
    throw toStorageError(error)
  }
}

/**
 * Saves one message and bumps the conversation metadata in the same call, so a
 * new message never rewrites the whole transcript.
 */
export async function appendMessage(
  conversation: AiConversation,
  input: { role: AiMessage['role']; content: string; sourceLabel?: string },
): Promise<{ message: AiMessage; conversation: AiConversation }> {
  const createdAt = Date.now()
  const message: AiMessage = {
    id: uid(),
    conversationId: conversation.id,
    userId: conversation.userId,
    role: input.role,
    content: input.content,
    sourceLabel: input.sourceLabel,
    createdAt,
    seq: conversation.messageCount,
  }
  const next: AiConversation = {
    ...conversation,
    updatedAt: createdAt,
    messageCount: conversation.messageCount + 1,
  }
  try {
    await putOne(AI_STORES.aiMessages, message)
    await putOne(AI_STORES.aiConversations, next)
  } catch (error) {
    throw toStorageError(error)
  }
  return { message, conversation: next }
}

export async function renameConversation(conversation: AiConversation, title: string): Promise<AiConversation> {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, AI_TITLE_MAX_INPUT)
  if (!clean || clean === conversation.title) return conversation
  const next: AiConversation = { ...conversation, title: clean, updatedAt: Date.now() }
  try {
    await putOne(AI_STORES.aiConversations, next)
  } catch (error) {
    throw toStorageError(error)
  }
  return next
}

/** Removes one chat and its messages only; every other chat is untouched. */
export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    await deleteByIndex(AI_STORES.aiMessages, AI_MESSAGES_CONVERSATION_INDEX, conversationId)
    await deleteById(AI_STORES.aiConversations, conversationId)
  } catch (error) {
    throw toStorageError(error)
  }
}

/** Removes the signed-in account's chats on this device. */
export async function clearConversations(userId: string): Promise<void> {
  const list = await listConversations(userId)
  for (const conversation of list) {
    await deleteConversation(conversation.id)
  }
}

const TITLE_PREFIXES: RegExp[] = [
  /^(?:please|pls|hey|hi|hello)[\s,:-]+/i,
  /^(?:can|could|would|will)\s+you\s+(?:please\s+)?/i,
  /^(?:explain(?:\s+to\s+me)?|tell\s+me\s+about|tell\s+me|help\s+me\s+understand|help\s+me|show\s+me|give\s+me|write(?:\s+me)?|summari[sz]e|translate|define|describe|compare|clarify)(?:\s+(?:this|that|the|a|an))?[\s,:-]+/i,
  /^(?:what(?:'s|\s+is|\s+are)|how\s+(?:do|does|can|to)|why\s+(?:is|are|do)|when\s+(?:is|are|do)|where\s+(?:is|are)|who\s+(?:is|are))[\s,:-]+/i,
  /^(?:اشرح لي|اشرحلي|اشرح|وضّح لي|وضح لي|وضّح|وضح|عرّف لي|عرف لي|عرّفني|عرفني|لخّص لي|لخص لي|لخّص|لخص|اكتب لي|اكتب|أعطني|اعطني|قدّم لي|قدم لي|أخبرني عن|اخبرني عن|أخبرني|اخبرني|حدّثني عن|حدثني عن|قارن لي|قارن|ترجم لي|ترجم|اذكر لي|اذكر)\s+/u,
  /^(?:ما هو|ما هي|ماهو|ماهي|ما معنى|ما معني|هل يمكن|هل)\s+/u,
  /^(?:كيف يمكن|كيف أقدر|كيف اقدر|كيف أ|كيف ا|كيف|لماذا|ليش)\s+/u,
]

/**
 * Builds a chat title from the first user message with plain string work, so
 * naming a chat never costs an extra AI call. Works for Arabic and English.
 */
export function deriveConversationTitle(text: string, fallback: string): string {
  const flat = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return fallback

  let title = flat.split(/(?<=[.!?؟…])\s/u)[0] ?? flat
  for (let pass = 0; pass < 2; pass += 1) {
    const prefix = TITLE_PREFIXES.find((pattern) => pattern.test(title))
    if (!prefix) break
    const stripped = title.replace(prefix, '').trim()
    if (stripped.length < 3) break
    title = stripped
  }

  title = title.replace(/^[\s"'«»“”()[\]-]+/u, '').replace(/[\s"'«»“”.,،؛;:!?؟…-]+$/u, '').trim()
  if (!title) return fallback
  title = title.replace(/^[a-z]/, (char) => char.toUpperCase())
  if (title.length > AI_TITLE_MAX) {
    const cut = title.slice(0, AI_TITLE_MAX)
    const space = cut.lastIndexOf(' ')
    title = `${(space > 20 ? cut.slice(0, space) : cut).trim()}…`
  }
  return title
}

/**
 * The bounded context of the open conversation, sent with the new message so
 * the AI keeps its thread. Only this chat's recent turns are included.
 */
export function buildHistoryContext(
  messages: { role: AiMessage['role']; content: string }[],
  maxMessages = AI_CONTEXT_MESSAGE_LIMIT,
  maxChars = AI_CONTEXT_CHARS,
): string {
  const recent = messages.slice(-Math.max(0, maxMessages))
  const lines: string[] = []
  let total = 0
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index]
    if (!message) continue
    const text = message.content.replace(/\s+/g, ' ').trim().slice(0, AI_CONTEXT_MESSAGE_CHARS)
    if (!text) continue
    const line = `${message.role === 'user' ? 'User' : 'Assistant'}: ${text}`
    if (total + line.length > maxChars) break
    total += line.length
    lines.unshift(line)
  }
  return lines.join('\n')
}
