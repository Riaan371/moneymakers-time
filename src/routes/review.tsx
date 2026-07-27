import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '#/lib/auth'
import { durationLabel, minutesBetween } from '#/lib/format'
import { supabase } from '#/lib/supabase'
import type { Category, CapturedSegment, Client, TrackingRule } from '#/lib/types'

export const Route = createFileRoute('/review')({ component: Review })

const inputCls =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

function Review() {
  const { isAdmin } = useAuth()
  const [segments, setSegments] = useState<CapturedSegment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<TrackingRule[]>([])
  const [showRules, setShowRules] = useState(false)
  const [draft, setDraft] = useState<Record<string, { client_id: string; category_id: string }>>({})

  // add-rule form
  const [pattern, setPattern] = useState('')
  const [ruleClientId, setRuleClientId] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState('')

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? '—'
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'

  const reload = useCallback(async () => {
    const [segRes, clientRes, catRes, ruleRes] = await Promise.all([
      supabase
        .from('captured_segments')
        .select('*')
        .eq('status', 'pending')
        .order('started_at', { ascending: false })
        .limit(100),
      supabase.from('clients').select('*').eq('active', true).order('name'),
      supabase.from('categories').select('*').order('sort'),
      supabase.from('tracking_rules').select('*').order('priority', { ascending: false }),
    ])
    const segs = (segRes.data as CapturedSegment[]) ?? []
    setSegments(segs)
    setClients((clientRes.data as Client[]) ?? [])
    setCategories((catRes.data as Category[]) ?? [])
    setRules((ruleRes.data as TrackingRule[]) ?? [])
    setDraft((prev) => {
      const next = { ...prev }
      for (const s of segs) {
        if (!next[s.id]) {
          next[s.id] = { client_id: s.client_id ?? '', category_id: s.category_id ?? '' }
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  function setDraftField(id: string, field: 'client_id' | 'category_id', value: string) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function approve(seg: CapturedSegment) {
    const d = draft[seg.id]
    if (!d?.client_id) return
    const category = categories.find((c) => c.id === d.category_id)
    const { data: entry } = await supabase
      .from('time_entries')
      .insert({
        client_id: d.client_id,
        category_id: d.category_id || null,
        description: seg.window_title,
        started_at: seg.started_at,
        ended_at: seg.ended_at,
        billable: category?.billable_default ?? true,
        source: 'import',
      })
      .select()
      .single()
    await supabase
      .from('captured_segments')
      .update({ status: 'approved', resulting_entry_id: entry?.id ?? null })
      .eq('id', seg.id)
    reload()
  }

  async function ignore(id: string) {
    await supabase.from('captured_segments').update({ status: 'ignored' }).eq('id', id)
    reload()
  }

  async function approveAllMatched() {
    const matched = segments.filter((s) => draft[s.id]?.client_id)
    for (const s of matched) {
      await approve(s)
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    if (!pattern || !ruleClientId) return
    await supabase.from('tracking_rules').insert({
      pattern,
      client_id: ruleClientId,
      category_id: ruleCategoryId || null,
    })
    setPattern('')
    reload()
  }

  async function removeRule(id: string) {
    await supabase.from('tracking_rules').delete().eq('id', id)
    reload()
  }

  const matchedCount = segments.filter((s) => s.matched_rule_id).length

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Review captured time</h1>
        {isAdmin && (
          <button
            onClick={() => setShowRules((s) => !s)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {showRules ? 'Close rules' : 'Manage rules'}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Segments captured by the desktop agent land here first — nothing is billed until you
        approve it. {segments.length > 0 && (
          <>
            {matchedCount} of {segments.length} auto-matched a rule.
          </>
        )}
      </p>

      {showRules && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-sm font-semibold text-sky-900">Tracking rules</h2>
          <p className="mt-1 text-xs text-sky-800">
            If a captured window title contains the pattern (case-insensitive), it's
            auto-assigned to that client/category. Longer, more specific patterns win when
            more than one matches — e.g. the client's exact Xero org name beats a generic "Xero".
          </p>
          <form
            onSubmit={addRule}
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <label className="text-sm font-medium text-slate-700">
              Title contains
              <input
                required
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. Acme Textiles"
                className={inputCls}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Client
              <select required value={ruleClientId} onChange={(e) => setRuleClientId(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Category
              <select value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="self-end rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800">
              Add rule
            </button>
          </form>
          <ul className="mt-3 divide-y divide-sky-100 text-sm">
            {rules.length === 0 && <li className="py-2 text-sky-700">No rules yet.</li>}
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-1.5">
                <span>
                  "<strong>{r.pattern}</strong>" → {clientName(r.client_id)}
                  {r.category_id && <span className="text-slate-500"> · {categoryName(r.category_id)}</span>}
                </span>
                <button onClick={() => removeRule(r.id)} className="text-xs text-slate-400 hover:text-red-600">
                  delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {segments.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={approveAllMatched}
            disabled={matchedCount === 0}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            Approve all matched ({matchedCount})
          </button>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Captured</th>
              <th className="px-4 py-2.5">Window / app</th>
              <th className="px-4 py-2.5 text-right">Duration</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nothing waiting for review. Once the desktop agent is running, captured
                  segments will show up here.
                </td>
              </tr>
            )}
            {segments.map((s) => {
              const d = draft[s.id] ?? { client_id: '', category_id: '' }
              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {new Date(s.started_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    <div className="text-xs text-slate-400">
                      {new Date(s.started_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="max-w-xs truncate font-medium" title={s.window_title}>
                      {s.window_title}
                    </div>
                    {s.app_name && <div className="text-xs text-slate-400">{s.app_name}</div>}
                    {s.matched_rule_id && (
                      <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        rule matched
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {durationLabel(minutesBetween(s.started_at, s.ended_at))}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={d.client_id}
                      onChange={(e) => setDraftField(s.id, 'client_id', e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">Select…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={d.category_id}
                      onChange={(e) => setDraftField(s.id, 'category_id', e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => approve(s)}
                      disabled={!d.client_id}
                      className="mr-3 text-xs font-medium text-emerald-700 hover:underline disabled:opacity-30"
                    >
                      approve
                    </button>
                    <button onClick={() => ignore(s.id)} className="text-xs text-slate-400 hover:text-red-600">
                      ignore
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
