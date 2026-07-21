import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '#/lib/auth'
import { durationLabel, minutesBetween } from '#/lib/format'
import { supabase } from '#/lib/supabase'
import type { Category, Client, TimeEntry } from '#/lib/types'

export const Route = createFileRoute('/track')({ component: Track })

type EntryRow = TimeEntry & {
  clients: { name: string } | null
  categories: { name: string } | null
}

const inputCls =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

function Track() {
  const { session } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [running, setRunning] = useState<EntryRow | null>(null)
  const [recent, setRecent] = useState<EntryRow[]>([])
  const [tick, setTick] = useState(0)

  // start-timer form
  const [clientId, setClientId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')

  // manual form
  const [showManual, setShowManual] = useState(false)
  const [mDate, setMDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mHours, setMHours] = useState('1')
  const [mClientId, setMClientId] = useState('')
  const [mCategoryId, setMCategoryId] = useState('')
  const [mDescription, setMDescription] = useState('')

  const reload = useCallback(async () => {
    if (!session) return
    const [runningRes, recentRes] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*, clients(name), categories(name)')
        .is('ended_at', null)
        .eq('user_id', session.user.id)
        .maybeSingle(),
      supabase
        .from('time_entries')
        .select('*, clients(name), categories(name)')
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(25),
    ])
    setRunning((runningRes.data as EntryRow | null) ?? null)
    setRecent((recentRes.data as EntryRow[]) ?? [])
  }, [session])

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setClients((data as Client[]) ?? []))
    supabase
      .from('categories')
      .select('*')
      .order('sort')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // tick every 30s so the running duration stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  async function startTimer(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return
    const category = categories.find((c) => c.id === categoryId)
    await supabase.from('time_entries').insert({
      client_id: clientId,
      category_id: categoryId || null,
      description: description || null,
      billable: category?.billable_default ?? true,
      source: 'timer',
    })
    setDescription('')
    reload()
  }

  async function stopTimer() {
    if (!running) return
    await supabase
      .from('time_entries')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', running.id)
    reload()
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    if (!mClientId) return
    const durationH = parseFloat(mHours)
    if (!durationH || durationH <= 0) return
    const start = new Date(`${mDate}T09:00:00`)
    const end = new Date(start.getTime() + durationH * 3600_000)
    const category = categories.find((c) => c.id === mCategoryId)
    await supabase.from('time_entries').insert({
      client_id: mClientId,
      category_id: mCategoryId || null,
      description: mDescription || null,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      billable: category?.billable_default ?? true,
      source: 'manual',
    })
    setMDescription('')
    reload()
  }

  async function removeEntry(id: string) {
    await supabase.from('time_entries').delete().eq('id', id)
    reload()
  }

  void tick // referenced so the interval re-render isn't flagged unused

  return (
    <div>
      <h1 className="text-2xl font-semibold">Track time</h1>

      {running ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-emerald-900">
              {running.clients?.name}
              {running.categories?.name && (
                <span className="text-emerald-700"> · {running.categories.name}</span>
              )}
            </div>
            {running.description && (
              <div className="text-sm text-emerald-800">{running.description}</div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-semibold tabular-nums text-emerald-900">
              {durationLabel(minutesBetween(running.started_at, null))}
            </span>
            <button
              onClick={stopTimer}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Stop
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={startTimer}
          className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_2fr_auto]"
        >
          <label className="text-sm font-medium text-slate-700">
            Client
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputCls}
            >
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
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. July payroll run"
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-md bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Start
          </button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent entries</h2>
        <button
          onClick={() => setShowManual((s) => !s)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {showManual ? 'Close' : '+ Add manual entry'}
        </button>
      </div>

      {showManual && (
        <form
          onSubmit={addManual}
          className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[auto_auto_1fr_1fr_2fr_auto]"
        >
          <label className="text-sm font-medium text-slate-700">
            Date
            <input
              type="date"
              value={mDate}
              onChange={(e) => setMDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hours
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={mHours}
              onChange={(e) => setMHours(e.target.value)}
              className={inputCls + ' w-24'}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Client
            <select
              required
              value={mClientId}
              onChange={(e) => setMClientId(e.target.value)}
              className={inputCls}
            >
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
            <select
              value={mCategoryId}
              onChange={(e) => setMCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Description
            <input
              value={mDescription}
              onChange={(e) => setMDescription(e.target.value)}
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Add
          </button>
        </form>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Duration</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No entries yet — start the timer above.
                </td>
              </tr>
            )}
            {recent.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                  {new Date(e.started_at).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </td>
                <td className="px-4 py-2.5 font-medium">{e.clients?.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.categories?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{e.description ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {durationLabel(minutesBetween(e.started_at, e.ended_at))}
                  {!e.billable && (
                    <span className="ml-1 text-xs text-slate-400">(non-billable)</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => removeEntry(e.id)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
