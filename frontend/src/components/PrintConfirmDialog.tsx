import { useEffect, useState } from 'react'
import {
  CheckUnsupportedCharacters,
  GenerateLabelPDF,
  GetTempPDFPath,
  PrintPDF,
  SavePDFFileDialog,
  GetSenders,
  GetContactYearStatuses,
  MarkContactsSentForYear,
} from '../../wailsjs/go/main/App'
import { entity } from '../../wailsjs/go/models'
import { useContactStore } from '../stores/contactStore'
import { useDecorationStore } from '../stores/decorationStore'
import { useLabelStore } from '../stores/labelStore'
import { usePreviewStore } from '../stores/previewStore'
import { useSenderStore } from '../stores/senderStore'
import type { ContactYearStatus } from '../types'
import { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_HORIZONTAL } from './preview/LabelCanvas'
import { renderLabelSnapshotsToDataURLBatch } from '../lib/labelSnapshot'
import { useShallow } from 'zustand/shallow'

interface Props {
  onClose: () => void
}

/** プリセット透かし絵文字マップ (WatermarkLayer と同じ定義) */
const PRESET_EMOJIS: Record<string, string> = {
  sakura: '🌸',
  wave: '🌊',
  bamboo: '🎋',
  fuji: '🗻',
  crane: '🦢',
}

/**
 * 透かしをオフスクリーン canvas にレンダリングして base64 PNG data URL を返す。
 * - preset: 絵文字タイルパターンを描画
 * - custom: filePath が既に data URL のためそのまま返す
 */
async function renderWatermarkToDataURL(
  wm: { type: string; id: string; filePath: string; opacity: number },
  widthMm: number,
  heightMm: number,
): Promise<string> {
  if (wm.type === 'custom' && wm.filePath) {
    return wm.filePath // already a data URL
  }
  const emoji = PRESET_EMOJIS[wm.id]
  if (!emoji) return ''

  const pxPerMm = 3
  const w = Math.round(widthMm * pxPerMm)
  const h = Math.round(heightMm * pxPerMm)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.globalAlpha = wm.opacity
  const fontSize = 24
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const step = Math.round(fontSize * 2.2)
  let row = 0
  for (let y = fontSize; y < h + fontSize; y += step) {
    const xStart = row % 2 === 0 ? fontSize : fontSize + step / 2
    for (let x = xStart; x < w + fontSize; x += step) {
      ctx.fillText(emoji, x, y)
    }
    row++
  }
  return canvas.toDataURL('image/png')
}

export default function PrintConfirmDialog({ onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unsupportedWarnings, setUnsupportedWarnings] = useState<entity.UnsupportedCharacterWarning[]>([])
  const [unsupportedCheckLoading, setUnsupportedCheckLoading] = useState(false)
  const [unsupportedCheckError, setUnsupportedCheckError] = useState<string | null>(null)
  const [selectedSenderId, setSelectedSenderId] = useState('')
  const [repeatFill, setRepeatFill] = useState(false)
  const [showBorder, setShowBorder] = useState(false)
  const [targetOnly, setTargetOnly] = useState(true)
  const [excludeMourning, setExcludeMourning] = useState(false)
  const [unsentOnly, setUnsentOnly] = useState(false)

  const {
    contacts,
    annualStatusYear,
    annualStatuses,
    annualStatusesLoadedYear,
    annualStatusesLoading,
    setAnnualStatusesLoading,
    setAnnualStatuses,
    upsertAnnualStatuses,
  } = useContactStore(
    useShallow((s) => ({
      contacts: s.contacts,
      annualStatusYear: s.annualStatusYear,
      annualStatuses: s.annualStatuses,
      annualStatusesLoadedYear: s.annualStatusesLoadedYear,
      annualStatusesLoading: s.annualStatusesLoading,
      setAnnualStatusesLoading: s.setAnnualStatusesLoading,
      setAnnualStatuses: s.setAnnualStatuses,
      upsertAnnualStatuses: s.upsertAnnualStatuses,
    })),
  )
  const { watermark, qrConfig } = useDecorationStore(
    useShallow((s) => ({ watermark: s.watermark, qrConfig: s.qrConfig })),
  )
  const { layout, orientation } = useLabelStore(
    useShallow((s) => ({ layout: s.layout, orientation: s.orientation })),
  )
  const { selectedTemplate } = usePreviewStore(
    useShallow((s) => ({ selectedTemplate: s.selectedTemplate })),
  )
  const { senders, setSenders } = useSenderStore(
    useShallow((s) => ({ senders: s.senders, setSenders: s.setSenders })),
  )

  useEffect(() => {
    GetSenders()
      .then((list) => {
        const loaded = list ?? []
        setSenders(loaded)
        const def = loaded.find((s) => s.isDefault)
        if (def) setSelectedSenderId(def.id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (annualStatusesLoadedYear === annualStatusYear || annualStatusesLoading) {
      return
    }
    const requestYear = annualStatusYear
    let active = true
    setAnnualStatusesLoading(true)
    GetContactYearStatuses(requestYear)
      .then((list) => {
        if (!active) return
        setAnnualStatuses(requestYear, list ?? [])
      })
      .catch((err) => {
        console.error(err)
        if (active && useContactStore.getState().annualStatusYear === requestYear) {
          setAnnualStatusesLoading(false)
        }
      })
    return () => {
      active = false
      if (useContactStore.getState().annualStatusYear === requestYear) {
        setAnnualStatusesLoading(false)
      }
    }
  }, [annualStatusYear, annualStatusesLoadedYear, setAnnualStatuses, setAnnualStatusesLoading])

  const withPrintTargetFilter = targetOnly
    ? contacts.filter((c) => c.isPrintTarget)
    : contacts
  const requiresAnnualStatuses = excludeMourning || unsentOnly
  const annualStatusesReady = annualStatusesLoadedYear === annualStatusYear && !annualStatusesLoading
  const annualFilterReady = !requiresAnnualStatuses || annualStatusesReady
  const printableContacts = annualFilterReady
    ? withPrintTargetFilter.filter((contact) => {
        const annual = annualStatuses[contact.id]
        if (excludeMourning && annual?.mourning) {
          return false
        }
        if (unsentOnly && annual?.sent) {
          return false
        }
        return true
      })
    : []
  const printTargetCount = contacts.filter((c) => c.isPrintTarget).length
  const totalContacts = contacts.length
  const additionalCount = Math.max(0, totalContacts - printTargetCount)
  const filteredByAnnualCount = annualFilterReady
    ? Math.max(0, withPrintTargetFilter.length - printableContacts.length)
    : 0
  const count = printableContacts.length
  const printableContactIDs = Array.from(new Set(printableContacts.map((c) => c.id)))
  const isPrintActionDisabled = loading || unsupportedCheckLoading || count === 0 || !annualFilterReady
  const labelsPerPage = layout.columns * layout.rows

  const paperLabel = `${layout.paperWidth}×${layout.paperHeight}mm (${layout.columns}列×${layout.rows}行)`
  const printableContactKey = printableContacts.map((c) => c.id).join(',')

  function resolveTemplateAndContactIDs() {
    const defaultTpl = orientation === 'horizontal' ? DEFAULT_TEMPLATE_HORIZONTAL : DEFAULT_TEMPLATE
    const tpl = selectedTemplate
      ? { ...selectedTemplate, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }
      : { ...defaultTpl, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }

    let ids = printableContacts.map((c) => c.id)
    if (repeatFill && ids.length > 0 && ids.length < labelsPerPage) {
      // シートが埋まるまで繰り返す
      const filled: string[] = []
      while (filled.length < labelsPerPage) {
        filled.push(...ids)
      }
      ids = filled.slice(0, labelsPerPage)
    }

    return { tpl, ids }
  }

  useEffect(() => {
    if (!annualFilterReady || count === 0) {
      setUnsupportedWarnings([])
      setUnsupportedCheckError(null)
      setUnsupportedCheckLoading(false)
      return
    }

    const defaultTpl = orientation === 'horizontal' ? DEFAULT_TEMPLATE_HORIZONTAL : DEFAULT_TEMPLATE
    const tpl = selectedTemplate
      ? { ...selectedTemplate, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }
      : { ...defaultTpl, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }
    let ids = printableContacts.map((c) => c.id)
    if (repeatFill && ids.length > 0 && ids.length < labelsPerPage) {
      const filled: string[] = []
      while (filled.length < labelsPerPage) {
        filled.push(...ids)
      }
      ids = filled.slice(0, labelsPerPage)
    }
    const checkJob = entity.PrintJob.createFrom({
      contactIds: ids,
      template: tpl,
      senderId: selectedSenderId,
      labelLayout: layout,
      showBorder,
    })

    let active = true
    setUnsupportedCheckLoading(true)
    setUnsupportedCheckError(null)

    CheckUnsupportedCharacters(checkJob)
      .then((warnings) => {
        if (!active) return
        setUnsupportedWarnings(warnings ?? [])
      })
      .catch((e) => {
        if (!active) return
        setUnsupportedWarnings([])
        setUnsupportedCheckError(formatError(e))
      })
      .finally(() => {
        if (active) {
          setUnsupportedCheckLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [
    annualFilterReady,
    count,
    printableContactKey,
    repeatFill,
    labelsPerPage,
    orientation,
    selectedTemplate,
    layout,
    selectedSenderId,
    showBorder,
  ])

  async function buildJob(includeLabelImages: boolean): Promise<entity.PrintJob> {
    const { tpl, ids } = resolveTemplateAndContactIDs()

    // 透かしを PDF 用 base64 PNG に変換（プリセットは canvas レンダリング、カスタムは既存 data URL）
    // 互換フォールバック時は変換失敗を許容し、旧経路での継続を優先する。
    let wmValue: typeof watermark = watermark
    if (watermark && watermark.id !== 'none') {
      try {
        const dataUrl = await renderWatermarkToDataURL(watermark, layout.labelWidth, layout.labelHeight)
        if (dataUrl) {
          wmValue = { ...watermark, filePath: dataUrl }
        }
      } catch (e) {
        if (includeLabelImages) {
          throw e
        }
      }
    }
    const activeWatermark = wmValue && wmValue.id !== 'none' ? wmValue : undefined
    const activeQR = qrConfig.enabled ? qrConfig : undefined

    if (!includeLabelImages) {
      return entity.PrintJob.createFrom({
        contactIds: ids,
        template: tpl,
        senderId: selectedSenderId,
        labelLayout: layout,
        watermark: activeWatermark,
        qrConfig: activeQR,
        showBorder,
      })
    }

    const contactByID = new Map(printableContacts.map((c) => [c.id, c]))
    const snapshotInputs = ids.map((id) => {
      const contact = contactByID.get(id)
      if (!contact) {
        throw new Error(`contact not found: ${id}`)
      }
      return {
        contact,
        template: tpl,
        watermark: activeWatermark ?? null,
        qrConfig: activeQR,
        showBorder: false,
      }
    })
    const snapshots = await renderLabelSnapshotsToDataURLBatch(snapshotInputs)
    const labelImageDataURLs = snapshots.map((s) => s.dataURL)

    return entity.PrintJob.createFrom({
      contactIds: ids,
      template: tpl,
      senderId: selectedSenderId,
      labelLayout: layout,
      labelImageDataURLs,
      watermark: activeWatermark,
      qrConfig: activeQR,
      showBorder,
    })
  }

  function formatError(e: unknown): string {
    if (e instanceof Error && e.message) {
      return e.message
    }
    return String(e)
  }

  async function markPrintedAsSent() {
    if (printableContactIDs.length === 0) return
    const requestYear = annualStatusYear
    await MarkContactsSentForYear(printableContactIDs, requestYear)

    const now = new Date().toISOString()
    const updatedStatuses: ContactYearStatus[] = printableContactIDs.map((contactID) => {
      const current = annualStatuses[contactID]
      return {
        contactId: contactID,
        year: requestYear,
        sent: true,
        received: current?.received ?? false,
        mourning: current?.mourning ?? false,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      }
    })
    if (useContactStore.getState().annualStatusYear === requestYear) {
      upsertAnnualStatuses(updatedStatuses)
    }
  }

  async function generateLabelPDFWithFallback(outPath: string): Promise<string> {
    try {
      const imageJob = await buildJob(true)
      return await GenerateLabelPDF(imageJob, outPath)
    } catch (imageErr) {
      console.warn('Image-based print path failed, retrying legacy path:', imageErr)
      try {
        const legacyJob = await buildJob(false)
        return await GenerateLabelPDF(legacyJob, outPath)
      } catch (legacyErr) {
        throw new Error(
          `PDF生成に失敗しました（新経路: ${formatError(imageErr)} / フォールバック: ${formatError(legacyErr)}）`,
        )
      }
    }
  }

  async function run(action: () => Promise<void>) {
    setError(null)
    setLoading(true)
    try {
      await action()
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function handleSavePDF() {
    return run(async () => {
      const savePath = await SavePDFFileDialog('ラベル.pdf')
      if (!savePath) return
      await generateLabelPDFWithFallback(savePath)
    })
  }

  function handlePrint() {
    return run(async () => {
      const tmpPath = await GetTempPDFPath()
      const outPath = await generateLabelPDFWithFallback(tmpPath)
      await PrintPDF(outPath)
      await markPrintedAsSent()
    })
  }

  const selectedSender = senders.find((s) => s.id === selectedSenderId)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-80 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">印刷確認</h2>

        <div className="space-y-2 text-sm text-gray-700">
          <p className="text-xs text-gray-500">年次ステータス対象年: {annualStatusYear}年</p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={targetOnly}
              onChange={(e) => setTargetOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            <span className="text-gray-600">印刷対象のみを抽出する</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeMourning}
              onChange={(e) => setExcludeMourning(e.target.checked)}
              className="w-3.5 h-3.5 accent-rose-600"
            />
            <span className="text-gray-600">喪中受領を除外する</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unsentOnly}
              onChange={(e) => setUnsentOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            <span className="text-gray-600">未送付のみを抽出する</span>
          </label>
          {!targetOnly && additionalCount > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              印刷対象OFFの連絡先を {additionalCount} 件含めて印刷します。
            </p>
          )}
          {filteredByAnnualCount > 0 && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
              年次ステータス条件で {filteredByAnnualCount} 件を除外しています。
            </p>
          )}
          {!annualFilterReady && requiresAnnualStatuses && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              年次ステータスを読み込み中です。読み込み完了後に抽出・印刷できます。
            </p>
          )}
          {unsupportedCheckLoading && count > 0 && annualFilterReady && (
            <p className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1">
              文字対応を確認中です...
            </p>
          )}
          {unsupportedCheckError && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              未対応文字チェックに失敗しました。印刷時に文字化けがないか確認してください。
            </p>
          )}
          {unsupportedWarnings.length > 0 && (
            <div className="text-xs text-amber-900 bg-amber-50 rounded px-2 py-2 space-y-1">
              <p className="font-medium">未対応文字の可能性があります（印刷前確認）</p>
              {unsupportedWarnings.slice(0, 5).map((warning) => (
                <p key={`${warning.contactId}-${warning.characters.join('')}`}>
                  {warning.contactName || warning.contactId}: {warning.characters.join(' ')}
                </p>
              ))}
              {unsupportedWarnings.length > 5 && (
                <p>ほか {unsupportedWarnings.length - 5} 件</p>
              )}
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">印刷件数</span>
            <span className="font-medium">{repeatFill && count < labelsPerPage ? labelsPerPage : count} 件</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">用紙</span>
            <span className="font-medium text-right">{paperLabel}</span>
          </div>
          {count < labelsPerPage && (
            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={repeatFill}
                onChange={(e) => setRepeatFill(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600"
              />
              <span className="text-gray-600">
                シートを埋めるまで繰り返す（{labelsPerPage} 面）
              </span>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={showBorder}
              onChange={(e) => setShowBorder(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            <span className="text-gray-600">ラベル枠線を印刷する</span>
          </label>
          <p className="text-xs text-gray-500">印刷実行後、対象宛先を {annualStatusYear} 年の送付済みに自動更新します。</p>
        </div>

        {/* 差出人選択 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">差出人</label>
          <select
            value={selectedSenderId}
            onChange={(e) => setSelectedSenderId(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">なし</option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.familyName} {s.givenName}
                {s.company ? ` (${s.company})` : ''}
                {s.isDefault ? ' ★' : ''}
              </option>
            ))}
          </select>
          {selectedSender && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              〒{selectedSender.postalCode} {selectedSender.prefecture}{selectedSender.city}{selectedSender.street}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handlePrint}
            disabled={isPrintActionDisabled}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '処理中...' : '印刷'}
          </button>
          <button
            onClick={handleSavePDF}
            disabled={isPrintActionDisabled}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            PDF保存
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
