import { useEffect, useState } from 'react'
import { GetAppVersion, ExportDB, ImportDB } from '../../wailsjs/go/main/App'

export default function Settings() {
  const [version, setVersion] = useState('')
  const [exportMsg, setExportMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => {
    GetAppVersion().then(setVersion).catch(console.error)
  }, [])

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
      await ImportDB()
      setImportMsg('復元しました。アプリを再起動すると反映されます。')
    } catch (e) {
      setImportMsg(`エラー: ${e}`)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-xl">
      <h2 className="text-xl font-semibold text-gray-800">設定</h2>

      {/* データ管理 */}
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
          {importMsg && (
            <p className="text-xs text-amber-600">
              {importMsg}
            </p>
          )}
        </div>
      </section>

      {/* バージョン情報 */}
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
