import { useEffect, useState } from 'react'
import type { DashboardStats, PrintHistory } from '../types'
import { GetDashboardStats, GetPrintHistory } from '../../wailsjs/go/main/App'

export default function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [stats, setStats] = useState<DashboardStats>({ contactCount: 0, groupCount: 0 })
  const [history, setHistory] = useState<PrintHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([GetDashboardStats(), GetPrintHistory(10)])
      .then(([s, h]) => {
        setStats(s)
        setHistory(h ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">読み込み中...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">ダッシュボード</h2>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          label="連絡先"
          value={stats.contactCount}
          unit="件"
          action="住所録を開く"
          onClick={() => onNavigate('contacts')}
        />
        <SummaryCard
          label="グループ"
          value={stats.groupCount}
          unit="件"
          action="住所録を開く"
          onClick={() => onNavigate('contacts')}
        />
      </div>

      {/* クイックアクション */}
      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">クイックアクション</h3>
        <div className="flex gap-3">
          <QuickAction label="住所録を開く" onClick={() => onNavigate('contacts')} />
          <QuickAction label="ラベル印刷" onClick={() => onNavigate('preview')} />
        </div>
      </section>

      {/* 印刷履歴 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">最近の印刷履歴</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">印刷履歴がありません。</p>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">印刷日時</th>
                  <th className="text-right px-4 py-2 font-medium">枚数</th>
                  <th className="text-center px-4 py-2 font-medium">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => (
                  <tr key={h.id} className="bg-white">
                    <td className="px-4 py-2 text-gray-700">{formatDate(h.printedAt)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{h.contactCount} 件</td>
                    <td className="px-4 py-2 text-center text-gray-400">{h.qrEnabled ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  unit,
  action,
  onClick,
}: {
  label: string
  value: number
  unit: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-800">
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
      <button
        onClick={onClick}
        className="mt-3 text-xs text-blue-600 hover:underline"
      >
        {action} →
      </button>
    </div>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {label}
    </button>
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
