import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, CheckSquare, Code, FileText, LoaderCircle, Mic, Paperclip, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store'
import { Sheet } from '../ui'
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

const sourceTabs: { id: SourceKind; label: string }[] = [
  { id: 'notes', label: 'ملاحظات' },
  { id: 'tasks', label: 'مهام' },
  { id: 'recordings', label: 'تسجيلات' },
]

const emptySources: SourcesByKind = { notes: [], tasks: [], recordings: [] }

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatTaskDate(value: string | null): string {
  if (!value) return 'غير محدد'
  const numeric = Number(value)
  const date = new Date(Number.isFinite(numeric) ? numeric : value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ar')
}

function previewText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

async function getActualErrorMessage(error: unknown): Promise<string> {
  if (error instanceof Error && 'context' in error && error.context instanceof Response) {
    const response = error.context
    try {
      const payload: unknown = await response.clone().json()
      if (payload && typeof payload === 'object') {
        const details = payload as Record<string, unknown>
        for (const key of ['error', 'message', 'details']) {
          const value = details[key]
          if (typeof value === 'string' && value.trim()) return value.trim()
        }
      }
    } catch {
      try {
        const text = await response.clone().text()
        if (text.trim()) return text.trim()
      } catch {
        return error.message
      }
    }
  }

  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error) || String(error)
  } catch {
    return String(error)
  }
}

async function fetchUserSources(recordings: ReturnType<typeof useStore>['recordings']): Promise<SourcesByKind> {
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
      const title = note.title?.trim() || 'بدون عنوان'
      const content = note.content?.trim() || 'لا يوجد محتوى نصي.'
      return {
        id: note.id,
        kind: 'notes',
        title,
        preview: previewText(content) || 'لا يوجد محتوى نصي.',
        context: `عنوان الملاحظة: ${title}\nالمحتوى:\n${content}`,
      }
    }),
    tasks: tasks.map((task) => {
      const title = task.title?.trim() || 'مهمة بدون عنوان'
      const description = task.description?.trim() || 'لا يوجد وصف إضافي.'
      const status = task.completed ? 'مكتملة' : 'غير مكتملة'
      const dueDate = formatTaskDate(task.date)
      return {
        id: task.id,
        kind: 'tasks',
        title,
        preview: `${status} · ${description}`.slice(0, 120),
        context: [
          `عنوان المهمة: ${title}`,
          `الحالة: ${status}`,
          `الأولوية: ${task.priority || 'غير محددة'}`,
          `تاريخ المهمة: ${dueDate}`,
          `الوصف: ${description}`,
        ].join('\n'),
      }
    }),
    recordings: remoteRecordings.map((recording) => {
      const local = localRecordings.get(recording.id)
      const title = recording.name?.trim() || 'تسجيل بدون اسم'
      const description = local?.description?.trim() || 'لا يتوفر وصف نصي لهذا التسجيل.'
      const duration = formatDuration(recording.duration ?? 0)
      return {
        id: recording.id,
        kind: 'recordings',
        title,
        preview: local?.description?.trim() || `مدة التسجيل ${duration}`,
        context: [
          `اسم التسجيل: ${title}`,
          `الوصف: ${description}`,
          `المدة: ${duration}`,
          'ملاحظة: لا يتوفر نص مفرغ من الصوت؛ هذه بيانات التسجيل ووصفه فقط.',
        ].join('\n'),
      }
    }),
  }
}

function MessageList({ messages, isLoading }: { messages: ChatMessage[]; isLoading: boolean }) {
  const endOfMessages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages, isLoading])

  return (
    <div className="ai-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
      <div className="ai-chat-message-list">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`ai-chat-message ${message.role}${message.isError ? ' is-error' : ''}`}
          >
            <div className={`ai-chat-bubble${message.isError ? ' is-error' : ''}`}>
              {message.sourceLabel ? <div className="ai-chat-source-label">مرفق: {message.sourceLabel}</div> : null}
              <p dir="auto">{message.content}</p>
            </div>
          </article>
        ))}
        {isLoading ? (
          <article className="ai-chat-message assistant" role="status" aria-label="يفكر في إجابة واضحة">
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
  const items = sources[activeTab]
  const Icon = activeTab === 'notes' ? FileText : activeTab === 'tasks' ? CheckSquare : Mic

  return (
    <Sheet open={open} onClose={onClose} title="اختر مصدراً واحداً">
      <div className="ai-source-sheet">
        <div className="ai-source-tabs" role="tablist" aria-label="نوع المصدر">
          {sourceTabs.map((tab) => (
            <button
              key={tab.id}
              id={`ai-source-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="ai-source-panel"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
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
              <span>جارٍ تحميل مصادرك...</span>
            </div>
          ) : sourceState === 'error' ? (
            <div className="ai-source-status error" role="alert">
              <p>{sourceError}</p>
              <button type="button" className="ai-source-retry" onClick={onRetry}>
                إعادة المحاولة
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="ai-source-status">لا توجد مصادر هنا بعد.</div>
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
  const navigate = useNavigate()
  const { recordings } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'أهلًا، أنا مساعد مساحتي. كيف أقدر أساعدك اليوم؟ اسألني عن ملاحظاتك أو مهامك، أو أضف سياقًا مخصصًا لسؤالك.',
    },
  ])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pastedContext, setPastedContext] = useState('')
  const [contextDraft, setContextDraft] = useState('')
  const [contextEditorOpen, setContextEditorOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SourceKind>('notes')
  const [sources, setSources] = useState<SourcesByKind>(emptySources)
  const [sourceState, setSourceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [sourceError, setSourceError] = useState('')
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null)

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
      setSources(await fetchUserSources(recordings))
      setSourceState('ready')
    } catch {
      setSourceError('تعذّر تحميل المصادر من مساحتي. تحقق من اتصالك وحاول مجددًا.')
      setSourceState('error')
    }
  }

  function openSources() {
    setSourceOpen(true)
    if (sourceState === 'idle' || sourceState === 'error') void loadSources()
  }

  async function sendMessage() {
    const userText = draft.trim()
    if (!userText || isLoading) return

    const source = selectedSource
    const attachedContext = [source?.context, pastedContext.trim()]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20000)
    const sourceLabel = [source?.title, pastedContext.trim() ? 'سياق مخصص' : undefined]
      .filter(Boolean)
      .join(' · ')
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: userText, sourceLabel: sourceLabel || undefined },
    ])
    setDraft('')
    setSelectedSource(null)
    setIsLoading(true)

    try {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase.functions.invoke('Gemini-chat', { body: { message: userText, context: attachedContext || "" } });
      if (error) throw error
      const response = typeof data?.response === 'string' ? data.response.trim() : ''
      if (!response) throw new Error('The assistant returned an empty response')
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response }])
    } catch (error) {
      console.error(error)
      const actualError = await getActualErrorMessage(error)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `API Error: ${actualError}`,
          isError: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void sendMessage()
  }

  return (
    <div className="ai-chat-page" dir="rtl">
      <header className="ai-chat-header">
        <div className="ai-chat-heading">
          <span className="ai-chat-heading-icon" aria-hidden="true">
            <Bot size={20} />
          </span>
          <h1>مساعد مساحتي</h1>
        </div>
        <button type="button" className="ai-chat-close" aria-label="إغلاق المحادثة" onClick={() => navigate('/')}>
          <X size={20} />
        </button>
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

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
              <span>إضافة سياق أو كود</span>
              {pastedContext ? <span className="ai-chat-context-status">مرفق</span> : null}
            </button>
            {pastedContext ? (
              <button
                type="button"
                className="ai-chat-context-remove"
                aria-label="إزالة السياق المرفق"
                onClick={() => {
                  setPastedContext('')
                  setContextDraft('')
                }}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
          {contextEditorOpen ? (
            <div id="ai-chat-context-panel" className="ai-chat-context-panel">
              <label htmlFor="ai-chat-context-input">الصق السياق أو الكود الذي تريد إرساله</label>
              <textarea
                id="ai-chat-context-input"
                rows={4}
                maxLength={20000}
                value={contextDraft}
                onChange={(event) => setContextDraft(event.target.value)}
                placeholder="الصق الكود أو النص هنا..."
              />
              <div className="ai-chat-context-actions">
                <button type="button" className="ai-chat-context-cancel" onClick={() => setContextEditorOpen(false)}>
                  إلغاء
                </button>
                <button type="button" className="ai-chat-context-save" onClick={saveContext}>
                  حفظ السياق
                </button>
              </div>
            </div>
          ) : null}
          {selectedSource ? (
            <div className="ai-chat-selected-source">
              <span><FileText size={15} /> مصدر مرفق: {selectedSource.title}</span>
              <button type="button" aria-label="إزالة المصدر المرفق" onClick={() => setSelectedSource(null)}>
                <X size={16} />
              </button>
            </div>
          ) : null}
          <form className="ai-chat-form" onSubmit={handleSubmit}>
            <div className="ai-chat-input-shell">
              <button
                type="button"
                className="ai-chat-source-trigger"
                aria-label="إرفاق مصدر من مساحتي"
                title="إرفاق مصدر"
                onClick={openSources}
              >
                <Paperclip size={18} />
              </button>
              <textarea
                aria-label="اكتب رسالتك"
                rows={1}
                maxLength={8000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="اكتب رسالتك..."
                disabled={isLoading}
              />
              <button
                type="submit"
                className="ai-chat-send"
                aria-label="إرسال الرسالة"
                disabled={!draft.trim() || isLoading}
              >
                <Send size={17} />
                <span>إرسال</span>
              </button>
            </div>
          </form>
          <p className="ai-chat-privacy-note">يُرسل السؤال والسياق والمصدر المرفق فقط إلى المساعد.</p>
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
