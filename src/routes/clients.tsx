import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '#/lib/auth'
import { hours, money } from '#/lib/format'
import { supabase } from '#/lib/supabase'
import type { Client, RetainerTerm } from '#/lib/types'

export const Route = createFileRoute('/clients')({ component: Clients })

const inputCls =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

function Clients() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [terms, setTerms] = useState<RetainerTerm[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [retainerFor, setRetainerFor] = useState<Client | null>(null)

  // add-client form
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [billingType, setBillingType] = useState<'retainer' | 'hourly'>('retainer')
  const [hourlyRate, setHourlyRate] = useState('')

  // retainer form
  const [fee, setFee] = useState('')
  const [includedHours, setIncludedHours] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 8) + '01',
  )

  const reload = useCallback(async () => {
    const [clientsRes, termsRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('retainer_terms').select('*').is('effective_to', null),
    ])
    setClients((clientsRes.data as Client[]) ?? [])
    setTerms((termsRes.data as RetainerTerm[]) ?? [])
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  function currentTerm(clientId: string) {
    return terms.find((t) => t.client_id === clientId)
  }

  async function addClient(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('clients').insert({
      name,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      billing_type: billingType,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
    })
    setName('')
    setContactName('')
    setContactEmail('')
    setHourlyRate('')
    setShowAdd(false)
    reload()
  }

  async function saveRetainer(e: React.FormEvent) {
    e.preventDefault()
    if (!retainerFor) return
    const dayBefore = new Date(effectiveFrom + 'T00:00:00')
    dayBefore.setDate(dayBefore.getDate() - 1)
    // close off the current term, then start the new one
    await supabase
      .from('retainer_terms')
      .update({ effective_to: dayBefore.toISOString().slice(0, 10) })
      .eq('client_id', retainerFor.id)
      .is('effective_to', null)
    await supabase.from('retainer_terms').insert({
      client_id: retainerFor.id,
      monthly_fee: parseFloat(fee),
      included_hours: includedHours ? parseFloat(includedHours) : null,
      effective_from: effectiveFrom,
    })
    setRetainerFor(null)
    setFee('')
    setIncludedHours('')
    reload()
  }

  async function toggleActive(c: Client) {
    await supabase.from('clients').update({ active: !c.active }).eq('id', c.id)
    reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        {isAdmin && (
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {showAdd ? 'Close' : '+ Add client'}
          </button>
        )}
      </div>

      {showAdd && (
        <form
          onSubmit={addClient}
          className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-sm font-medium text-slate-700">
            Company name
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Contact person
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Contact email
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Billing type
            <select
              value={billingType}
              onChange={(e) => setBillingType(e.target.value as 'retainer' | 'hourly')}
              className={inputCls}
            >
              <option value="retainer">Retainer</option>
              <option value="hourly">Hourly</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hourly rate (R)
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="practice default"
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 lg:col-start-5"
          >
            Save client
          </button>
        </form>
      )}

      {retainerFor && (
        <form
          onSubmit={saveRetainer}
          className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
        >
          <div className="text-sm font-medium text-sky-900 sm:col-span-5">
            Retainer terms for {retainerFor.name}
          </div>
          <label className="text-sm font-medium text-slate-700">
            Monthly fee (R excl.)
            <input required type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Included hours (optional)
            <input type="number" step="0.5" value={includedHours} onChange={(e) => setIncludedHours(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Effective from
            <input required type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputCls} />
          </label>
          <button type="submit" className="self-end rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800">
            Save
          </button>
          <button
            type="button"
            onClick={() => setRetainerFor(null)}
            className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-white"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Billing</th>
              <th className="px-4 py-2.5 text-right">Hourly rate</th>
              <th className="px-4 py-2.5 text-right">Retainer</th>
              {isAdmin && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No clients yet.
                </td>
              </tr>
            )}
            {clients.map((c) => {
              const term = currentTerm(c.id)
              return (
                <tr
                  key={c.id}
                  className={
                    'border-b border-slate-100 last:border-0' +
                    (c.active ? '' : ' opacity-40')
                  }
                >
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {c.contact_name ?? '—'}
                    {c.contact_email && (
                      <span className="text-xs text-slate-400"> · {c.contact_email}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{c.billing_type}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.hourly_rate != null ? money(c.hourly_rate) + '/h' : 'default'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {term
                      ? `${money(term.monthly_fee)}/m` +
                        (term.included_hours != null
                          ? ` (${hours(term.included_hours)})`
                          : '')
                      : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {c.billing_type === 'retainer' && (
                        <button
                          onClick={() => {
                            setRetainerFor(c)
                            setFee(term ? String(term.monthly_fee) : '')
                            setIncludedHours(
                              term?.included_hours != null ? String(term.included_hours) : '',
                            )
                          }}
                          className="mr-3 text-xs text-sky-700 hover:underline"
                        >
                          retainer
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(c)}
                        className="text-xs text-slate-400 hover:text-slate-700"
                      >
                        {c.active ? 'archive' : 'restore'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
