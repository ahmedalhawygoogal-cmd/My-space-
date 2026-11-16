import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, CheckSquare, Code, FileText, LoaderCircle, Mic, Paperclip, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { useStore } from '../store'
import { t } from '../i18n'
import type { Lang } from '../types'
import { Sheet, CloseBtn, useT } from '../ui'
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
}: {
  messages: ChatMessage[]
  isLoading: boolean
  errorMessage: string | null
}) {
  const tr = useT()
  const endOfMessages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages, isLoading, errorMessage])

  return (
    <div className="ai-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
      <div className="ai-chat-message-list">
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

export default function AIChatPage() {
  const tr = useT()
  const navigate = useNavigate()
  const { recordings, lang } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: tr('aiWelcome'),
    },
  ])
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

  useEffect(() => {
    setMessages((current) => current.map((m) => (m.id === 'welcome' ? { ...m, content: tr('aiWelcome') } : m)))
  }, [lang])

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
    const attachedContext = [source?.context, pastedContext.trim()]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20000)
    const sourceLabel = [source?.title, pastedContext.trim() ? tr('aiCustomContext') : undefined]
      .filter(Boolean)
      .join(' · ')

    try {
      setIsLoading(true)
      setErrorMessage(null)

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', content: userText, sourceLabel: sourceLabel || undefined },
      ])
      setDraft('')
      setSelectedSource(null)

      if (!supabase) throw new Error('Supabase is not configured')

      const { data, error } = await supabase.functions.invoke('Gemini-chat-', {
        body: {
          message: userText,
          context: attachedContext,
          lang,
        },
      })

      if (error) {
        console.error("Supabase Error:", error)
        throw new Error(error.message)
      }

      const assistantText = typeof data?.response === 'string' ? data.response.trim() : ''
      if (!assistantText) {
        throw new Error('No response received from AI')
      }

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: assistantText },
      ])
    } catch (error) {
      console.error("Chat Error:", error)
      const message = error instanceof Error ? error.message : String(error)
      setErrorMessage(`${tr('error')}: ${message}`)
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

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-header">
        <div className="ai-chat-heading">
          <span className="ai-chat-heading-icon" aria-hidden="true">
            <Bot size={20} />
          </span>
          <h1>{tr('aiAssistant')}</h1>
        </div>
        <CloseBtn variant="modal" onClick={() => navigate('/')} />
      </header>

      <MessageList messages={messages} isLoading={isLoading} errorMessage={errorMessage} />

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
    </div>
  )
}
