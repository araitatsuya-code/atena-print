import { useEffect, useState } from 'react'
import {
  ExportDB,
  GetAppVersion,
  GetBackupSettings,
  ImportDB,
  ListBackupGenerations,
  RestoreBackupGeneration,
  SaveBackupSettings,
} from '../../wailsjs/go/main/App'
import type { BackupGeneration, BackupSettings } from '../types'

const triggerLabelMap: Record<string, string> = {
  startup: '起動時',
  shutdown: '終了時',
  interval: '定期実行',
  before_restore: '復元前退避',
}

export default function Settings() {
  const [version, setVersion] = useState('')
  const [exportMsg, setExportMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null)
  const [backupSettingsMsg, setBackupSettingsMsg] = useState('')
  const [backupGenerations, setBackupGenerations] = useState<BackupGeneration[]>([])
  const [restoreMsg, setRestoreMsg] = useState('')
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [savingBackupSettings, setSavingBackupSettings] = useState(false)
  const [restoringBackupID, setRestoringBackupID] = useState('')

  useEffect(() => {
    GetAppVersion().then(setVersion).catch(console.error)
    loadBackupData().catch(console.error)
  }, [])

  async function loadBackupData() {
    setLoadingBackups(true)
    try {
      const [settings, generations] = await Promise.all([GetBackupSettings(), ListBackupGenerations()])
      setBackupSettings(settings as BackupSettings)
      setBackupGenerations(generations as BackupGeneration[])
    } finally {
      setLoadingBackups(false)
    }
  }

  async function handleExport() {
    setExportMsg('')
    try {
      const dest = await ExportDB()
      if (dest) {
        setExportMsg(`バックアップを保存しました: ${dest}`)
      }
    } catch (e) {
      setExportMsg(`エラー: ${e}`)
    }
  }

  async function handleImport() {
    setImportMsg('')
    try {
      const imported = await ImportDB()
      if (imported) {
        setImportMsg('復元しました。アプリを再起動すると反映されます。')
      }
    } catch (e) {
      setImportMsg(`エラー: ${e}`)
    }
  }

  async function handleSaveBackupSettings() {
    if (!backupSettings) return
    setBackupSettingsMsg('')
    setSavingBackupSettings(true)
    try {
      const saved = await SaveBackupSettings(backupSettings)
      setBackupSettings(saved as BackupSettings)
      setBackupSettingsMsg('自動バックアップ設定を保存しました。')
      await loadBackupData()
    } catch (e) {
      setBackupSettingsMsg(`保存エラー: ${e}`)
    } finally {
      setSavingBackupSettings(false)
    }
  }

  async function handleRestoreGeneration(generation: BackupGeneration) {
    const ok = window.confirm(
      `世代 ${formatDateTime(generation.createdAt)} を復元します。\n復元前に現行データは自動退避されます。\n実行しますか？`,
    )
    if (!ok) return

    setRestoreMsg('')
    setRestoringBackupID(generation.id)
    try {
      const result = await RestoreBackupGeneration(generation.id)
      const typed = result as { preservedBackupId?: string; restartRequired?: boolean }
      const preserved = typed.preservedBackupId ? `（現行退避: ${typed.preservedBackupId}）` : ''
      const restart = typed.restartRequired ? ' アプリ再起動後に反映されます。' : ''
      setRestoreMsg(`復元しました ${preserved}.${restart}`.trim())
      await loadBackupData()
    } catch (e) {
      setRestoreMsg(`復元エラー: ${e}`)
    } finally {
      setRestoringBackupID('')
    }
  }

  function updateBackupSettings(next: Partial<BackupSettings>) {
    setBackupSettings((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        ...next,
      }
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-800">設定</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-200 pb-2">データ管理</h3>

        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            住所録・グループ・差出人データを SQLite ファイルとしてエクスポート／インポートできます。
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              バックアップ (エクスポート)
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              復元 (インポート)
            </button>
          </div>
          {exportMsg && <p className="text-xs text-green-600">{exportMsg}</p>}
          {importMsg && <p className="text-xs text-amber-600">{importMsg}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-200 pb-2">自動バックアップ設定</h3>

        {!backupSettings ? (
          <p className="text-sm text-gray-500">設定を読み込み中...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={backupSettings.timing.onStartup}
                  onChange={(e) =>
                    updateBackupSettings({
                      timing: {
                        ...backupSettings.timing,
                        onStartup: e.target.checked,
                      },
                    })
                  }
                />
                起動時に自動バックアップ
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={backupSettings.timing.onShutdown}
                  onChange={(e) =>
                    updateBackupSettings({
                      timing: {
                        ...backupSettings.timing,
                        onShutdown: e.target.checked,
                      },
                    })
                  }
                />
                終了時に自動バックアップ
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                定期バックアップ間隔 (分, 0で無効)
                <input
                  type="number"
                  min={0}
                  value={backupSettings.timing.intervalMinutes}
                  onChange={(e) =>
                    updateBackupSettings({
                      timing: {
                        ...backupSettings.timing,
                        intervalMinutes: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-700">
                保持世代数
                <input
                  type="number"
                  min={1}
                  value={backupSettings.maxGenerations}
                  onChange={(e) =>
                    updateBackupSettings({
                      maxGenerations: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveBackupSettings}
                disabled={savingBackupSettings}
                className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:bg-emerald-300"
              >
                {savingBackupSettings ? '保存中...' : '設定を保存'}
              </button>
              {backupSettingsMsg && <p className="text-xs text-green-700">{backupSettingsMsg}</p>}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-200 pb-2">バックアップ世代</h3>
        <p className="text-sm text-gray-600">日時・件数を確認し、任意の世代へ復元できます。</p>

        {loadingBackups ? (
          <p className="text-sm text-gray-500">世代を読み込み中...</p>
        ) : backupGenerations.length === 0 ? (
          <p className="text-sm text-gray-500">バックアップ世代はまだありません。</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">日時</th>
                  <th className="text-left px-3 py-2">件数</th>
                  <th className="text-left px-3 py-2">トリガー</th>
                  <th className="text-right px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {backupGenerations.map((generation) => (
                  <tr key={generation.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{formatDateTime(generation.createdAt)}</td>
                    <td className="px-3 py-2 text-gray-700">{generation.contactCount}件</td>
                    <td className="px-3 py-2 text-gray-700">{triggerLabelMap[generation.trigger] ?? generation.trigger}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRestoreGeneration(generation)}
                        disabled={restoringBackupID === generation.id}
                        className="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
                      >
                        {restoringBackupID === generation.id ? '復元中...' : 'この世代へ復元'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {restoreMsg && <p className="text-xs text-amber-700">{restoreMsg}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-200 pb-2">バージョン情報</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <span className="text-gray-500">アプリ名: </span>Atena ラベル印刷
          </p>
          <p>
            <span className="text-gray-500">バージョン: </span>
            {version || '—'}
          </p>
          <p>
            <span className="text-gray-500">技術スタック: </span>Wails v2 / Go / React / TypeScript
          </p>
        </div>
      </section>
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
