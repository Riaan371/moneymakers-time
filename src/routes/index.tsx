import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { hours, money, monthKey, monthLabel } from '#/lib/format'
import { supabase } from '#/lib/supabase'
import type { MonthlySummary } from '#/lib/types'

export const Route = createFileRoute('/')({ component: Dashboard })

function shiftMonth(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + delta)
  return monthKey(d)
}

function Dashboard() {
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [rows, setRows] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('monthly_client_summary')
      .select('*')
      .eq('month', month)
      .order('client_name')
      .then(({ data }) => {
        setRows((data as MonthlySummary[]) ?? [])
        setLoading(false)
      })
  }, [month])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        billableHours: acc.billableHours + (r.billable_hours ?? 0),
        value: acc.value + (r.value_at_rate ?? 0),
        billed:
          acc.billed +
          (r.billing_type === 'retainer'
            ? (r.retainer_fee ?? 0)
            : (r.invoiced_amount ?? 0)),
      }),
      { billableHours: 0, value: 0, billed: 0 },
    )
  }, [rows])

  const underRecovering = rows.filter((r) => (r.variance ?? 0) < 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <span className="w-40 text-center text-sm font-medium">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Billable hours" value={hours(totals.billableHours)} />
        <StatCard label="Time value at rates" value={money(totals.value)} />
        <StatCard
          label="Billed (retainers + invoices)"
          value={money(totals.billed)}
          accent={totals.billed >= totals.value ? 'good' : 'bad'}
        />
      </div>

      {underRecovering.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{underRecovering.length}</strong>{' '}
          {underRecovering.length === 1 ? 'client is' : 'clients are'} under-recovering
          this month: {underRecovering.map((r) => r.client_name).join(', ')}. Time spent
          is worth more than what's being billed.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Value @ rate</th>
              <th className="px-4 py-3 text-right">Retainer</th>
              <th className="px-4 py-3 text-right">Effective rate</th>
              <th className="px-4 py-3 text-right">Invoiced</th>
              <th className="px-4 py-3 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No time tracked or invoices logged for {monthLabel(month)} yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.client_id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium">{r.client_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.billing_type === 'retainer'
                        ? 'rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700'
                        : 'rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700'
                    }
                  >
                    {r.billing_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {hours(r.billable_hours)}
                  {r.retainer_included_hours != null && (
                    <span className="text-xs text-slate-400">
                      {' '}
                      / {hours(r.retainer_included_hours)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(r.value_at_rate)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(r.retainer_fee)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.effective_hourly_rate != null ? (
                    <span
                      className={
                        r.effective_hourly_rate < r.hourly_rate
                          ? 'text-red-600'
                          : 'text-emerald-700'
                      }
                    >
                      {money(r.effective_hourly_rate)}/h
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(r.invoiced_amount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.variance != null ? (
                    <span className={r.variance < 0 ? 'font-medium text-red-600' : 'text-emerald-700'}>
                      {money(r.variance)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Variance compares what was billed (retainer fee, or invoices for hourly clients)
        against tracked billable time valued at the client's hourly rate. Negative = the
        work cost more than what was charged.
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'good' | 'bad'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (accent === 'good'
            ? 'text-emerald-700'
            : accent === 'bad'
              ? 'text-red-600'
              : 'text-slate-900')
        }
      >
        {value}
      </div>
    </div>
  )
}
