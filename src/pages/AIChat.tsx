import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, CheckSquare, Code, FileText, LoaderCircle, Mic, Paperclip, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store'
import { CloseBtn, Sheet } from '../ui'
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
          <article key={message.id} className={`ai-chat-message ${message.role}`}>
            {message.role === 'assistant' ? (
              <span className="ai-chat-message-avatar" aria-hidden="true">
                <Bot size={16} />
              </span>
            ) : null}
            <div className="ai-chat-bubble">
              {message.sourceLabel ? <div className="ai-chat-source-label">مرفق: {message.sourceLabel}</div> : null}
              <p>{message.content}</p>
            </div>
          </article>
        ))}
        {isLoading ? (
          <div className="ai-chat-message assistant" role="status" aria-label="يفكر في إجابة واضحة">
            <span className="ai-chat-message-avatar" aria-hidden="true">
              <Bot size={16} />
            </span>
            <div className="ai-chat-bubble ai-chat-thinking">
              <span className="ai-chat-thinking-dots" aria-hidden="true">
                <span className="ai-chat-thinking-dot animate-bounce" style={{ animationDelay: '-0.24s' }} />
                <span className="ai-chat-thinking-dot animate-bounce" style={{ animationDelay: '-0.12s' }} />
                <span className="ai-chat-thinking-dot animate-bounce" style={{ animationDelay: '0s' }} />
              </span>
              <span>يفكر في إجابة واضحة...</span>
            </div>
          </div>
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
      content: 'أهلًا، أنا مساعد مساحتي. اسألني عن ملاحظاتك أو مهامك أو تسجيلاتك، ويمكنك إرفاق مصدر واحد لإضافة سياقه إلى سؤالك.',
    },
  ])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedContext, setAttachedContext] = useState('')
  const [contextDraft, setContextDraft] = useState('')
  const [contextEditorOpen, setContextEditorOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SourceKind>('notes')
  const [sources, setSources] = useState<SourcesByKind>(emptySources)
  const [sourceState, setSourceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [sourceError, setSourceError] = useState('')
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null)

  function openContextEditor() {
    setContextDraft(attachedContext)
    setContextEditorOpen(true)
  }

  function saveContext() {
    setAttachedContext(contextDraft.trim())
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
    const message = draft.trim()
    if (!message || isLoading) return

    const source = selectedSource
    const context = [source?.context, attachedContext.trim()]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20000)
    const sourceLabel = [source?.title, attachedContext.trim() ? 'Context' : undefined]
      .filter(Boolean)
      .join(' · ')
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: message, sourceLabel: sourceLabel || undefined },
    ])
    setDraft('')
    setSelectedSource(null)
    setIsLoading(true)

    try {
      if (!supabase) throw new Error('Supabase is not configured')
      const { data, error } = await supabase.functions.invoke('Gemini-chat', {
        body: { message, context },
      })
      if (error) throw error
      const response = typeof data?.response === 'string' ? data.response.trim() : ''
      if (!response) throw new Error('The assistant returned an empty response')
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response }])
    } catch (error) {
      console.error(error)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'تعذّر الحصول على رد الآن. تأكد من نشر دالة Gemini وإعداد مفتاحها في Supabase ثم حاول مجددًا.',
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
        <CloseBtn onClick={() => navigate('/')} />
        <div className="ai-chat-heading">
          <span className="ai-chat-heading-icon" aria-hidden="true">
            <Bot size={20} />
          </span>
          <div>
            <h1>مساعد مساحتي</h1>
            <span>مساعدك لتنظيم أفكارك</span>
          </div>
        </div>
        <span className="ai-chat-header-spacer" aria-hidden="true" />
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      <footer className="ai-chat-composer">
        <div className="ai-chat-composer-inner">
          {attachedContext ? (
            <div className="ai-chat-context-badge">
              <span><Code size={14} /> Context Attached</span>
              <button type="button" aria-label="إزالة السياق المرفق" onClick={() => setAttachedContext('')}>
                <X size={15} />
              </button>
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
            <button
              type="button"
              className="ai-chat-attach"
              aria-label="إرفاق مصدر"
              title="إرفاق مصدر"
              onClick={openSources}
            >
              <Paperclip size={19} />
              <span>إرفاق مصدر</span>
            </button>
            <button
              type="button"
              className={`ai-chat-context-trigger${attachedContext ? ' attached' : ''}`}
              aria-label="إدراج كود أو سياق"
              aria-pressed={Boolean(attachedContext)}
              title="إدراج كود أو سياق"
              onClick={openContextEditor}
            >
              <Code size={18} />
              <span>Context</span>
            </button>
            <textarea
              aria-label="اكتب رسالتك"
              rows={1}
              maxLength={8000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="اكتب سؤالك هنا..."
              disabled={isLoading}
            />
            <button
              type="submit"
              className="ai-chat-send"
              aria-label="إرسال الرسالة"
              disabled={!draft.trim() || isLoading}
            >
              <Send size={18} />
              <span>إرسال</span>
            </button>
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
      <Sheet
        open={contextEditorOpen}
        onClose={() => setContextEditorOpen(false)}
        title="إدراج كود أو سياق"
      >
        <div className="ai-context-sheet">
          <p>ألصق كوداً أو نصاً إضافياً ليُرسل مع رسالتك إلى المساعد.</p>
          <textarea
            aria-label="الكود أو السياق المرفق"
            rows={9}
            maxLength={20000}
            value={contextDraft}
            onChange={(event) => setContextDraft(event.target.value)}
            placeholder="الصق الكود أو النص هنا..."
          />
          <div className="ai-context-actions">
            <button type="button" className="ai-context-cancel" onClick={() => setContextEditorOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="ai-context-save" onClick={saveContext}>
              حفظ السياق
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
