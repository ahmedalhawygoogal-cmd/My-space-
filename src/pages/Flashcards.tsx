import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, Ear, Layers, LayoutGrid, Pencil, PenLine, Play, Plus, RefreshCw, Trash2, Volume2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, Toast, useT } from '../ui'
import type { ReactNode } from 'react'
import type { AppSettings, Card, Deck, DeckType, Lang } from '../types'
import { DECK_TYPES, LEARN_LANGS, NATIVE_LANG_OPTS, TARGET_LANG_OPTS, isRichDeck, labeled } from '../types'
import { fileToDataUrl, normalizeAnswer, shuffle, speakText } from '../utils'

function langLabel(code: string, ui: Lang, custom?: string) {
  if (!code) return ''
  if (code === 'other') return custom?.trim() || labeled(ui, { ar: 'أخرى', en: 'Other', fr: 'Autre', de: 'Andere', es: 'Otro' })
  const native = NATIVE_LANG_OPTS.find((l) => l.code === code)
  if (native) return labeled(ui, native)
  const target = TARGET_LANG_OPTS.find((l) => l.code === code)
  if (target) return labeled(ui, target)
  const row = LEARN_LANGS.find((l) => l.code === code)
  if (!row) return custom?.trim() || code
  return labeled(ui, row)
}

function nativeName(settings: AppSettings, ui: Lang) {
  const code = settings.nativeLang
  if (!code) return ''
  return langLabel(code, ui, settings.nativeLangOther)
}

function targetName(settings: AppSettings, ui: Lang, deck?: Deck) {
  const code = deck?.targetLang || settings.targetLangs?.[0] || ''
  if (!code) return ''
  const custom = code === 'other' ? settings.targetLangOther : undefined
  return langLabel(code, ui, custom)
}

function typeLabel(type: DeckType, tr: (k: 'typeVocabulary' | 'typePhrases' | 'typeSynonyms' | 'typeDefinitions' | 'typeAntonyms') => string) {
  if (type === 'phrases') return tr('typePhrases')
  if (type === 'synonyms') return tr('typeSynonyms')
  if (type === 'definitions') return tr('typeDefinitions')
  if (type === 'antonyms') return tr('typeAntonyms')
  return tr('typeVocabulary')
}

function cardImage(card: Pick<Card, 'imageBlob' | 'imageDataUrl'>) {
  return card.imageBlob || card.imageDataUrl
}

function ListenAuto({ text, lang, repeats, round }: { text: string; lang: string; repeats: number; round: number }) {
  useEffect(() => {
    if (!text.trim()) return
    speakText(text, lang, repeats)
  }, [text, lang, repeats, round])
  return null
}

function promptOf(card: Card, swapped: boolean) {
  return swapped ? card.back : card.front
}

function answerOf(card: Card, swapped: boolean) {
  return swapped ? card.front : card.back
}

function promptLangCode(deck: Deck | undefined, swapped: boolean) {
  return swapped ? deck?.targetLang || 'en' : deck?.nativeLang || 'ar'
}

function speakTarget(card: Card, deck?: Deck, repeats = 1) {
  speakText(card.back, deck?.targetLang || 'en', repeats)
}

function useQuestionTimer(running: boolean, token: number, onTimeout: () => void) {
  const cb = useRef(onTimeout)
  cb.current = onTimeout
  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => cb.current(), 5000)
    return () => window.clearTimeout(id)
  }, [running, token])
}

function TimerBar({ show, token }: { show: boolean; token: number }) {
  if (!show) return null
  return (
    <div className="fc-timer" key={token}>
      <span />
    </div>
  )
}

type CardFormState = {
  front: string
  back: string
  example: string
  note: string
  imageBlob: string
}

const emptyForm: CardFormState = { front: '', back: '', example: '', note: '', imageBlob: '' }

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="stack">
      <h1 className="page-title" style={{ margin: 0, fontSize: '1.2rem' }}>
        {title}
      </h1>
      {children}
    </div>
  )
}

function CardForm({
  form,
  setForm,
  rich,
  frontLabel,
  backLabel,
}: {
  form: CardFormState
  setForm: (f: CardFormState) => void
  rich: boolean
  frontLabel: string
  backLabel: string
}) {
  const tr = useT()
  return (
    <div className="stack">
      <label className="label">{frontLabel}</label>
      <input className="field" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} />
      <label className="label">{backLabel}</label>
      <input className="field" value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} />
      {rich ? (
        <>
          <label className="label">
            {tr('exampleSentence')} · {tr('optional')}
          </label>
          <input className="field" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
        </>
      ) : null}
      <label className="label">
        {tr('cardNote')} · {tr('optional')}
      </label>
      <input className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      {rich ? (
        <>
          <label className="label">
            {tr('image')} · {tr('optional')}
          </label>
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setForm({ ...form, imageBlob: await fileToDataUrl(f) })
            }}
          />
          {form.imageBlob ? (
            <>
              <img src={form.imageBlob} alt="" className="fc-thumb" />
              <button className="btn ghost" type="button" onClick={() => setForm({ ...form, imageBlob: '' })}>
                {tr('removeImage')}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

const SKIP_EARLY_KEY = 'myspace-skip-early-review'

function dueCount(list: Card[]) {
  const t = Date.now()
  return list.filter((c) => (c.nextReviewDate || c.dueAt) <= t).length
}

function deckSwapped(deck?: Deck) {
  return !!deck?.swapped
}

function PlayRing({ due, total, onClick, label }: { due: number; total: number; onClick: () => void; label: string }) {
  const r = 18
  const c = 2 * Math.PI * r
  const v = total ? Math.max(0, Math.min(100, ((total - due) / total) * 100)) : 0
  return (
    <button className="fc-play" type="button" onClick={onClick} aria-label={label}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="fc-play-icon">
        <Play size={16} fill="currentColor" />
      </span>
      {due > 0 ? <span className="fc-play-dot" /> : null}
    </button>
  )
}

function SessionDone({ deckId }: { deckId: string }) {
  const tr = useT()
  const nav = useNavigate()
  return (
    <div className="stack">
      <div className="card game-done">
        <h2>{tr('sessionSuccess')}</h2>
        <button className="btn block" type="button" onClick={() => nav(`/cards/${deckId}`)}>
          {tr('backToDeck')}
        </button>
      </div>
    </div>
  )
}

function EarlyReviewDialog({
  open,
  onClose,
  onContinue,
}: {
  open: boolean
  onClose: () => void
  onContinue: (dontShow: boolean) => void
}) {
  const tr = useT()
  const [dontShow, setDontShow] = useState(false)
  useEffect(() => {
    if (open) setDontShow(false)
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{tr('review')}</h3>
        <p className="muted">{tr('earlyReviewWarn')}</p>
        <label className="check-row">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          {tr('dontShowAgain')}
        </label>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" type="button" onClick={onClose}>
            {tr('cancel')}
          </button>
          <button className="btn" type="button" onClick={() => onContinue(dontShow)}>
            {tr('continueReview')}
          </button>
        </div>
      </div>
    </div>
  )
}

function GamesSheet({ deck, open, onClose }: { deck: Deck | null; open: boolean; onClose: () => void }) {
  const tr = useT()
  const nav = useNavigate()
  if (!deck) return null
  const go = (path: string) => {
    onClose()
    nav(path)
  }
  return (
    <Sheet open={open} onClose={onClose} title={tr('games')}>
      <div className="stack">
        <button className="list-item pressable" type="button" onClick={() => go(`/cards/${deck.id}/study`)}>
          <RefreshCw size={16} />
          <div className="grow">{tr('review')}</div>
        </button>
        <button className="list-item pressable" type="button" onClick={() => go(`/cards/${deck.id}/game/choice`)}>
          <LayoutGrid size={16} />
          <div className="grow">{tr('gameChoice')}</div>
        </button>
        <button className="list-item pressable" type="button" onClick={() => go(`/cards/${deck.id}/game/match`)}>
          <Layers size={16} />
          <div className="grow">{tr('gameMatch')}</div>
        </button>
        <button className="list-item pressable" type="button" onClick={() => go(`/cards/${deck.id}/game/write`)}>
          <PenLine size={16} />
          <div className="grow">{tr('gameWrite')}</div>
        </button>
        <button className="list-item pressable" type="button" onClick={() => go(`/cards/${deck.id}/game/listen`)}>
          <Ear size={16} />
          <div className="grow">{tr('gameListen')}</div>
        </button>
      </div>
    </Sheet>
  )
}

export default function FlashcardsPage() {
  const tr = useT()
  const nav = useNavigate()
  const { decks, cards, addDeck, settings } = useStore()
  const [open, setOpen] = useState(false)
  const [games, setGames] = useState<Deck | null>(null)
  const [early, setEarly] = useState<Deck | null>(null)
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<DeckType>('vocab')

  function tryPlay(d: Deck) {
    const list = cards.filter((c) => c.deckId === d.id)
    if (list.length > 0 && dueCount(list) === 0 && localStorage.getItem(SKIP_EARLY_KEY) !== '1') {
      setEarly(d)
      return
    }
    setGames(d)
  }

  const shown = decks.filter((d) => !q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="stack">
      <h1 className="page-title">{tr('flashcards')}</h1>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('searchPlaceholder')} />
      {shown.length === 0 ? (
        <Empty
          icon={<Layers size={36} />}
          title={tr('noDecks')}
          hint={tr('noCardsHint')}
          action={
            <button className="btn" type="button" onClick={() => setOpen(true)}>
              {tr('createDeck')}
            </button>
          }
        />
      ) : (
        shown.map((d) => {
          const dc = cards.filter((c) => c.deckId === d.id)
          const due = dc.filter((c) => (c.nextReviewDate || c.dueAt) <= Date.now()).length
          return (
            <div key={d.id} className="card fc-deck">
              <button className="fc-deck-body" type="button" onClick={() => nav(`/cards/${d.id}`)}>
                <div>
                  <div className="ellipsis" style={{ fontWeight: 700 }}>{d.name}</div>
                  <div className="meta" style={{ marginTop: 6 }}>
                    <span className="fc-badge">{typeLabel(d.type || 'vocab', tr)}</span>
                    {dc.length} {tr('cards')}
                  </div>
                </div>
              </button>
              <PlayRing due={due} total={dc.length} label={tr('playDeck')} onClick={() => tryPlay(d)} />
            </div>
          )
        })
      )}
      <button className="fab" type="button" onClick={() => setOpen(true)} aria-label={tr('newDeck')}>
        <Plus size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newDeck')}>
        <label className="label">{tr('deckType')}</label>
        <select className="field" value={type} onChange={(e) => setType(e.target.value as DeckType)}>
          {DECK_TYPES.map((id) => (
            <option key={id} value={id}>
              {typeLabel(id, tr)}
            </option>
          ))}
        </select>
        <label className="label">{tr('deckName')}</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!name.trim()) return
            await addDeck(name.trim(), {
              type,
              nativeLang: settings.nativeLang || 'ar',
              targetLang: settings.targetLangs?.[0] || 'en',
            })
            setName('')
            setOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
      <GamesSheet deck={games} open={!!games} onClose={() => setGames(null)} />
      <EarlyReviewDialog
        open={!!early}
        onClose={() => setEarly(null)}
        onContinue={(dontShow) => {
          if (dontShow) localStorage.setItem(SKIP_EARLY_KEY, '1')
          const d = early
          setEarly(null)
          if (d) setGames(d)
        }}
      />
    </div>
  )
}

export function DeckPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deckId } = useParams()
  const { decks, cards, deleteDeck, addCard, updateCard, deleteCard, updateDeck, lang, settings } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const dc = cards.filter((c) => c.deckId === deckId)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Card | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [form, setForm] = useState<CardFormState>(emptyForm)
  const swapped = deckSwapped(deck)
  const rich = isRichDeck(deck?.type)
  const frontFromLang = nativeName(settings, lang)
  const backFromLang = targetName(settings, lang, deck)
  const frontLabel = frontFromLang || tr('frontFace')
  const backLabel = backFromLang || tr('backFace')

  function payload(src: CardFormState) {
    const image = rich ? src.imageBlob || undefined : undefined
    return {
      front: src.front.trim(),
      back: src.back.trim(),
      example: rich ? src.example : '',
      note: src.note,
      imageBlob: image,
      imageDataUrl: image,
    }
  }

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />

  if (open || edit) {
    return (
      <Screen title={edit ? tr('editCard') : tr('addCardBtn')}>
        <CardForm form={form} setForm={setForm} rich={rich} frontLabel={frontLabel} backLabel={backLabel} />
        <button
          className="btn block"
          type="button"
          onClick={async () => {
            if (!form.front.trim() || !form.back.trim()) return
            if (edit) await updateCard(edit.id, payload(form))
            else await addCard(deck.id, payload(form))
            setForm(emptyForm)
            setOpen(false)
            setEdit(null)
          }}
        >
          {tr('save')}
        </button>
      </Screen>
    )
  }

  return (
    <div className="stack">
      <h1 className="page-title" style={{ margin: 0, fontSize: '1.2rem' }}>
        {deck.name}
      </h1>
      <button
        className="btn ghost fc-dir"
        type="button"
        aria-label={tr('swapSides')}
        onClick={() => void updateDeck(deck.id, { swapped: !swapped })}
      >
        <ArrowLeftRight size={16} />
        <span>{swapped ? backLabel : frontLabel}</span>
        <ArrowLeftRight size={14} />
        <span>{swapped ? frontLabel : backLabel}</span>
      </button>
      <button
        className="btn"
        type="button"
        onClick={() => {
          setForm(emptyForm)
          setOpen(true)
        }}
      >
        <Plus size={16} /> {tr('addCardBtn')}
      </button>
      {dc.length === 0 ? (
        <Empty icon={<Layers size={32} />} title={tr('emptyDeck')} hint={tr('emptyDeckHint')} />
      ) : (
        dc.map((c) => (
          <div key={c.id} className="list-item">
            {cardImage(c) ? <img src={cardImage(c)} alt="" className="fc-mini" /> : <div className="dot" style={{ background: 'var(--brand)' }} />}
            <div className="grow">
              <div className="ellipsis">{c.front}</div>
              <div className="meta ellipsis">{c.back}</div>
            </div>
            <button
              className="icon-btn"
              type="button"
              onClick={() => {
                setEdit(c)
                setForm({
                  front: c.front,
                  back: c.back,
                  example: c.example ?? '',
                  note: c.note ?? '',
                  imageBlob: cardImage(c) ?? '',
                })
              }}
              aria-label={tr('edit')}
            >
              <Pencil size={16} />
            </button>
            <button className="icon-btn" type="button" onClick={() => void deleteCard(c.id)} aria-label={tr('delete')}>
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
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
    </div>
  )
}

function NeedCards({ n, deckId }: { n: number; deckId: string }) {
  const tr = useT()
  const nav = useNavigate()
  return (
    <Empty
      icon={<Layers size={36} />}
      title={tr('needMoreCards')}
      hint={tr('needCardsForGame', { n })}
      action={
        <button className="btn" type="button" onClick={() => nav(`/cards/${deckId}`)}>
          {tr('addFlashcard')}
        </button>
      }
    />
  )
}

function GameShell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="stack">
      <h1 className="page-title" style={{ margin: 0, fontSize: '1.15rem' }}>
        {title}
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {hint}
      </p>
      {children}
    </div>
  )
}

function HintImage({ src }: { src?: string }) {
  if (!src) return null
  return <img src={src} alt="" className="fc-hint" />
}

function useDeckCards() {
  const { deckId } = useParams()
  const { decks, cards } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const dc = cards.filter((c) => c.deckId === deckId && c.front.trim() && c.back.trim())
  return { deckId: deckId ?? '', deck, dc }
}

export function ChoiceGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer } = useStore()
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [answered, setAnswered] = useState(0)
  const [finished, setFinished] = useState(false)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const total = dc.length
  const swapped = deckSwapped(deck)
  const pack = useMemo(() => {
    const { deck: d, dc: list, pickCards: pick } = live.current
    if (!d || list.length < 4) return null
    const [target] = pick(d.id, 1)
    if (!target) return null
    const others = shuffle(list.filter((c) => c.id !== target.id)).slice(0, 3)
    return { target, options: shuffle([target, ...others]) }
  }, [round, deckId])
  const locked = !!picked || timedOut
  const done = useRef(false)

  async function settle(ok: boolean, pickId: string | null) {
    if (!pack || done.current) return
    done.current = true
    setPicked(pickId)
    setTimedOut(!ok && !pickId)
    speakTarget(pack.target, deck)
    await recordAnswer(pack.target.id, ok)
    setAnswered((n) => n + 1)
  }

  useQuestionTimer(!locked && !!pack, round, () => {
    void settle(false, null)
  })

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 4 || !pack) return <NeedCards n={4} deckId={deckId} />
  if (finished) return <SessionDone deckId={deckId} />

  return (
    <GameShell title={tr('gameChoice')} hint={tr('gameChoiceHint')}>
      <TimerBar show={!locked} token={round} />
      <div className="flash-card">
        <HintImage src={cardImage(pack.target)} />
        <h2>{promptOf(pack.target, swapped)}</h2>
      </div>
      <div className="stack">
        {pack.options.map((o) => {
          const cls = locked ? (o.id === pack.target.id ? 'choice ok' : o.id === picked ? 'choice bad' : 'choice') : 'choice'
          return (
            <button
              key={o.id}
              className={cls}
              type="button"
              disabled={locked}
              onClick={() => void settle(o.id === pack.target.id, o.id)}
            >
              {cardImage(o) ? <img src={cardImage(o)} alt="" className="fc-opt" /> : null}
              {answerOf(o, swapped)}
            </button>
          )
        })}
      </div>
      {locked ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            if (answered >= total) {
              setFinished(true)
              return
            }
            done.current = false
            setPicked(null)
            setTimedOut(false)
            setRound((n) => n + 1)
          }}
        >
          {answered >= total ? tr('finish') : tr('next')}
        </button>
      ) : null}
    </GameShell>
  )
}

export function MatchGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer } = useStore()
  const [round, setRound] = useState(0)
  const [finished, setFinished] = useState(false)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const swapped = deckSwapped(deck)
  const pack = useMemo(() => {
    const { deck: d, pickCards: pick } = live.current
    if (!d || live.current.dc.length < 4) return []
    return pick(d.id, 4)
  }, [round, deckId])
  const left = useMemo(() => shuffle(pack), [pack])
  const right = useMemo(() => shuffle(pack), [pack])
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const totalRounds = Math.max(1, Math.ceil(dc.length / 4))

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 4) return <NeedCards n={4} deckId={deckId} />
  if (finished) return <SessionDone deckId={deckId} />

  async function tryMatch(l: string | null, r: string | null) {
    if (!l || !r || busy) return
    setBusy(true)
    const ok = l === r
    const card = pack.find((c) => c.id === l)
    if (card) speakTarget(card, deck)
    await recordAnswer(l, ok)
    if (ok) setDone((d) => [...d, l])
    setSelL(null)
    setSelR(null)
    setBusy(false)
  }

  return (
    <GameShell title={tr('gameMatch')} hint={tr('gameMatchHint')}>
      <div className="match-grid">
        <div className="match-col">
          {left.map((c) => (
            <button
              key={`l-${c.id}`}
              className={`match-item ${selL === c.id ? 'sel' : ''} ${done.includes(c.id) ? 'done' : ''}`}
              type="button"
              disabled={done.includes(c.id)}
              onClick={() => {
                setSelL(c.id)
                void tryMatch(c.id, selR)
              }}
            >
              {cardImage(c) ? <img src={cardImage(c)} alt="" className="fc-opt" /> : null}
              {promptOf(c, swapped)}
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((c) => (
            <button
              key={`r-${c.id}`}
              className={`match-item ${selR === c.id ? 'sel' : ''} ${done.includes(c.id) ? 'done' : ''}`}
              type="button"
              disabled={done.includes(c.id)}
              onClick={() => {
                setSelR(c.id)
                void tryMatch(selL, c.id)
              }}
            >
              {answerOf(c, swapped)}
            </button>
          ))}
        </div>
      </div>
      {done.length === pack.length && pack.length > 0 ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            if (round + 1 >= totalRounds) {
              setFinished(true)
              return
            }
            setDone([])
            setRound((n) => n + 1)
          }}
        >
          {round + 1 >= totalRounds ? tr('finish') : tr('next')}
        </button>
      ) : null}
    </GameShell>
  )
}

export function WriteGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer } = useStore()
  const [round, setRound] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'ok' | 'bad' | null>(null)
  const [answered, setAnswered] = useState(0)
  const [finished, setFinished] = useState(false)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const total = dc.length
  const swapped = deckSwapped(deck)
  const card = useMemo(() => {
    const { deck: d, pickCards: pick } = live.current
    return d && live.current.dc.length ? pick(d.id, 1)[0] : undefined
  }, [round, deckId])
  const expected = card ? answerOf(card, swapped) : ''

  async function grade() {
    if (!card || !deck || result) return
    const ok = normalizeAnswer(value) === normalizeAnswer(expected)
    setResult(ok ? 'ok' : 'bad')
    speakTarget(card, deck)
    await recordAnswer(card.id, ok)
    setAnswered((n) => n + 1)
  }

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 1 || !card) return <NeedCards n={1} deckId={deckId} />
  if (finished) return <SessionDone deckId={deckId} />

  return (
    <GameShell title={tr('gameWrite')} hint={tr('gameWriteHint')}>
      <div className="flash-card">
        <HintImage src={cardImage(card)} />
        <h2>{promptOf(card, swapped)}</h2>
      </div>
      <input
        className="field"
        value={value}
        placeholder={tr('typeAnswer')}
        disabled={!!result}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !result) {
            e.preventDefault()
            void grade()
          }
        }}
      />
      {!result ? (
        <button className="btn block" type="button" onClick={() => void grade()}>
          {tr('check')}
        </button>
      ) : (
        <>
          <div className={result === 'ok' ? 'choice ok' : 'choice bad'}>{result === 'ok' ? tr('correct') : `${tr('wrong')}: ${expected}`}</div>
          <button
            className="btn block"
            type="button"
            onClick={() => {
              if (answered >= total) {
                setFinished(true)
                return
              }
              setValue('')
              setResult(null)
              setRound((n) => n + 1)
            }}
          >
            {answered >= total ? tr('finish') : tr('next')}
          </button>
        </>
      )}
    </GameShell>
  )
}

export function ListenGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer, settings } = useStore()
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [answered, setAnswered] = useState(0)
  const [finished, setFinished] = useState(false)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const total = dc.length
  const swapped = deckSwapped(deck)
  const pack = useMemo(() => {
    const { deck: d, dc: list, pickCards: pick } = live.current
    if (!d || list.length < 4) return null
    const [target] = pick(d.id, 1)
    if (!target) return null
    const others = shuffle(list.filter((c) => c.id !== target.id)).slice(0, 3)
    return { target, options: shuffle([target, ...others]) }
  }, [round, deckId])
  const locked = !!picked || timedOut
  const done = useRef(false)
  const repeats = settings.speakRepeats ?? 1
  const promptLang = promptLangCode(deck, swapped)
  const promptText = pack ? promptOf(pack.target, swapped) : ''

  async function settle(ok: boolean, pickId: string | null) {
    if (!pack || done.current) return
    done.current = true
    setPicked(pickId)
    setTimedOut(!ok && !pickId)
    speakTarget(pack.target, deck, repeats)
    await recordAnswer(pack.target.id, ok)
    setAnswered((n) => n + 1)
  }

  useQuestionTimer(!locked && !!pack, round, () => {
    void settle(false, null)
  })

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 4 || !pack) return <NeedCards n={4} deckId={deckId} />
  if (finished) return <SessionDone deckId={deckId} />

  return (
    <GameShell title={tr('gameListen')} hint={tr('gameListenHint')}>
      <TimerBar show={!locked} token={round} />
      <ListenAuto text={promptText} lang={promptLang} repeats={repeats} round={round} />
      <div className="flash-card">
        <button
          className="btn"
          type="button"
          onClick={() => speakText(promptText, promptLang, repeats)}
        >
          <Volume2 size={18} /> {tr('speak')}
        </button>
        {typeof window === 'undefined' || !('speechSynthesis' in window) ? <div className="muted">{tr('noSpeech')}</div> : null}
      </div>
      <div className="stack">
        {pack.options.map((o) => {
          const cls = locked ? (o.id === pack.target.id ? 'choice ok' : o.id === picked ? 'choice bad' : 'choice') : 'choice'
          return (
            <button
              key={o.id}
              className={cls}
              type="button"
              disabled={locked}
              onClick={() => void settle(o.id === pack.target.id, o.id)}
            >
              {answerOf(o, swapped)}
            </button>
          )
        })}
      </div>
      {locked ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            if (answered >= total) {
              setFinished(true)
              return
            }
            done.current = false
            setPicked(null)
            setTimedOut(false)
            setRound((n) => n + 1)
          }}
        >
          {answered >= total ? tr('finish') : tr('next')}
        </button>
      ) : null}
    </GameShell>
  )
}

export function StudyPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deck, dc, deckId } = useDeckCards()
  const { rateCard, cards } = useStore()
  const [ids] = useState(() => {
    const due = dc.filter((c) => (c.nextReviewDate || c.dueAt) <= Date.now()).sort((a, b) => (a.nextReviewDate || a.dueAt) - (b.nextReviewDate || b.dueAt))
    return (due.length ? due : dc).map((c) => c.id)
  })
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [autoForgot, setAutoForgot] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const ratedRef = useRef(false)
  const swapped = deckSwapped(deck)
  const card = cards.find((c) => c.id === ids[idx])
  const cardRef = useRef(card)
  cardRef.current = card

  async function markForgot(target = cardRef.current) {
    if (!target || ratedRef.current) return
    ratedRef.current = true
    await rateCard(target.id, 'again')
  }

  async function markRecalled(target = cardRef.current) {
    if (!target || ratedRef.current) return
    ratedRef.current = true
    await rateCard(target.id, 'good')
  }

  useQuestionTimer(!!card && !flipped, idx, () => {
    setFlipped(true)
    setAutoForgot(true)
    void markForgot()
    setToast(tr('forgot'))
    if (cardRef.current) speakTarget(cardRef.current, deck)
  })

  function goNext() {
    setFlipped(false)
    setAutoForgot(false)
    ratedRef.current = false
    setIdx((n) => n + 1)
  }

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (!card) {
    if (idx > 0) return <SessionDone deckId={deckId} />
    return (
      <Empty
        icon={<Layers size={36} />}
        title={tr('noDueCards')}
        action={
          <button className="btn" type="button" onClick={() => nav(`/cards/${deckId}`)}>
            {tr('backToDeck')}
          </button>
        }
      />
    )
  }

  const prompt = promptOf(card, swapped)
  const answer = answerOf(card, swapped)

  return (
    <div className="stack">
      <h1 className="page-title" style={{ margin: 0, fontSize: '1.15rem' }}>
        {tr('review')}
      </h1>
      <div className="muted">
        {Math.max(0, ids.length - idx)} {tr('remaining')}
      </div>
      <TimerBar show={!flipped} token={idx} />
      <div className="flash-card fc-review">
        {!flipped && cardImage(card) ? <img src={cardImage(card)} alt="" className="fc-hint" /> : null}
        <h2>{flipped ? answer : prompt}</h2>
        {flipped && card.example ? <p className="muted">{card.example}</p> : null}
        {flipped && card.note ? <p className="muted">{card.note}</p> : null}
      </div>
      {!flipped ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            setFlipped(true)
            setAutoForgot(false)
          }}
        >
          {tr('flipCard')}
        </button>
      ) : autoForgot ? (
        <button className="btn block" type="button" onClick={goNext}>
          {tr('next')}
        </button>
      ) : (
        <div className="fc-rate">
          <button
            className="btn forgot"
            type="button"
            onClick={async () => {
              await markForgot()
              speakTarget(card, deck)
              setToast(tr('forgot'))
              goNext()
            }}
          >
            {tr('forgot')}
          </button>
          <button
            className="btn recalled"
            type="button"
            onClick={async () => {
              await markRecalled()
              speakTarget(card, deck)
              setToast(tr('recalled'))
              goNext()
            }}
          >
            {tr('recalled')}
          </button>
        </div>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}

export function TestPage() {
  const { deckId } = useParams()
  const nav = useNavigate()
  useEffect(() => {
    if (deckId) nav(`/cards/${deckId}/game/write`, { replace: true })
  }, [deckId, nav])
  return null
}
