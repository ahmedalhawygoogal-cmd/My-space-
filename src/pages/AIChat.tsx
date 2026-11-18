import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  Check,
  CheckSquare,
  Code,
  FileText,
  History,
  LoaderCircle,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { t } from '../i18n'
import type { AiConversation, Lang } from '../types'
import { Confirm, Sheet, CloseBtn, useT } from '../ui'
import { formatDateTime } from '../utils'
import {
  AI_MESSAGE_PAGE_SIZE,
  appendMessage,
  buildHistoryContext,
  clearConversations,
  createConversation,
  deleteConversation,
  deriveConversationTitle,
  describeAiStorageIssue,
  isAiHistoryAvailable,
  listConversations,
  loadMessages,
  renameConversation,
  type AiStorageIssue,
} from '../lib/aiHistory'
import './AIChat.css'

type SourceKind = 'notes' | 'tasks' | 'recordings'
type ChatSource = {
  id: string
  kind: SourceKind
  title: string
  preview: string
  context: string
}
type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sourceLabel?: string
  isError?: boolean
  seq?: number
}
type SourcesByKind = Record<SourceKind, ChatSource[]>

type NoteRow = { id: string; title: string | null; content: string | null; created_at: string | null }
type TaskRow = {
  id: string
  title: string | null
  description: string | null
  completed: boolean | null
  priority: string | null
  date: string | null
  created_at: string | null
}
type RecordingRow = { id: string; name: string | null; duration: number | null; created_at: string | null }

const sourceTabs: SourceKind[] = ['notes', 'tasks', 'recordings']

const emptySources: SourcesByKind = { notes: [], tasks: [], recordings: [] }

const WELCOME_ID = 'welcome'

// Chats of an account signed out on this device stay in their own bucket.
const GUEST_SCOPE = 'local-device'

// Verified against the deployed project: `Gemini-chat` returns 404, while
// `Gemini-chat-` (trailing hyphen) returns 200. Try the live slug first and keep
// the requested name as a fallback for when the function is renamed.
const AI_FUNCTION_NAMES = ['Gemini-chat-', 'Gemini-chat'] as const

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatTaskDate(value: string | null, lang: Lang): string {
  if (!value) return t(lang, 'aiNotSet')
  const numeric = Number(value)
  const date = new Date(Number.isFinite(numeric) ? numeric : value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(lang)
}

function previewText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function getInvokeStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('context' in error)) return undefined
  const context = (error as { context?: unknown }).context
  return context instanceof Response ? context.status : undefined
}

async function describeInvokeError(error: unknown): Promise<string> {
  if (error && typeof error === 'object') {
    const details: Record<string, unknown> = {}
    const candidate = error as { name?: unknown; message?: unknown; context?: unknown; cause?: unknown }

    if (typeof candidate.name === 'string') details.name = candidate.name
    if (typeof candidate.message === 'string') details.message = candidate.message

    if (candidate.context instanceof Response) {
      details.status = candidate.context.status
      details.statusText = candidate.context.statusText
      details.url = candidate.context.url
      try {
        const body = await candidate.context.clone().text()
        if (body) {
          try {
            details.body = JSON.parse(body)
          } catch {
            details.body = body
          }
        }
      } catch {
        // The body may already be consumed; keep the status and URL.
      }
    } else if (candidate.context !== undefined) {
      details.context = candidate.context instanceof Error
        ? `${candidate.context.name}: ${candidate.context.message}`
        : String(candidate.context)
    }

    if (candidate.cause !== undefined) {
      details.cause = candidate.cause instanceof Error
        ? `${candidate.cause.name}: ${candidate.cause.message}`
        : String(candidate.cause)
    }

    for (const [key, value] of Object.entries(error)) {
      if (!(key in details)) {
        details[key] = value instanceof Error ? `${value.name}: ${value.message}` : value
      }
    }

    if (Object.keys(details).length > 0) {
      try {
        return JSON.stringify(details)
      } catch {
        // Fall through to the safe string fallback below.
      }
    }
  }

  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error as object)) || String(error) || 'Unknown error'
  } catch {
    return String(error) || 'Unknown error'
  }
}

async function fetchUserSources(recordings: ReturnType<typeof useStore>['recordings'], lang: Lang): Promise<SourcesByKind> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('An authenticated session is required')

  const userId = authData.user.id
  const [notesResult, tasksResult, recordingsResult] = await Promise.all([
    supabase
      .from('notes')
      .select('id,title,content,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('tasks')
      .select('id,title,description,completed,priority,date,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('recordings')
      .select('id,name,duration,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const queryError = notesResult.error || tasksResult.error || recordingsResult.error
  if (queryError) throw queryError

  const notes = (notesResult.data ?? []) as NoteRow[]
  const tasks = (tasksResult.data ?? []) as TaskRow[]
  const remoteRecordings = (recordingsResult.data ?? []) as RecordingRow[]
  const localRecordings = new Map(recordings.map((recording) => [recording.id, recording]))

  return {
    notes: notes.map((note) => {
      const title = note.title?.trim() || t(lang, 'untitled')
      const content = note.content?.trim() || t(lang, 'aiNoTextContent')
      return {
        id: note.id,
        kind: 'notes',
        title,
        preview: previewText(content) || t(lang, 'aiNoTextContent'),
        context: `${t(lang, 'aiNoteTitleLabel')}: ${title}\n${t(lang, 'aiContentLabel')}:\n${content}`,
      }
    }),
    tasks: tasks.map((task) => {
      const title = task.title?.trim() || t(lang, 'aiTaskUntitled')
      const description = task.description?.trim() || t(lang, 'aiNoDescription')
      const status = task.completed ? t(lang, 'completed') : t(lang, 'aiIncomplete')
      const dueDate = formatTaskDate(task.date, lang)
      return {
        id: task.id,
        kind: 'tasks',
        title,
        preview: `${status} · ${description}`.slice(0, 120),
        context: [
          `${t(lang, 'taskTitle')}: ${title}`,
          `${t(lang, 'aiStatusLabel')}: ${status}`,
          `${t(lang, 'priority')}: ${task.priority || t(lang, 'aiNotSpecified')}`,
          `${t(lang, 'date')}: ${dueDate}`,
          `${t(lang, 'description')}: ${description}`,
        ].join('\n'),
      }
    }),
    recordings: remoteRecordings.map((recording) => {
      const local = localRecordings.get(recording.id)
      const title = recording.name?.trim() || t(lang, 'aiRecordingUntitled')
      const description = local?.description?.trim() || t(lang, 'aiNoRecordingDescription')
      const duration = formatDuration(recording.duration ?? 0)
      return {
        id: recording.id,
        kind: 'recordings',
        title,
        preview: local?.description?.trim() || `${t(lang, 'duration')}: ${duration}`,
        context: [
          `${t(lang, 'recName')}: ${title}`,
          `${t(lang, 'description')}: ${description}`,
          `${t(lang, 'duration')}: ${duration}`,
          t(lang, 'aiTranscriptUnavailable'),
        ].join('\n'),
      }
    }),
  }
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="ai-chat-markdown" dir="auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

function MessageList({
  messages,
  isLoading,
  errorMessage,
  hasEarlier,
  isLoadingEarlier,
  onLoadEarlier,
}: {
  messages: ChatMessage[]
  isLoading: boolean
  errorMessage: string | null
  hasEarlier: boolean
  isLoadingEarlier: boolean
  onLoadEarlier: () => void
}) {
  const tr = useT()
  const endOfMessages = useRef<HTMLDivElement>(null)
  const lastMessageId = messages[messages.length - 1]?.id

  // Only follow new messages, so loading older ones does not jump the view.
  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [lastMessageId, isLoading, errorMessage])

  return (
    <div className="ai-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
      <div className="ai-chat-message-list">
        {hasEarlier ? (
          <button
            type="button"
            className="ai-chat-load-earlier"
            onClick={onLoadEarlier}
            disabled={isLoadingEarlier}
          >
            {isLoadingEarlier ? <LoaderCircle size={15} className="ai-chat-spinner" /> : null}
            <span>{tr('aiLoadEarlier')}</span>
          </button>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`ai-chat-message ${message.role}${message.isError ? ' is-error' : ''}`}
          >
            <div className={`ai-chat-bubble${message.isError ? ' is-error' : ''}`}>
              {message.sourceLabel ? <div className="ai-chat-source-label">{tr('aiAttached')}: {message.sourceLabel}</div> : null}
              {message.role === 'assistant' ? (
                <AssistantMarkdown content={message.content} />
              ) : (
                <p dir="auto">{message.content}</p>
              )}
            </div>
          </article>
        ))}
        {errorMessage ? (
          <article className="ai-chat-message assistant is-error" role="alert">
            <div className="ai-chat-bubble is-error">
              <p dir="auto">{errorMessage}</p>
            </div>
          </article>
        ) : null}
        {isLoading ? (
          <article className="ai-chat-message assistant" role="status" aria-label={tr('aiThinking')}>
            <div className="ai-chat-bubble ai-chat-thinking">
              <span className="ai-chat-thinking-dot animate-bounce" style={{ animationDelay: '-0.24s' }} />
              <span className="ai-chat-thinking-dot animate-bounce" style={{ animationDelay: '-0.12s' }} />
              <span className="ai-chat-thinking-dot animate-bounce" style={{ animationDelay: '0s' }} />
            </div>
          </article>
        ) : null}
        <div ref={endOfMessages} />
      </div>
    </div>
  )
}

function SourceSheet({
  open,
  onClose,
  activeTab,
  onTabChange,
  sourceState,
  sourceError,
  sources,
  onRetry,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  activeTab: SourceKind
  onTabChange: (tab: SourceKind) => void
  sourceState: 'idle' | 'loading' | 'ready' | 'error'
  sourceError: string
  sources: SourcesByKind
  onRetry: () => void
  onSelect: (source: ChatSource) => void
}) {
  const tr = useT()
  const items = sources[activeTab]
  const Icon = activeTab === 'notes' ? FileText : activeTab === 'tasks' ? CheckSquare : Mic

  return (
    <Sheet open={open} onClose={onClose} title={tr('aiChooseSource')}>
      <div className="ai-source-sheet">
        <div className="ai-source-tabs" role="tablist" aria-label={tr('aiSourceType')}>
          {sourceTabs.map((tab) => (
            <button
              key={tab}
              id={`ai-source-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls="ai-source-panel"
              className={activeTab === tab ? 'active' : ''}
              onClick={() => onTabChange(tab)}
            >
              {tr(tab)}
            </button>
          ))}
        </div>
        <div
          id="ai-source-panel"
          className="ai-source-list"
          role="tabpanel"
          aria-labelledby={`ai-source-tab-${activeTab}`}
          aria-busy={sourceState === 'loading'}
        >
          {sourceState === 'loading' ? (
            <div className="ai-source-status" role="status">
              <LoaderCircle size={18} className="ai-chat-spinner" />
              <span>{tr('aiLoadingSources')}</span>
            </div>
          ) : sourceState === 'error' ? (
            <div className="ai-source-status error" role="alert">
              <p>{sourceError}</p>
              <button type="button" className="ai-source-retry" onClick={onRetry}>
                {tr('retry')}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="ai-source-status">{tr('aiNoSources')}</div>
          ) : (
            items.map((source) => (
              <button
                key={`${source.kind}-${source.id}`}
                type="button"
                className="ai-source-item"
                onClick={() => onSelect(source)}
              >
                <span className="ai-source-item-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="ai-source-item-copy">
                  <strong>{source.title}</strong>
                  <span>{source.preview}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Sheet>
  )
}

function HistorySheet({
  open,
  onClose,
  lang,
  conversations,
  state,
  activeId,
  renameId,
  renameDraft,
  onRenameDraft,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onOpenConversation,
  onRequestDelete,
  onNewChat,
  onRequestClearAll,
  onRetry,
}: {
  open: boolean
  onClose: () => void
  lang: Lang
  conversations: AiConversation[]
  state: 'loading' | 'ready' | 'error'
  activeId: string | null
  renameId: string | null
  renameDraft: string
  onRenameDraft: (value: string) => void
  onStartRename: (conversation: AiConversation) => void
  onCommitRename: (conversation: AiConversation) => void
  onCancelRename: () => void
  onOpenConversation: (conversation: AiConversation) => void
  onRequestDelete: (conversation: AiConversation) => void
  onNewChat: () => void
  onRequestClearAll: () => void
  onRetry: () => void
}) {
  const tr = useT()

  return (
    <Sheet open={open} onClose={onClose} title={tr('aiHistory')}>
      <div className="ai-chat-history">
        <button type="button" className="ai-chat-history-new" onClick={onNewChat}>
          <Plus size={17} />
          <span>{tr('aiNewChat')}</span>
        </button>
        <p className="ai-chat-history-note">{tr('aiLocalOnlyNote')}</p>

        {state === 'loading' ? (
          <div className="ai-chat-history-status" role="status">
            <LoaderCircle size={18} className="ai-chat-spinner" />
          </div>
        ) : state === 'error' ? (
          <div className="ai-chat-history-status error" role="alert">
            <p>{tr('aiHistoryLoadError')}</p>
            <button type="button" className="ai-chat-history-retry" onClick={onRetry}>
              {tr('retry')}
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="ai-chat-history-empty">
            <History size={22} aria-hidden="true" />
            <strong>{tr('aiHistoryEmpty')}</strong>
            <span>{tr('aiHistoryEmptyHint')}</span>
          </div>
        ) : (
          <ul className="ai-chat-history-list">
            {conversations.map((conversation) => (
              <li key={conversation.id} className={conversation.id === activeId ? 'active' : ''}>
                {renameId === conversation.id ? (
                  <form
                    className="ai-chat-history-rename"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onCommitRename(conversation)
                    }}
                  >
                    <input
                      autoFocus
                      value={renameDraft}
                      maxLength={120}
                      aria-label={tr('rename')}
                      onChange={(event) => onRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          event.stopPropagation()
                          onCancelRename()
                        }
                      }}
                    />
                    <button type="submit" aria-label={tr('save')} title={tr('save')}>
                      <Check size={16} />
                    </button>
                    <button type="button" aria-label={tr('cancel')} title={tr('cancel')} onClick={onCancelRename}>
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ai-chat-history-open"
                      onClick={() => onOpenConversation(conversation)}
                    >
                      <span className="ai-chat-history-title" dir="auto">
                        {conversation.title || tr('untitled')}
                      </span>
                      <span className="ai-chat-history-date">{formatDateTime(conversation.updatedAt, lang)}</span>
                    </button>
                    <div className="ai-chat-history-actions">
                      <button
                        type="button"
                        aria-label={tr('rename')}
                        title={tr('rename')}
                        onClick={() => onStartRename(conversation)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        aria-label={tr('delete')}
                        title={tr('delete')}
                        onClick={() => onRequestDelete(conversation)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="ai-chat-history-manage">
          <p>{tr('aiDeleteAllChatsHint')}</p>
          <button
            type="button"
            className="ai-chat-history-danger"
            onClick={onRequestClearAll}
            disabled={conversations.length === 0}
          >
            <Trash2 size={16} />
            <span>{tr('aiDeleteAllChats')}</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function toChatMessage(row: { id: string; role: 'user' | 'assistant'; content: string; sourceLabel?: string; seq?: number }): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sourceLabel: row.sourceLabel,
    seq: row.seq,
  }
}

export default function AIChatPage() {
  const tr = useT()
  const navigate = useNavigate()
  const { recordings, lang } = useStore()
  const { user, loading: authLoading } = useAuth()
  const scopeId = user?.id ?? GUEST_SCOPE

  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [messagesError, setMessagesError] = useState(false)
  const [storageIssue, setStorageIssue] = useState<AiStorageIssue | null>(null)
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<AiConversation | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pastedContext, setPastedContext] = useState('')
  const [contextDraft, setContextDraft] = useState('')
  const [contextEditorOpen, setContextEditorOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SourceKind>('notes')
  const [sources, setSources] = useState<SourcesByKind>(emptySources)
  const [sourceState, setSourceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [sourceError, setSourceError] = useState('')
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null)

  const activeIdRef = useRef<string | null>(null)
  const openToken = useRef(0)
  // Conversations removed this session, so a reply still in flight cannot bring
  // a deleted chat back from the dead.
  const deletedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? null
  const hasEarlier = Boolean(activeConversation && messages.length < activeConversation.messageCount)

  /** Opens a saved chat and reads only its newest page of messages. */
  const openConversation = useCallback(async (conversation: AiConversation) => {
    const token = openToken.current + 1
    openToken.current = token
    setActiveId(conversation.id)
    activeIdRef.current = conversation.id
    setMessages([])
    setIsLoadingEarlier(false)
    setMessagesError(false)
    setErrorMessage(null)
    setSelectedSource(null)
    setPastedContext('')
    setContextDraft('')
    setContextEditorOpen(false)

    try {
      const rows = await loadMessages(conversation.id, { limit: AI_MESSAGE_PAGE_SIZE })
      if (token !== openToken.current) return
      setMessages(rows.map(toChatMessage))
    } catch (error) {
      if (token !== openToken.current) return
      setMessagesError(true)
      setStorageIssue(describeAiStorageIssue(error))
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryState('loading')
    try {
      const list = await listConversations(scopeId)
      setConversations(list)
      setHistoryState('ready')
      return list
    } catch (error) {
      setHistoryState('error')
      setStorageIssue(describeAiStorageIssue(error))
      return [] as AiConversation[]
    }
  }, [scopeId])

  useEffect(() => {
    if (authLoading) return
    let alive = true
    openToken.current += 1
    setActiveId(null)
    activeIdRef.current = null
    setMessages([])
    setMessagesError(false)
    setErrorMessage(null)

    void (async () => {
      const available = await isAiHistoryAvailable()
      if (!alive) return
      if (!available) setStorageIssue('unavailable')
      const list = await loadHistory()
      if (!alive || list.length === 0) return
      await openConversation(list[0]!)
    })()

    return () => {
      alive = false
    }
  }, [authLoading, openConversation, loadHistory])

  /** In-memory chat used only when IndexedDB refuses writes, so chatting still works. */
  function volatileConversation(title: string): AiConversation {
    const createdAt = Date.now()
    return {
      id: crypto.randomUUID(),
      userId: scopeId,
      title,
      createdAt,
      updatedAt: createdAt,
      messageCount: 0,
    }
  }

  async function loadEarlierMessages() {
    if (!activeConversation || isLoadingEarlier) return
    const first = messages[0]
    if (!first || first.seq === undefined) return
    setIsLoadingEarlier(true)
    try {
      const older = await loadMessages(activeConversation.id, {
        limit: AI_MESSAGE_PAGE_SIZE,
        beforeSeq: first.seq,
      })
      if (!older.length) return
      setMessages((current) => [...older.map(toChatMessage), ...current])
    } catch (error) {
      setStorageIssue(describeAiStorageIssue(error))
    } finally {
      setIsLoadingEarlier(false)
    }
  }

  async function startNewChat() {
    setHistoryOpen(false)
    setErrorMessage(null)
    setMessagesError(false)
    setPastedContext('')
    setContextDraft('')
    setContextEditorOpen(false)
    setSelectedSource(null)
    setDraft('')
    openToken.current += 1

    let conversation: AiConversation
    try {
      conversation = await createConversation(scopeId, tr('aiNewChat'))
    } catch (error) {
      setStorageIssue(describeAiStorageIssue(error))
      conversation = volatileConversation(tr('aiNewChat'))
    }
    deletedIds.current.delete(conversation.id)
    setConversations((current) => [conversation, ...current])
    setActiveId(conversation.id)
    activeIdRef.current = conversation.id
    setMessages([])
  }

  function revertToChat(remaining: AiConversation[]) {
    const next = remaining[0]
    if (next) void openConversation(next)
    else {
      openToken.current += 1
      setActiveId(null)
      activeIdRef.current = null
      setMessages([])
      setMessagesError(false)
      setErrorMessage(null)
    }
  }

  async function removeConversation(target: AiConversation) {
    setPendingDelete(null)
    deletedIds.current.add(target.id)
    const remaining = conversations.filter((conversation) => conversation.id !== target.id)
    setConversations(remaining)
    if (activeId === target.id) revertToChat(remaining)
    try {
      await deleteConversation(target.id)
    } catch (error) {
      setStorageIssue(describeAiStorageIssue(error))
    }
  }

  async function removeAllConversations() {
    setConfirmClearAll(false)
    for (const conversation of conversations) deletedIds.current.add(conversation.id)
    try {
      await clearConversations(scopeId)
    } catch (error) {
      setStorageIssue(describeAiStorageIssue(error))
      return
    }
    setConversations([])
    revertToChat([])
  }

  function startRename(conversation: AiConversation) {
    setRenameId(conversation.id)
    setRenameDraft(conversation.title)
  }

  async function commitRename(conversation: AiConversation) {
    const title = renameDraft.trim()
    setRenameId(null)
    if (!title || title === conversation.title) return
    try {
      const saved = await renameConversation(conversation, title)
      setConversations((current) => current.map((item) => (item.id === saved.id ? saved : item)))
    } catch (error) {
      setStorageIssue(describeAiStorageIssue(error))
    }
  }

  function openFromHistory(conversation: AiConversation) {
    setHistoryOpen(false)
    setRenameId(null)
    if (conversation.id !== activeId) void openConversation(conversation)
  }

  /** Saves a message and refreshes only the open chat and its metadata. */
  async function persistMessage(
    conversation: AiConversation,
    input: { role: 'user' | 'assistant'; content: string; sourceLabel?: string },
    optimisticId: string | null,
  ): Promise<AiConversation> {
    if (deletedIds.current.has(conversation.id)) return conversation
    try {
      const stored = await appendMessage(conversation, input)
      setConversations((current) =>
        current.map((item) => (item.id === stored.conversation.id ? stored.conversation : item)),
      )
      if (activeIdRef.current === conversation.id) {
        const saved = toChatMessage(stored.message)
        setMessages((current) =>
          optimisticId ? current.map((message) => (message.id === optimisticId ? saved : message)) : [...current, saved],
        )
      }
      return stored.conversation
    } catch (error) {
      setStorageIssue(describeAiStorageIssue(error))
      return conversation
    }
  }

  function openContextEditor() {
    if (!contextEditorOpen) setContextDraft(pastedContext)
    setContextEditorOpen(!contextEditorOpen)
  }

  function saveContext() {
    setPastedContext(contextDraft.trim())
    setContextEditorOpen(false)
  }

  async function loadSources() {
    setSourceState('loading')
    setSourceError('')
    try {
      setSources(await fetchUserSources(recordings, lang))
      setSourceState('ready')
    } catch {
      setSourceError(tr('aiLoadSourcesError'))
      setSourceState('error')
    }
  }

  function openSources() {
    setSourceOpen(true)
    if (sourceState === 'idle' || sourceState === 'error') void loadSources()
  }

  const handleSendMessage = async (userText: string) => {
    if (!userText || isLoading) return

    const source = selectedSource
    // Only this chat's recent turns go to the AI, capped like the existing context.
    const historyContext = buildHistoryContext(messages)
    const attachedContext = [
      historyContext ? `Conversation so far:\n${historyContext}` : '',
      source?.context ?? '',
      pastedContext.trim(),
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20000)
    const sourceLabel = [source?.title, pastedContext.trim() ? tr('aiCustomContext') : undefined]
      .filter(Boolean)
      .join(' · ')

    try {
      setIsLoading(true)
      setErrorMessage(null)

      let conversation = conversations.find((item) => item.id === activeId) ?? null
      if (!conversation) {
        const title = deriveConversationTitle(userText, tr('aiNewChat'))
        try {
          conversation = await createConversation(scopeId, title)
        } catch (error) {
          setStorageIssue(describeAiStorageIssue(error))
          conversation = volatileConversation(title)
        }
        setConversations((current) => [conversation as AiConversation, ...current])
        setActiveId(conversation.id)
        activeIdRef.current = conversation.id
        setMessages([])
      }

      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
        sourceLabel: sourceLabel || undefined,
      }
      setMessages((current) => [...current, optimistic])
      setDraft('')
      setSelectedSource(null)

      // The first user message names the chat, with plain string work only.
      if (conversation.messageCount === 0) {
        conversation = { ...conversation, title: deriveConversationTitle(userText, conversation.title || tr('aiNewChat')) }
      }
      conversation = await persistMessage(conversation, {
        role: 'user',
        content: userText,
        sourceLabel: sourceLabel || undefined,
      }, optimistic.id)

      setPastedContext('')
      setContextDraft('')

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setErrorMessage(tr('aiOffline'))
        return
      }

      if (!import.meta.env.VITE_SUPABASE_URL) throw new Error('VITE_SUPABASE_URL is missing!')
      if (!import.meta.env.VITE_SUPABASE_ANON_KEY) throw new Error('VITE_SUPABASE_ANON_KEY is missing!')
      if (!supabase) throw new Error('Supabase is not configured')

      let responseData: { response?: string } | null = null
      let invokeError: unknown = null

      for (const functionName of AI_FUNCTION_NAMES) {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {
            message: userText,
            context: attachedContext,
            lang,
          },
        })

        if (!error) {
          responseData = data as { response?: string } | null
          invokeError = null
          break
        }

        invokeError = error
        console.error(`Supabase Error (${functionName}):`, error)

        // Only retry the alternate slug when the live function is missing.
        // Network/auth/server failures should surface as-is, not be masked by a 404.
        if (getInvokeStatus(error) !== 404) break
      }

      if (invokeError) throw invokeError

      const assistantText = typeof responseData?.response === 'string' ? responseData.response.trim() : ''
      if (!assistantText) {
        throw new Error('No response received from AI')
      }

      const reply: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: assistantText }
      if (activeIdRef.current === conversation.id) setMessages((current) => [...current, reply])
      await persistMessage(conversation, { role: 'assistant', content: assistantText }, reply.id)
    } catch (error) {
      console.error('Chat Error:', error)
      setErrorMessage(await describeInvokeError(error))
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleSendMessage(draft.trim())
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void handleSendMessage(draft.trim())
  }

  const welcome: ChatMessage = { id: WELCOME_ID, role: 'assistant', content: tr('aiWelcome') }
  const visibleMessages: ChatMessage[] = [welcome, ...messages]
  const headerTitle = activeConversation?.title?.trim() || tr('aiAssistant')
  const storageMessage =
    storageIssue === 'quota'
      ? tr('aiStorageFull')
      : storageIssue === 'unavailable'
        ? tr('aiStorageUnavailable')
        : null

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-header">
        <CloseBtn variant="modal" onClick={() => navigate('/')} />
        <div className="ai-chat-heading">
          <span className="ai-chat-heading-icon" aria-hidden="true">
            <Bot size={20} />
          </span>
          <h1 title={headerTitle}>{headerTitle}</h1>
        </div>
        <div className="ai-chat-header-actions">
          <button
            type="button"
            className="ai-chat-icon-btn"
            aria-label={tr('aiHistory')}
            title={tr('aiHistory')}
            onClick={() => setHistoryOpen(true)}
          >
            <History size={19} />
          </button>
          <button
            type="button"
            className="ai-chat-icon-btn"
            aria-label={tr('aiNewChat')}
            title={tr('aiNewChat')}
            onClick={() => void startNewChat()}
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {storageMessage ? (
        <div className="ai-chat-banner" role="status">
          <span>{storageMessage}</span>
          <button type="button" aria-label={tr('close')} title={tr('close')} onClick={() => setStorageIssue(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      <MessageList
        messages={visibleMessages}
        isLoading={isLoading}
        errorMessage={errorMessage ?? (messagesError ? tr('aiMessagesLoadError') : null)}
        hasEarlier={hasEarlier}
        isLoadingEarlier={isLoadingEarlier}
        onLoadEarlier={() => void loadEarlierMessages()}
      />

      <footer className="ai-chat-composer">
        <div className="ai-chat-composer-inner">
          <div className="ai-chat-composer-toolbar">
            <button
              type="button"
              className={`ai-chat-context-pill${pastedContext ? ' has-context' : ''}`}
              aria-expanded={contextEditorOpen}
              aria-controls="ai-chat-context-panel"
              aria-pressed={Boolean(pastedContext)}
              onClick={openContextEditor}
            >
              <Code size={16} />
              <span>{tr('aiAddContext')}</span>
              {pastedContext ? <span className="ai-chat-context-status">{tr('aiAttached')}</span> : null}
            </button>
            {pastedContext ? (
              <CloseBtn variant="modal" onClick={() => {
                setPastedContext('')
                setContextDraft('')
              }} />
            ) : null}
          </div>
          {contextEditorOpen ? (
            <div id="ai-chat-context-panel" className="ai-chat-context-panel">
              <label htmlFor="ai-chat-context-input">{tr('aiPasteContext')}</label>
              <textarea
                id="ai-chat-context-input"
                rows={4}
                maxLength={20000}
                value={contextDraft}
                onChange={(event) => setContextDraft(event.target.value)}
                placeholder={tr('aiPasteContextPlaceholder')}
              />
              <div className="ai-chat-context-actions">
                <button type="button" className="ai-chat-context-cancel" onClick={() => setContextEditorOpen(false)}>
                  {tr('cancel')}
                </button>
                <button type="button" className="ai-chat-context-save" onClick={saveContext}>
                  {tr('aiSaveContext')}
                </button>
              </div>
            </div>
          ) : null}
          {selectedSource ? (
            <div className="ai-chat-selected-source">
              <span><FileText size={15} /> {tr('aiSourceAttachedLabel')}: {selectedSource.title}</span>
              <CloseBtn variant="modal" onClick={() => setSelectedSource(null)} />
            </div>
          ) : null}
          <form className="ai-chat-form" onSubmit={handleSubmit}>
            <div className="ai-chat-input-shell">
              <button
                type="button"
                className="ai-chat-source-trigger"
                aria-label={tr('aiAttachSource')}
                title={tr('aiAttachSourceTitle')}
                onClick={openSources}
              >
                <Paperclip size={18} />
              </button>
              <textarea
                aria-label={tr('aiMessageLabel')}
                rows={1}
                maxLength={8000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={tr('aiMessagePlaceholder')}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="ai-chat-send"
                aria-label={tr('aiSend')}
                disabled={!draft.trim() || isLoading}
              >
                <Send size={17} />
                <span>{tr('aiSend')}</span>
              </button>
            </div>
          </form>
          <p className="ai-chat-privacy-note">{tr('aiPrivacyNote')}</p>
        </div>
      </footer>

      <HistorySheet
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false)
          setRenameId(null)
        }}
        lang={lang}
        conversations={conversations}
        state={historyState}
        activeId={activeId}
        renameId={renameId}
        renameDraft={renameDraft}
        onRenameDraft={setRenameDraft}
        onStartRename={startRename}
        onCommitRename={(conversation) => void commitRename(conversation)}
        onCancelRename={() => setRenameId(null)}
        onOpenConversation={openFromHistory}
        onRequestDelete={setPendingDelete}
        onNewChat={() => void startNewChat()}
        onRequestClearAll={() => setConfirmClearAll(true)}
        onRetry={() => {
          void (async () => {
            const list = await loadHistory()
            if (!list.length || activeId) return
            await openConversation(list[0]!)
          })()
        }}
      />

      <SourceSheet
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sourceState={sourceState}
        sourceError={sourceError}
        sources={sources}
        onRetry={() => void loadSources()}
        onSelect={(source) => {
          setSelectedSource(source)
          setSourceOpen(false)
        }}
      />

      <Confirm
        open={Boolean(pendingDelete)}
        title={tr('delete')}
        body={tr('aiChatDeleteConfirm')}
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeConversation(pendingDelete)
        }}
      />

      <Confirm
        open={confirmClearAll}
        title={tr('aiDeleteAllChats')}
        body={tr('aiDeleteAllChatsConfirm')}
        danger
        onClose={() => setConfirmClearAll(false)}
        onConfirm={() => void removeAllConversations()}
      />
    </div>
  )
}
