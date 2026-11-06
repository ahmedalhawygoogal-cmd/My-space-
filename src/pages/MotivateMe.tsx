import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Sparkles, Star } from 'lucide-react'
import * as db from '../db'
import { STORES } from '../db'
import { useStore } from '../store'
import { uid } from '../utils'
import { RTL_LANGS, type QuoteCharacter } from '../types'
import { Empty, Sheet, Toast, useT } from '../ui'
import { DEFAULT_QUOTES } from '../data/defaultQuotes'

export default function MotivateMePage() {
  const tr = useT()
  const nav = useNavigate()
  const { lang } = useStore()
  const isRTL = RTL_LANGS.has(lang)

  const [characters, setCharacters] = useState<QuoteCharacter[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [detail, setDetail] = useState<QuoteCharacter | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const urlRef = useRef<Map<string, string>>(new Map())
  const [draft, setDraft] = useState<{
    name: string
    story: string
    challenge: string
    quote: string
    imageFile: File | null
    imageUrl: string | null
  }>({ name: '', story: '', challenge: '', quote: '', imageFile: null, imageUrl: null })

  const emptyDraft = () => ({
    name: '',
    story: '',
    challenge: '',
    quote: '',
    imageFile: null as File | null,
    imageUrl: null as string | null,
  })

  async function load() {
    try {
      const [custom, favs] = await Promise.all([
        db.getAll<QuoteCharacter>(STORES.customQuotes),
        db.getAll<{ id: string }>(STORES.favoriteQuoteIds),
      ])
      setCharacters([...DEFAULT_QUOTES, ...custom])
      setFavoriteIds(new Set(favs.map((f) => f.id)))
    } catch {
      setCharacters([...DEFAULT_QUOTES])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    return () => {
      urlRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlRef.current.clear()
      if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl)
    }
  }, [draft.imageUrl])

  function imageUrl(c: QuoteCharacter): string | null {
    if (!c.image) return null
    if (typeof c.image === 'string') return c.image
    let url = urlRef.current.get(c.id)
    if (!url) {
      url = URL.createObjectURL(c.image)
      urlRef.current.set(c.id, url)
    }
    return url
  }

  const filtered = favoritesOnly
    ? characters.filter((c) => favoriteIds.has(c.id))
    : characters

  async function toggleFavorite(c: QuoteCharacter) {
    if (favoriteIds.has(c.id)) {
      await db.deleteById(STORES.favoriteQuoteIds, c.id)
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.delete(c.id)
        return next
      })
      setToast(tr('unfavorited'))
    } else {
      await db.putOne(STORES.favoriteQuoteIds, { id: c.id })
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.add(c.id)
        return next
      })
      setToast(tr('favorited'))
    }
  }

  function surpriseMe() {
    const pool = favoritesOnly
      ? characters.filter((c) => favoriteIds.has(c.id))
      : characters
    if (!pool.length) {
      setToast(tr('noCharacters'))
      return
    }
    const pick = pool[Math.floor(Math.random() * pool.length)]
    setToast(`"${pick.quote}" — ${pick.name}`)
    setDetail(pick)
  }

  async function saveCharacter() {
    if (!draft.name.trim() || !draft.quote.trim()) return
    const char: QuoteCharacter = {
      id: uid(),
      name: draft.name.trim(),
      story: draft.story.trim(),
      challenge: draft.challenge.trim(),
      quote: draft.quote.trim(),
      image: draft.imageFile ?? undefined,
      createdAt: Date.now(),
    }
    try {
      await db.putOne(STORES.customQuotes, char)
      setCharacters((prev) => [...prev, char])
      if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl)
      setDraft(emptyDraft())
      setAddOpen(false)
      setToast(tr('saved'))
    } catch {
      setToast('فشل حفظ الشخصية')
    }
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="spread">
        <h1 className="page-title">{tr('motivateMe')}</h1>
        <button
          className="icon-btn"
          type="button"
          onClick={() => nav(-1)}
          aria-label={tr('back')}
          style={{ transform: isRTL ? 'scaleX(-1)' : undefined }}
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn accent" type="button" onClick={surpriseMe}>
          {tr('surpriseMe')}
        </button>
        <button
          className={`btn ${favoritesOnly ? 'accent' : 'secondary'}`}
          type="button"
          onClick={() => setFavoritesOnly(!favoritesOnly)}
        >
          {favoritesOnly ? tr('all') : tr('favorites')}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: 'var(--ink-soft)', textAlign: 'center' }}>جارٍ التحميل…</div>
      ) : filtered.length === 0 ? (
        <Empty
          icon={<Sparkles size={36} />}
          title={favoritesOnly ? 'لا توجد مفضلة بعد' : tr('noCharacters')}
          hint={
            favoritesOnly
              ? 'اضغط على نجمة أي شخصية لإضافتها للمفضلة.'
              : 'ابدأ بإضافة شخصية جديدة عبر الزر العائم.'
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              className="card pressable"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 210, cursor: 'pointer' }}
              onClick={() => setDetail(c)}
            >
              {c.image && (
                <img
                  src={imageUrl(c)!}
                  alt=""
                  style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, display: 'block' }}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <b style={{ fontSize: 15, overflowWrap: 'break-word' }}>{c.name}</b>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ padding: 2 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleFavorite(c)
                  }}
                  aria-label={favoriteIds.has(c.id) ? tr('unfavorited') : tr('favorites')}
                >
                  <Star size={16} style={{ color: favoriteIds.has(c.id) ? 'var(--gold)' : 'var(--ink-soft)' }} />
                </button>
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.4, overflowWrap: 'break-word' }}>
                "{c.quote.slice(0, 60)}{c.quote.length > 60 ? '…' : ''}"
              </div>
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: 'auto', padding: '6px 10px', fontSize: 0.85 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setDetail(c)
                }}
              >
                {tr('readMore')}
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast text={toast} onDone={() => setToast(null)} />}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? detail.name : undefined}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {detail?.image && (
            <img src={imageUrl(detail)!} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
          )}
          <div className="grow">
            {detail?.challenge && (
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                <b>{tr('challenge')}:</b> {detail?.challenge}
              </div>
            )}
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {detail?.story}
            </div>
            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 1.6, overflowWrap: 'break-word' }}>
              “{detail?.quote}”
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={tr('addCharacter')}>
        <label className="label">{tr('name')}</label>
        <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <label className="label">{tr('story')}</label>
        <textarea className="field" value={draft.story} onChange={(e) => setDraft({ ...draft, story: e.target.value })} rows={3} />
        <label className="label">{tr('challenge')}</label>
        <textarea className="field" value={draft.challenge} onChange={(e) => setDraft({ ...draft, challenge: e.target.value })} rows={3} />
        <label className="label">{tr('quote')}</label>
        <textarea className="field" value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} rows={3} />
        <label className="label">{tr('addImage')}</label>
        <input
          type="file"
          accept="image/*"
          className="field"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            if (!file) return
            setDraft({ ...draft, imageFile: file, imageUrl: URL.createObjectURL(file) })
          }}
        />
        {draft.imageUrl && (
          <img src={draft.imageUrl} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, marginTop: 8 }} />
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn ghost" type="button" onClick={() => setAddOpen(false)}>
            {tr('cancel')}
          </button>
          <button className="btn accent block" type="button" disabled={!draft.name.trim() || !draft.quote.trim()} onClick={saveCharacter}>
            {tr('save')}
          </button>
        </div>
      </Sheet>

      <button
        className="fab"
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label={tr('addCharacter')}
        style={{
          position: 'fixed',
          bottom: 24,
          [isRTL ? 'left' : 'right']: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          boxShadow: 'var(--shadow)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 50,
        }}
      >
        <Plus size={22} />
      </button>
    </div>
  )
}
