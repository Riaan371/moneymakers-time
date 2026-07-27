export type Client = {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  billing_type: 'retainer' | 'hourly'
  hourly_rate: number | null
  active: boolean
  notes: string | null
}

export type RetainerTerm = {
  id: string
  client_id: string
  monthly_fee: number
  included_hours: number | null
  effective_from: string
  effective_to: string | null
}

export type Category = {
  id: string
  name: string
  billable_default: boolean
  sort: number
}

export type TimeEntry = {
  id: string
  user_id: string
  client_id: string
  category_id: string | null
  description: string | null
  started_at: string
  ended_at: string | null
  billable: boolean
  source: 'timer' | 'manual' | 'import'
}

export type Invoice = {
  id: string
  client_id: string
  period_month: string
  amount_excl: number
  xero_invoice_number: string | null
  status: 'draft' | 'sent' | 'paid'
  notes: string | null
}

export type MonthlySummary = {
  client_id: string
  client_name: string
  billing_type: 'retainer' | 'hourly'
  month: string
  total_hours: number
  billable_hours: number
  hourly_rate: number
  value_at_rate: number
  retainer_fee: number | null
  retainer_included_hours: number | null
  effective_hourly_rate: number | null
  invoiced_amount: number | null
  variance: number | null
}

export type PracticeSettings = {
  practice_name: string
  currency: string
  default_hourly_rate: number
}

export type TrackingRule = {
  id: string
  pattern: string
  client_id: string
  category_id: string | null
  priority: number
  active: boolean
}

export type CapturedSegment = {
  id: string
  user_id: string
  window_title: string
  app_name: string | null
  started_at: string
  ended_at: string
  matched_rule_id: string | null
  client_id: string | null
  category_id: string | null
  status: 'pending' | 'approved' | 'ignored'
  resulting_entry_id: string | null
}
