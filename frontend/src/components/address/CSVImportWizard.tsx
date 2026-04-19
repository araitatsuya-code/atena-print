import { useEffect, useMemo, useState } from 'react'
import {
  AnalyzeCSVImport,
  GetCSVImportPlan,
  ImportCSVWithOptions,
} from '../../../wailsjs/go/main/App'
import type {
  CSVImportAnalysis,
  CSVImportExecutionResult,
  CSVImportPlan,
  CSVDuplicateResolution,
} from '../../types'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'

interface Props {
  filePath: string
  onClose: () => void
  onCompleted: () => Promise<void>
}

type Step = 'mapping' | 'duplicates' | 'result'
type DuplicateAction = 'new' | 'overwrite' | 'skip'

export default function CSVImportWizard({ filePath, onClose, onCompleted }: Props) {
  const [step, setStep] = useState<Step>('mapping')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<CSVImportPlan | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [analysis, setAnalysis] = useState<CSVImportAnalysis | null>(null)
  const [resolutions, setResolutions] = useState<Record<number, DuplicateAction>>({})
  const [result, setResult] = useState<CSVImportExecutionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setPlan(null)
    setAnalysis(null)
    setResult(null)

    GetCSVImportPlan(filePath)
      .then((res) => {
        if (!active) return
        const typed = res as CSVImportPlan
        setPlan(typed)
        setMapping(typed.suggestedMapping ?? {})
      })
      .catch((err) => {
        if (!active) return
        console.error(err)
        setError(`CSVの解析に失敗しました: ${String(err)}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [filePath])

  const canAnalyze = useMemo(() => {
    if (!plan) return false
    return plan.fieldDefinitions.every((field) => !field.required || (mapping[field.key] ?? -1) >= 0)
  }, [plan, mapping])

  const handleAnalyze = async () => {
    if (!plan || !canAnalyze) return
    setLoading(true)
    setError(null)
    try {
      const analyzed = await AnalyzeCSVImport(filePath, mapping)
      const typed = analyzed as CSVImportAnalysis
      setAnalysis(typed)
      const defaults: Record<number, DuplicateAction> = {}
      typed.duplicates.forEach((dup) => {
        const action = dup.suggestedAction ?? 'overwrite'
        defaults[dup.rowNumber] = action
      })
      setResolutions(defaults)
      setStep('duplicates')
    } catch (err) {
      console.error(err)
      setError(`重複解析に失敗しました: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleResolutionChange = (rowNumber: number, action: DuplicateAction) => {
    setResolutions((prev) => ({ ...prev, [rowNumber]: action }))
  }

  const buildResolutionPayload = (): CSVDuplicateResolution[] => {
    return Object.entries(resolutions).map(([rowNumber, action]) => ({
      rowNumber: Number(rowNumber),
      action,
    }))
  }

  const handleExecute = async () => {
    if (!plan) return
    setLoading(true)
    setError(null)
    try {
      const executed = await ImportCSVWithOptions(filePath, mapping, buildResolutionPayload())
      await onCompleted()
      setResult(executed as CSVImportExecutionResult)
      setStep('result')
    } catch (err) {
      console.error(err)
      setError(`CSV取込に失敗しました: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>CSV取込ウィザード</DialogTitle>
          <DialogClose
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </DialogClose>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div className="text-xs text-gray-500">対象ファイル: {filePath}</div>

          {loading && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              処理中です...
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 'mapping' && plan && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">1. 列マッピング</h3>
                <p className="text-xs text-gray-500">
                  取込対象: {plan.rowCount} 行 / 重複判定ルール: {plan.duplicateRule}
                </p>
                <div className="rounded-md border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">項目</th>
                        <th className="px-3 py-2 text-left">CSV列</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.fieldDefinitions.map((field) => (
                        <tr key={field.key} className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            {field.label}
                            {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                              value={String(mapping[field.key] ?? -1)}
                              onChange={(e) => {
                                const next = Number(e.target.value)
                                setMapping((prev) => ({ ...prev, [field.key]: next }))
                              }}
                            >
                              <option value="-1">未使用</option>
                              {plan.headers.map((header, idx) => (
                                <option key={`${field.key}-${idx}`} value={idx}>
                                  {header || `列${idx + 1}`}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">サンプル行</h3>
                <div className="overflow-auto rounded-md border border-gray-200">
                  <table className="w-full min-w-[720px] text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        {plan.headers.map((h, idx) => (
                          <th key={idx} className="px-2 py-2 text-left font-medium">{h || `列${idx + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plan.sampleRows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-t border-gray-100">
                          {plan.headers.map((_, colIdx) => (
                            <td key={colIdx} className="px-2 py-2 text-gray-700">{row[colIdx] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !canAnalyze}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  重複チェックへ
                </button>
              </div>
            </>
          )}

          {step === 'duplicates' && analysis && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">2. 重複解決</h3>
                <p className="text-xs text-gray-500">
                  有効行: {analysis.validRowCount} / 重複候補: {analysis.duplicates.length}
                </p>
                <p className="text-xs text-gray-500">{analysis.duplicateRule}</p>

                {analysis.errors.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <div className="font-medium">入力エラー ({analysis.errors.length}件)</div>
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {analysis.errors.slice(0, 8).map((msg, idx) => (
                        <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.duplicates.length > 0 ? (
                  <div className="overflow-auto rounded-md border border-gray-200">
                    <table className="w-full min-w-[900px] text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-2 py-2 text-left">行</th>
                          <th className="px-2 py-2 text-left">取込データ</th>
                          <th className="px-2 py-2 text-left">既存データ</th>
                          <th className="px-2 py-2 text-left">対応</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.duplicates.map((dup) => (
                          <tr key={dup.rowNumber} className="border-t border-gray-100">
                            <td className="px-2 py-2">{dup.rowNumber}</td>
                            <td className="px-2 py-2">
                              <div className="font-medium">{dup.incoming.displayName}</div>
                              <div>{formatAddress(dup.incoming)}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="font-medium">{dup.existing.displayName}</div>
                              <div>{formatAddress(dup.existing)}</div>
                            </td>
                            <td className="px-2 py-2">
                              <select
                                className="rounded border border-gray-300 bg-white px-2 py-1"
                                value={resolutions[dup.rowNumber] ?? 'overwrite'}
                                onChange={(e) => handleResolutionChange(dup.rowNumber, e.target.value as DuplicateAction)}
                              >
                                <option value="overwrite">上書き</option>
                                <option value="new">新規作成</option>
                                <option value="skip">スキップ</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    重複候補はありません。このまま取り込みできます。
                  </div>
                )}
              </section>

              <div className="flex justify-between gap-2">
                <button
                  onClick={() => setStep('mapping')}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  戻る
                </button>
                <button
                  onClick={handleExecute}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取り込み実行
                </button>
              </div>
            </>
          )}

          {step === 'result' && result && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">3. 取込結果</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Summary label="対象行" value={result.totalRows} />
                  <Summary label="新規作成" value={result.created} />
                  <Summary label="上書き" value={result.updated} />
                  <Summary label="スキップ" value={result.skipped} />
                  <Summary label="重複処理" value={result.duplicateResolved} />
                  <Summary label="エラー" value={result.errors.length} />
                </div>
                {result.errors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <div className="font-medium">エラー詳細</div>
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {result.errors.slice(0, 12).map((msg, idx) => (
                        <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  閉じる
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatAddress(data: {
  postalCode: string
  prefecture: string
  city: string
  street: string
}) {
  const postal = data.postalCode ? `〒${data.postalCode}` : ''
  return [postal, data.prefecture, data.city, data.street].filter(Boolean).join(' ')
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-800">{value}</div>
    </div>
  )
}
