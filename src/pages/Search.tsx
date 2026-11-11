import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, Layers, Mic, Search } from 'lucide-react'
import { useStore } from '../store'
import { BackBtn, Empty, Segment, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'
import { excerpt } from '../utils'
import type { EntityType } from '../types'

export default function SearchPage() {
  const tr = useT()
  const nav = useNavigate()
  const { search } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | EntityType>('all')
  const hits = useMemo(() => {
    const all = search(q)
    if (filter === 'all') return all
    return all.filter((h) => h.type === filter)
  }, [q, filter, search])

  const icon = (type: EntityType) => {
    if (type === 'recording') return <Mic size={16} />
    if (type === 'note' || type === 'notebook') return <BookOpen size={16} />
    if (type === 'task') return <CheckSquare size={16} />
    return <Layers size={16} />
  }

  const to = (type: EntityType, id: string) => {
    if (type === 'recording') return `/record/${id}`
    if (type === 'note') return `/notes/${id}`
    if (type === 'task') return `/tasks/${id}`
    if (type === 'deck' || type === 'card') return type === 'deck' ? `/cards/${id}` : '/cards'
    return '/'
  }

  return (
    <PageLayout icon={Search}>
    <div className="stack">
      <div className="inner-head">
        <h1 className="page-title text-2xl font-bold text-foreground" style={{ margin: 0 }}>{tr('search')}</h1>
        <BackBtn onClick={() => nav('/')} />
      </div>
      <input className="field" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('searchPlaceholder')} />
      <Segment
        value={filter}
        onChange={(v) => setFilter(v as typeof filter)}
        options={[
          { id: 'all', label: tr('all') },
          { id: 'recording', label: tr('recorder') },
          { id: 'note', label: tr('notebook') },
          { id: 'task', label: tr('tasks') },
          { id: 'card', label: tr('flashcards') },
        ]}
      />
      {!q.trim() ? (
        <Empty icon={<Search size={36} />} title={tr('search')} hint={tr('searchPlaceholder')} />
      ) : hits.length === 0 ? (
        <Empty icon={<Search size={36} />} title={tr('noResults')} />
      ) : (
        hits.map((h) => (
          <Link key={`${h.type}-${h.id}`} className="list-item" to={to(h.type, h.id)}>
            {icon(h.type)}
            <div className="grow">
              <div className="ellipsis">{h.title}</div>
              <div className="meta ellipsis">{excerpt(h.snippet)}</div>
            </div>
          </Link>
        ))
      )}
    </div>
    </PageLayout>
  )
}
