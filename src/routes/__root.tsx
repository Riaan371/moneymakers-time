import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import { AuthProvider, LoginForm, useAuth } from '#/lib/auth'
import { supabase } from '#/lib/supabase'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Money Makers Time' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-slate-50 text-slate-900">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/track', label: 'Track' },
  { to: '/review', label: 'Review' },
  { to: '/clients', label: 'Clients' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/settings', label: 'Settings' },
] as const

function Shell() {
  const { session, loading, displayName } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }
  if (!session) return <LoginForm />

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <span className="text-base font-semibold text-emerald-800">
              Money Makers <span className="font-normal text-slate-400">Time</span>
            </span>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  activeProps={{
                    className:
                      'rounded-md px-3 py-1.5 text-sm bg-emerald-50 text-emerald-800 font-medium',
                  }}
                  activeOptions={{ exact: item.to === '/' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{displayName}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

function RootLayout() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
