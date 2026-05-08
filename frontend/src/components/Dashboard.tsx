import { useEffect, useMemo, useState } from 'react'
import type { ContactYearStatus, DashboardStats, PrintHistory } from '../types'
import {
  GetContactYearStatuses,
  GetDashboardStats,
  GetPrintHistory,
} from '../../wailsjs/go/main/App'

interface AnnualSummary {
  sent: number
  received: number
  mourning: number
}

const emptyAnnualSummary: AnnualSummary = { sent: 0, received: 0, mourning: 0 }

export default function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const currentYear = useMemo(() => new Date().getFullYear(), [])

  const [stats, setStats] = useState<DashboardStats>({ contactCount: 0, groupCount: 0 })
  const [history, setHistory] = useState<PrintHistory[]>([])
  const [annual, setAnnual] = useState<AnnualSummary>(emptyAnnualSummary)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      GetDashboardStats(),
      GetPrintHistory(10),
      GetContactYearStatuses(currentYear),
    ])
      .then(([s, h, statuses]) => {
        setStats(s)
        setHistory(h ?? [])
        setAnnual(aggregateAnnual(statuses ?? []))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentYear])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        読み込み中...
      </div>
    )
  }

  const heroState: HeroState =
    stats.contactCount === 0
      ? 'empty'
      : history.length === 0
        ? 'first-print'
        : 'next-print'

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">ダッシュボード</h2>

      <NextStepHero state={heroState} onNavigate={onNavigate} />

      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">サマリー</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryCard label="連絡先" value={stats.contactCount} unit="件" />
          <SummaryCard label="グループ" value={stats.groupCount} unit="件" />
          <SummaryCard
            label={`${currentYear} 送付済`}
            value={annual.sent}
            unit="件"
            accent="blue"
          />
          <SummaryCard
            label={`${currentYear} 受取`}
            value={annual.received}
            unit="件"
            accent="indigo"
          />
          <SummaryCard
            label={`${currentYear} 喪中`}
            value={annual.mourning}
            unit="件"
            accent="rose"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">最近の印刷履歴</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">印刷履歴がありません。</p>
        ) : (
          <div className="space-y-2">
            <LatestPrintRow history={history[0]} />
            {history.length > 1 && (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md bg-white">
                {history.slice(1).map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between px-4 py-2 text-sm text-gray-700"
                  >
                    <span>{formatDate(h.printedAt)}</span>
                    <span className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{h.contactCount} 件</span>
                      <span>{h.qrEnabled ? 'QR ✓' : 'QR —'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

type HeroState = 'empty' | 'first-print' | 'next-print'

function NextStepHero({
  state,
  onNavigate,
}: {
  state: HeroState
  onNavigate: (view: string) => void
}) {
  const config = {
    empty: {
      title: '最初の連絡先を追加しましょう',
      description: 'CSV取込で一括登録するか、住所録から手動で追加できます。',
      primary: { label: 'CSV取込で始める', view: 'contacts' },
      secondary: { label: '住所録を開く', view: 'contacts' },
    },
    'first-print': {
      title: 'ラベルを印刷してみましょう',
      description: '住所録で印刷対象を選び、プレビュー画面から印刷できます。',
      primary: { label: 'ラベル印刷へ', view: 'preview' },
      secondary: { label: '住所録を開く', view: 'contacts' },
    },
    'next-print': {
      title: '次のラベル印刷を始めましょう',
      description: '前回の続きから印刷対象を選んで印刷できます。',
      primary: { label: 'ラベル印刷へ', view: 'preview' },
      secondary: { label: '住所録を開く', view: 'contacts' },
    },
  }[state]

  return (
    <section
      aria-label="次の一歩"
      className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm"
    >
      <p className="text-base font-semibold text-blue-800">{config.title}</p>
      <p className="mt-1 text-sm text-gray-600">{config.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate(config.primary.view)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700"
        >
          {config.primary.label}
        </button>
        <button
          type="button"
          onClick={() => onNavigate(config.secondary.view)}
          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          {config.secondary.label}
        </button>
      </div>
    </section>
  )
}

const accentClassMap = {
  default: { value: 'text-gray-800', label: 'text-gray-500' },
  blue: { value: 'text-blue-700', label: 'text-blue-600' },
  indigo: { value: 'text-indigo-700', label: 'text-indigo-600' },
  rose: { value: 'text-rose-700', label: 'text-rose-600' },
} as const

type Accent = keyof typeof accentClassMap

function SummaryCard({
  label,
  value,
  unit,
  accent = 'default',
}: {
  label: string
  value: number
  unit: string
  accent?: Accent
}) {
  const colors = accentClassMap[accent]
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className={`text-[11px] font-medium uppercase tracking-wide ${colors.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors.value}`}>
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  )
}

function LatestPrintRow({ history }: { history: PrintHistory }) {
  const relative = formatRelative(history.printedAt)
  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/60 px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-600">最終印刷</p>
        <p className="mt-0.5 text-sm font-semibold text-gray-800">{formatDate(history.printedAt)}</p>
        {relative && <p className="text-xs text-gray-500">{relative}</p>}
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-gray-800">
          {history.contactCount}
          <span className="text-sm font-normal text-gray-500 ml-1">件</span>
        </p>
        <p className="text-xs text-gray-500">{history.qrEnabled ? 'QR あり' : 'QR なし'}</p>
      </div>
    </div>
  )
}

function aggregateAnnual(statuses: ContactYearStatus[]): AnnualSummary {
  return statuses.reduce<AnnualSummary>(
    (acc, s) => ({
      sent: acc.sent + (s.sent ? 1 : 0),
      received: acc.received + (s.received ? 1 : 0),
      mourning: acc.mourning + (s.mourning ? 1 : 0),
    }),
    { ...emptyAnnualSummary },
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatRelative(iso: string): string | null {
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return null
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes} 分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 時間前`
  const days = Math.floor(hours / 24)
  if (days < 31) return `${days} 日前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ヶ月前`
  const years = Math.floor(days / 365)
  return `${years} 年前`
}
