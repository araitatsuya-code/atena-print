import { useEffect, useMemo, useState } from 'react'
import {
  ApplyAddressNormalization,
  GetAddressNormalizationPreview,
  RollbackAddressNormalization,
} from '../../../wailsjs/go/main/App'
import type {
  AddressNormalizationApplyResult,
  AddressNormalizationCandidate,
  AddressNormalizationPreview,
  AddressNormalizationRollbackResult,
  AddressNormalizationSelection,
} from '../../types'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'

interface Props {
  onClose: () => void
  onCompleted: () => Promise<void>
}

type Step = 'preview' | 'confirm' | 'result'

export default function AddressNormalizationDialog({ onClose, onCompleted }: Props) {
  const [step, setStep] = useState<Step>('preview')
  const [loading, setLoading] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<AddressNormalizationPreview | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<AddressNormalizationApplyResult | null>(null)

  const loadPreview = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await GetAddressNormalizationPreview()
      const typed = res as AddressNormalizationPreview
      setPreview(typed)
      setSelectedIds(new Set((typed.candidates ?? []).map((c) => c.contactId)))
    } catch (err) {
      console.error(err)
      setError(`正規化候補の取得に失敗しました: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPreview()
  }, [])

  const selectedCandidates = useMemo(() => {
    if (!preview) return [] as AddressNormalizationCandidate[]
    return preview.candidates.filter((candidate) => selectedIds.has(candidate.contactId))
  }, [preview, selectedIds])

  const toggleSelection = (contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) {
        next.delete(contactId)
      } else {
        next.add(contactId)
      }
      return next
    })
  }

  const handleApply = async () => {
    if (!preview) return
    setLoading(true)
    setError(null)
    try {
      const selections: AddressNormalizationSelection[] = preview.candidates.map((candidate) => ({
        contactId: candidate.contactId,
        apply: selectedIds.has(candidate.contactId),
      }))
      const applied = await ApplyAddressNormalization(selections)
      const typed = applied as AddressNormalizationApplyResult
      setResult(typed)
      await onCompleted()
      await loadPreview()
      setStep('result')
    } catch (err) {
      console.error(err)
      setError(`一括更新に失敗しました: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async (batchID?: string) => {
    if (!batchID || rollingBack) return
    setRollingBack(true)
    setError(null)
    setNotice(null)
    try {
      const rolled = await RollbackAddressNormalization(batchID)
      const typed = rolled as AddressNormalizationRollbackResult
      await onCompleted()
      setResult(null)
      setStep('preview')
      await loadPreview()
      setNotice(`ロールバック完了: ${typed.restoredCount}件復元しました。`)
    } catch (err) {
      console.error(err)
      setError(`ロールバックに失敗しました: ${String(err)}`)
    } finally {
      setRollingBack(false)
    }
  }

  const canProceedConfirm = selectedCandidates.length > 0

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>住所正規化（旧住所→新住所）</DialogTitle>
          <DialogClose
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </DialogClose>
        </DialogHeader>

        <div className="p-5 space-y-4">
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
          {notice && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          {step === 'preview' && preview && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">1. 候補プレビュー</h3>
                <p className="text-xs text-gray-500">
                  全連絡先: {preview.totalContacts}件 / 変換候補: {preview.convertibleCount}件 / 適用予定: {selectedCandidates.length}件
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setSelectedIds(new Set(preview.candidates.map((c) => c.contactId)))}
                      className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      disabled={preview.candidates.length === 0}
                    >
                      すべて適用
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      disabled={preview.candidates.length === 0}
                    >
                      すべて除外
                    </button>
                  </div>
                  {preview.canRollback && preview.rollbackBatchId && (
                    <button
                      onClick={() => void handleRollback(preview.rollbackBatchId)}
                      disabled={rollingBack}
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      前回更新をロールバック
                    </button>
                  )}
                </div>

                {preview.candidates.length > 0 ? (
                  <div className="overflow-auto rounded-md border border-gray-200">
                    <table className="w-full min-w-[900px] text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-2 py-2 text-left">適用</th>
                          <th className="px-2 py-2 text-left">連絡先</th>
                          <th className="px-2 py-2 text-left">郵便番号</th>
                          <th className="px-2 py-2 text-left">変更前</th>
                          <th className="px-2 py-2 text-left">変更後</th>
                          <th className="px-2 py-2 text-left">差分</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.candidates.map((candidate) => (
                          <tr key={candidate.contactId} className="border-t border-gray-100">
                            <td className="px-2 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(candidate.contactId)}
                                onChange={() => toggleSelection(candidate.contactId)}
                                className="mt-0.5 h-3.5 w-3.5 accent-blue-600"
                              />
                            </td>
                            <td className="px-2 py-2 align-top">{candidate.displayName || '(名称未設定)'}</td>
                            <td className="px-2 py-2 align-top">{formatPostalCode(candidate.postalCode)}</td>
                            <td className="px-2 py-2 align-top">{formatAddress(candidate.before)}</td>
                            <td className="px-2 py-2 align-top">{formatAddress(candidate.after)}</td>
                            <td className="px-2 py-2 align-top">
                              {candidate.diffs.map((diff) => (
                                <div key={`${candidate.contactId}-${diff.field}`}>
                                  {fieldLabel(diff.field)}: {diff.before || '(空)'} → {diff.after || '(空)'}
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    現時点で変換候補はありません。
                  </div>
                )}
              </section>

              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  閉じる
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!canProceedConfirm || loading}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  差分確認へ
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && preview && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">2. 差分確認</h3>
                <p className="text-xs text-gray-500">
                  適用対象: {selectedCandidates.length}件
                </p>
                <div className="overflow-auto rounded-md border border-gray-200">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-2 text-left">連絡先</th>
                        <th className="px-2 py-2 text-left">変更前</th>
                        <th className="px-2 py-2 text-left">変更後</th>
                        <th className="px-2 py-2 text-left">差分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCandidates.map((candidate) => (
                        <tr key={candidate.contactId} className="border-t border-gray-100">
                          <td className="px-2 py-2 align-top">{candidate.displayName || '(名称未設定)'}</td>
                          <td className="px-2 py-2 align-top">{formatAddress(candidate.before)}</td>
                          <td className="px-2 py-2 align-top">{formatAddress(candidate.after)}</td>
                          <td className="px-2 py-2 align-top">
                            {candidate.diffs.map((diff) => (
                              <div key={`${candidate.contactId}-confirm-${diff.field}`}>
                                {fieldLabel(diff.field)}: {diff.before || '(空)'} → {diff.after || '(空)'}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="flex justify-between gap-2">
                <button
                  onClick={() => setStep('preview')}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  戻る
                </button>
                <button
                  onClick={() => void handleApply()}
                  disabled={loading || selectedCandidates.length === 0}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  確定して更新
                </button>
              </div>
            </>
          )}

          {step === 'result' && result && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">3. 更新結果</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Summary label="更新成功" value={result.appliedCount} />
                  <Summary label="スキップ" value={result.skippedCount} />
                  <Summary label="失敗" value={result.failedCount} />
                  <Summary label="ロールバック可" value={result.canRollback ? 1 : 0} />
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

              <div className="flex justify-end gap-2">
                {result.canRollback && result.batchId && (
                  <button
                    onClick={() => void handleRollback(result.batchId)}
                    disabled={rollingBack}
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    この更新をロールバック
                  </button>
                )}
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

function formatPostalCode(postalCode: string) {
  if (!postalCode) return ''
  const digits = postalCode.replace(/\D/g, '')
  if (digits.length !== 7) return postalCode
  return `〒${digits.slice(0, 3)}-${digits.slice(3)}`
}

function formatAddress(address: { prefecture: string; city: string; street: string }) {
  return [address.prefecture, address.city, address.street].filter(Boolean).join('')
}

function fieldLabel(field: string) {
  if (field === 'prefecture') return '都道府県'
  if (field === 'city') return '市区町村'
  if (field === 'street') return '番地'
  return field
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-800">{value}</div>
    </div>
  )
}
