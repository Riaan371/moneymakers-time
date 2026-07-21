import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '#/lib/auth'
import { money, monthKey, monthLabel } from '#/lib/format'
import { supabase } from '#/lib/supabase'
import type { Client, Invoice } from '#/lib/types'

export const Route = createFileRoute('/invoices')({ component: Invoices })

const inputCls =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

type InvoiceRow = Invoice & { clients: { name: string } | null }

function shiftMonth(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + delta)
  return monthKey(d)
}

function Invoices() {
  const { isAdmin } = useAuth()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [clients, setClients] = useState<Client[]>([])

  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState('')
  const [xeroNumber, setXeroNumber] = useState('')
  const [status, setStatus] = useState<'draft' | 'sent' | 'paid'>('sent')

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('period_month', month)
      .order('created_at')
    setRows((data as InvoiceRow[]) ?? [])
  }, [month])

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setClients((data as Client[]) ?? []))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function addInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !amount) return
    await supabase.from('invoices').insert({
      client_id: clientId,
      period_month: month,
      amount_excl: parseFloat(amount),
      xero_invoice_number: xeroNumber || null,
      status,
    })
    setAmount('')
    setXeroNumber('')
    reload()
  }

  async function setInvoiceStatus(id: string, s: Invoice['status']) {
    await supabase.from('invoices').update({ status: s }).eq('id', id)
    reload()
  }

  async function removeInvoice(id: string) {
    await supabase.from('invoices').delete().eq('id', id)
    reload()
  }

  const total = rows.reduce((sum, r) => sum + r.amount_excl, 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <span className="w-40 text-center text-sm font-medium">{monthLabel(month)}</span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Log what was actually invoiced in Xero for each client this month — the dashboard
        compares it against tracked time. (Xero sync is planned; for now capture the
        invoice number and amount here.)
      </p>

      {isAdmin && (
        <form
          onSubmit={addInvoice}
          className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        >
          <label className="text-sm font-medium text-slate-700">
            Client
            <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Amount (R excl.)
            <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Xero invoice #
            <input value={xeroNumber} onChange={(e) => setXeroNumber(e.target.value)} placeholder="INV-0042" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as Invoice['status'])} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Log invoice
          </button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Xero #</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Amount (excl.)</th>
              {isAdmin && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No invoices logged for {monthLabel(month)}.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium">{r.clients?.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.xero_invoice_number ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {isAdmin ? (
                    <select
                      value={r.status}
                      onChange={(e) => setInvoiceStatus(r.id, e.target.value as Invoice['status'])}
                      className="rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                    >
                      <option value="draft">draft</option>
                      <option value="sent">sent</option>
                      <option value="paid">paid</option>
                    </select>
                  ) : (
                    r.status
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(r.amount_excl)}</td>
                {isAdmin && (
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => removeInvoice(r.id)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-slate-50 font-medium">
                <td className="px-4 py-2.5" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(total)}</td>
                {isAdmin && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
