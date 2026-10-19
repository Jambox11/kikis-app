import type { Metadata } from 'next'
import { networkLabel } from '@/lib/explorer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: `Live view of KikisApp payment sessions, transactions, and voucher activity on Stellar ${networkLabel()}.`,
}

import { getSupabaseServerClient, SESSION_COLUMNS } from '@/lib/supabase'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics'
import { SessionTable } from '@/components/dashboard/SessionTable'
import { TxFeed } from '@/components/dashboard/TxFeed'
import { VoucherChart } from '@/components/dashboard/VoucherChart'
import type { DashboardStatsRow } from '@/lib/dashboardMetrics'
import type { Session, TxLogEntry } from '@/lib/supabase'

const SESSIONS_PAGE_SIZE = 50
const TX_LOG_PAGE_SIZE = 20

async function fetchDashboardData() {
  const supabase = getSupabaseServerClient()

  const [sessionsRes, txLogRes, statsRes] = await Promise.all([
    supabase
      .from('public_sessions')
      .select(SESSION_COLUMNS)
      .order('opened_at', { ascending: false })
      .limit(SESSIONS_PAGE_SIZE),
    supabase
      .from('tx_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(TX_LOG_PAGE_SIZE),
    supabase.from('public_dashboard_stats').select('*').maybeSingle(),
  ])

  if (sessionsRes.error) {
    console.error('[dashboard] failed to load public_sessions:', sessionsRes.error.message)
  }
  if (txLogRes.error) {
    console.error('[dashboard] failed to load tx_log:', txLogRes.error.message)
  }
  if (statsRes.error) {
    console.error('[dashboard] failed to load public_dashboard_stats:', statsRes.error.message)
  }

  const sessions = (sessionsRes.data ?? []) as Session[]
  const txLog = (txLogRes.data ?? []) as TxLogEntry[]
  const stats = (statsRes.data ?? null) as DashboardStatsRow | null

  return {
    sessions,
    txLog,
    stats,
    hasError: Boolean(sessionsRes.error || txLogRes.error || statsRes.error),
  }
}

/**
 * Cursor-based pagination for the dashboard feeds.
 *
 * Accepts a `cursor` (ISO timestamp of the last row already shown) and a `limit`,
 * and returns the next batch ordered by the indexed timestamp column. The cursor
 * is exclusive (`WHERE opened_at < cursor` / `WHERE created_at < cursor`) so
 * subsequent pages never overlap with rows already rendered.
 */
export async function loadMoreSessions(cursor: string, limit = SESSIONS_PAGE_SIZE) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('public_sessions')
    .select(SESSION_COLUMNS)
    .lt('opened_at', cursor)
    .order('opened_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[dashboard] failed to paginate public_sessions:', error.message)
    throw new Error(error.message)
  }

  return (data ?? []) as Session[]
}

export async function loadMoreTxLog(cursor: string, limit = TX_LOG_PAGE_SIZE) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('tx_log')
    .select('*')
    .lt('created_at', cursor)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[dashboard] failed to paginate tx_log:', error.message)
    throw new Error(error.message)
  }

  return (data ?? []) as TxLogEntry[]
}

export default async function DashboardPage() {
  const { sessions, txLog, stats, hasError } = await fetchDashboardData()

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {hasError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Some dashboard data could not be loaded from the registry. Figures below may be
            incomplete — check server logs for details.
          </div>
        )}

        {/* Metric cards — server-seeded from the aggregate view, polled client-side */}
        <DashboardMetrics initialStats={stats} />

        {/* Session table + Tx feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SessionTable
              initialSessions={sessions}
              pageSize={SESSIONS_PAGE_SIZE}
              loadMore={loadMoreSessions}
            />
          </div>
          <div className="lg:col-span-1 min-h-[400px]">
            <TxFeed
              initialEntries={txLog}
              pageSize={TX_LOG_PAGE_SIZE}
              loadMore={loadMoreTxLog}
            />
          </div>
        </div>

        {/* Voucher chart */}
        <VoucherChart />
      </main>
    </div>
  )
}
