import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useAuth } from '#/lib/auth'
import { supabase } from '#/lib/supabase'
import type { Category, PracticeSettings } from '#/lib/types'

export const Route = createFileRoute('/settings')({ component: Settings })

const inputCls =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

function Settings() {
  const { isAdmin } = useAuth()
  const [settings, setSettings] = useState<PracticeSettings | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [rate, setRate] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        const s = data as PracticeSettings | null
        setSettings(s)
        if (s) setRate(String(s.default_hourly_rate))
      })
    supabase
      .from('categories')
      .select('*')
      .order('sort')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await supabase
      .from('settings')
      .update({ default_hourly_rate: parseFloat(rate) || 0 })
      .eq('id', true)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Practice</h2>
        <p className="mt-1 text-sm text-slate-500">
          {settings?.practice_name ?? '…'} · billing in {settings?.currency ?? 'ZAR'}
        </p>
        <form onSubmit={save} className="mt-4 flex items-end gap-3">
          <label className="flex-1 text-sm font-medium text-slate-700">
            Default hourly rate (R excl.)
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={!isAdmin}
              className={inputCls}
            />
          </label>
          {isAdmin && (
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          )}
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Used to value tracked time for any client without their own hourly rate.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Work categories</h2>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>{c.name}</span>
              <span className="text-xs text-slate-400">
                {c.billable_default ? 'billable' : 'non-billable'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Categories are seeded in the database migration — edit them in Supabase if the
          list needs to change.
        </p>
      </div>
    </div>
  )
}
