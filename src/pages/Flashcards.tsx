import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, Layers, Plus, Shuffle, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, SubjectSelect, useT } from '../ui'
import type { Card, CardRating } from '../types'
import { fileToDataUrl } from '../utils'

export default function FlashcardsPage() {
  const tr = useT()
  const { decks, cards, subjects, addDeck } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [subjectId, setSubjectId] = useState<string | undefined>()
  const due = cards.filter((c) => c.dueAt <= Date.now())
  const streak = (() => {
    try {
      const raw = localStorage.getItem('myspace-streak')
      return raw ? (JSON.parse(raw) as { days: number }).days : 0
    } catch {
      return 0
    }
  })()

  return (
    <div className="stack">
      <h1 className="page-title">{tr('flashcards')}</h1>
      <div className="grid-2">
        <div className="card">
          <div className="muted">{tr('due')}</div>
          <b style={{ fontSize: 22 }}>{due.length}</b>
        </div>
        <div className="card">
          <div className="muted">{tr('streak')}</div>
          <b style={{ fontSize: 22 }}>
            {streak} {tr('days')}
          </b>
        </div>
      </div>
      {decks.length === 0 ? (
        <Empty icon={<Layers size={36} />} title={tr('noDecks')} hint={tr('noCardsHint')} />
      ) : (
        decks.map((d) => {
          const dc = cards.filter((c) => c.deckId === d.id)
          const dueN = dc.filter((c) => c.dueAt <= Date.now()).length
          const learned = dc.filter((c) => c.status === 'learned').length
          const sub = subjects.find((s) => s.id === d.subjectId)
          return (
            <Link key={d.id} className="list-item pressable" to={`/cards/${d.id}`}>
              <div className="dot" style={{ background: sub?.color ?? 'var(--brand)' }} />
              <div className="grow">
                <div className="ellipsis">{d.name}</div>
                <div className="meta">
                  {dc.length} {tr('cards')} · {dueN} {tr('due')} · {learned} {tr('learned')}
                </div>
              </div>
            </Link>
          )
        })
      )}
      <button className="fab" type="button" onClick={() => setOpen(true)} aria-label={tr('newDeck')}>
        <Plus size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newDeck')}>
        <label className="label">{tr('deckName')}</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">{tr('subject')}</label>
        <SubjectSelect value={subjectId} onChange={setSubjectId} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!name.trim()) return
            await addDeck(name.trim(), { subjectId })
            setName('')
            setOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
    </div>
  )
}

export function DeckPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deckId } = useParams()
  const { decks, cards, updateDeck, deleteDeck, addCard, deleteCard, duplicateCard } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const dc = cards.filter((c) => c.deckId === deckId)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [form, setForm] = useState({ front: '', back: '', translation: '', definition: '', example: '', explanation: '', imageDataUrl: '' })
  const shown = dc.filter((c) => {
    if (!q.trim()) return true
    const n = q.toLowerCase()
    return [c.front, c.back, c.translation, c.definition].some((x) => x.toLowerCase().includes(n))
  })
  const dueN = dc.filter((c) => c.dueAt <= Date.now()).length

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />

  return (
    <div className="stack">
      <input className="note-title" value={deck.name} onChange={(e) => void updateDeck(deck.id, { name: e.target.value })} />
      <textarea
        className="field textarea"
        value={deck.description}
        placeholder={tr('description')}
        onChange={(e) => void updateDeck(deck.id, { description: e.target.value })}
      />
      <div className="grid-2">
        <button className="btn" type="button" disabled={dueN === 0} onClick={() => nav(`/cards/${deck.id}/study`)}>
          {tr('study')} · {dueN}
        </button>
        <button className="btn secondary" type="button" disabled={dc.length === 0} onClick={() => nav(`/cards/${deck.id}/study?mode=random`)}>
          <Shuffle size={14} /> {tr('random')}
        </button>
        <button className="btn ghost" type="button" disabled={dc.length === 0} onClick={() => nav(`/cards/${deck.id}/test`)}>
          {tr('test')}
        </button>
        <button className="btn ghost" type="button" onClick={() => setOpen(true)}>
          {tr('newCard')}
        </button>
      </div>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('search')} />
      {shown.map((c) => (
        <div key={c.id} className="list-item">
          <div className="grow">
            <div className="ellipsis">{c.front}</div>
            <div className="meta ellipsis">{c.back}</div>
          </div>
          <button className="icon-btn" type="button" onClick={() => void duplicateCard(c.id)} aria-label={tr('duplicate')}>
            <Copy size={16} />
          </button>
          <button className="icon-btn" type="button" onClick={() => void deleteCard(c.id)} aria-label={tr('delete')}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
        {tr('delete')}
      </button>
      <Confirm
        open={confirm}
        title={tr('deleteDeckConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteDeck(deck.id)
          nav('/cards')
        }}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newCard')}>
        <CardForm form={form} setForm={setForm} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!form.front.trim() || !form.back.trim()) return
            await addCard(deck.id, form)
            setForm({ front: '', back: '', translation: '', definition: '', example: '', explanation: '', imageDataUrl: '' })
            setOpen(false)
          }}
        >
          {tr('save')}
        </button>
      </Sheet>
    </div>
  )
}

function CardForm({
  form,
  setForm,
}: {
  form: { front: string; back: string; translation: string; definition: string; example: string; explanation: string; imageDataUrl: string }
  setForm: (f: typeof form) => void
}) {
  const tr = useT()
  return (
    <div className="stack">
      <label className="label">{tr('front')}</label>
      <input className="field" value={form.front} placeholder={tr('frontHint')} onChange={(e) => setForm({ ...form, front: e.target.value })} />
      <label className="label">{tr('cardBack')}</label>
      <input className="field" value={form.back} placeholder={tr('backHint')} onChange={(e) => setForm({ ...form, back: e.target.value })} />
      <label className="label">{tr('translation')}</label>
      <input className="field" value={form.translation} onChange={(e) => setForm({ ...form, translation: e.target.value })} />
      <label className="label">{tr('definition')}</label>
      <input className="field" value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} />
      <label className="label">{tr('example')}</label>
      <input className="field" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
      <label className="label">{tr('explanation')}</label>
      <textarea className="field textarea" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
      <label className="label">{tr('image')}</label>
      <input
        className="field"
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          setForm({ ...form, imageDataUrl: await fileToDataUrl(f) })
        }}
      />
      {form.imageDataUrl ? <img src={form.imageDataUrl} alt="" style={{ borderRadius: 12, maxHeight: 140, objectFit: 'cover' }} /> : null}
    </div>
  )
}

export function StudyPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deckId } = useParams()
  const mode = new URLSearchParams(window.location.search).get('mode')
  const { cards, rateCard, decks } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const [queue] = useState(() => {
    let list = cards.filter((c) => c.deckId === deckId)
    if (mode !== 'random') list = list.filter((c) => c.dueAt <= Date.now())
    if (mode === 'random') list = [...list].sort(() => Math.random() - 0.5)
    return list
  })
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(0)
  const card: Card | undefined = queue[i]

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (!card) {
    return (
      <div className="stack">
        <h1 className="page-title">{tr('sessionDone')}</h1>
        <div className="card" style={{ textAlign: 'center' }}>
          <b style={{ fontSize: 28 }}>{done}</b>
          <div className="muted">{tr('reviewed')}</div>
        </div>
        <button className="btn block" type="button" onClick={() => nav(`/cards/${deckId}`)}>
          {tr('done')}
        </button>
      </div>
    )
  }

  async function rate(r: CardRating) {
    await rateCard(card!.id, r)
    setShow(false)
    setDone((d) => d + 1)
    setI((n) => n + 1)
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title" style={{ margin: 0 }}>
          {deck.name}
        </h1>
        <span className="badge">
          {i + 1} {tr('of')} {queue.length}
        </span>
      </div>
      <div className="flash-card" onClick={() => setShow(true)}>
        {card.imageDataUrl ? <img src={card.imageDataUrl} alt="" style={{ maxHeight: 120, margin: '0 auto', borderRadius: 12 }} /> : null}
        <h2>{card.front}</h2>
        {show ? (
          <>
            <p style={{ fontSize: 18, margin: 0 }}>{card.back}</p>
            {card.translation ? <div className="muted">{card.translation}</div> : null}
            {card.definition ? <div>{card.definition}</div> : null}
            {card.example ? <div className="muted">{card.example}</div> : null}
            {card.explanation ? <div>{card.explanation}</div> : null}
          </>
        ) : (
          <button className="btn secondary" type="button">
            {tr('showAnswer')}
          </button>
        )}
      </div>
      {show ? (
        <div className="rate-row">
          <button className="rate again" type="button" onClick={() => void rate('again')}>
            {tr('again')}
          </button>
          <button className="rate hard" type="button" onClick={() => void rate('hard')}>
            {tr('hard')}
          </button>
          <button className="rate good" type="button" onClick={() => void rate('good')}>
            {tr('good')}
          </button>
          <button className="rate easy" type="button" onClick={() => void rate('easy')}>
            {tr('easy')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function TestPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deckId } = useParams()
  const { cards, decks } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const list = useMemo(() => [...cards.filter((c) => c.deckId === deckId)].sort(() => Math.random() - 0.5), [cards, deckId])
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)
  const [ok, setOk] = useState(0)
  const [bad, setBad] = useState(0)
  const card = list[i]

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (!card) {
    const total = ok + bad
    return (
      <div className="stack">
        <h1 className="page-title">{tr('score')}</h1>
        <div className="card" style={{ textAlign: 'center' }}>
          <b style={{ fontSize: 32 }}>{total ? Math.round((ok / total) * 100) : 0}%</b>
          <div className="muted">
            {ok} {tr('correct')} · {bad} {tr('wrong')}
          </div>
        </div>
        <button className="btn block" type="button" onClick={() => nav(`/cards/${deckId}`)}>
          {tr('done')}
        </button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title" style={{ margin: 0 }}>
          {tr('test')}
        </h1>
        <span className="badge">
          {i + 1} / {list.length}
        </span>
      </div>
      <div className="flash-card">
        <h2>{card.front}</h2>
        {show ? <p style={{ fontSize: 18 }}>{card.back}</p> : (
          <button className="btn secondary" type="button" onClick={() => setShow(true)}>
            {tr('showAnswer')}
          </button>
        )}
      </div>
      {show ? (
        <div className="grid-2">
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              setBad((n) => n + 1)
              setShow(false)
              setI((n) => n + 1)
            }}
          >
            {tr('wrong')}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setOk((n) => n + 1)
              setShow(false)
              setI((n) => n + 1)
            }}
          >
            {tr('correct')}
          </button>
        </div>
      ) : null}
    </div>
  )
}


