import { useEffect, useState } from 'react'
import { GenerateLabelPDF, GetTempPDFPath, PrintPDF, SavePDFFileDialog, GetSenders } from '../../wailsjs/go/main/App'
import { entity } from '../../wailsjs/go/models'
import { useContactStore } from '../stores/contactStore'
import { useDecorationStore } from '../stores/decorationStore'
import { useLabelStore } from '../stores/labelStore'
import { usePreviewStore } from '../stores/previewStore'
import { useSenderStore } from '../stores/senderStore'
import { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_HORIZONTAL } from './preview/LabelCanvas'
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
  const [selectedSenderId, setSelectedSenderId] = useState('')
  const [repeatFill, setRepeatFill] = useState(false)
  const [showBorder, setShowBorder] = useState(false)

  const { contacts, selectedIds } = useContactStore(
    useShallow((s) => ({ contacts: s.contacts, selectedIds: s.selectedIds })),
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

  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id))
  const count = selectedContacts.length
  const labelsPerPage = layout.columns * layout.rows

  const paperLabel = `${layout.paperWidth}×${layout.paperHeight}mm (${layout.columns}列×${layout.rows}行)`

  async function buildJob(): Promise<entity.PrintJob> {
    const defaultTpl = orientation === 'horizontal' ? DEFAULT_TEMPLATE_HORIZONTAL : DEFAULT_TEMPLATE
    const tpl = selectedTemplate
      ? { ...selectedTemplate, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }
      : { ...defaultTpl, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }

    let ids = selectedContacts.map((c) => c.id)
    if (repeatFill && ids.length > 0 && ids.length < labelsPerPage) {
      // シートが埋まるまで繰り返す
      const filled: string[] = []
      while (filled.length < labelsPerPage) {
        filled.push(...ids)
      }
      ids = filled.slice(0, labelsPerPage)
    }

    // 透かしを PDF 用 base64 PNG に変換（プリセットは canvas レンダリング、カスタムは既存 data URL）
    let wmValue: typeof watermark = watermark
    if (watermark && watermark.id !== 'none') {
      const dataUrl = await renderWatermarkToDataURL(watermark, layout.labelWidth, layout.labelHeight)
      if (dataUrl) {
        wmValue = { ...watermark, filePath: dataUrl }
      }
    }

    return entity.PrintJob.createFrom({
      contactIds: ids,
      template: tpl,
      senderId: selectedSenderId,
      labelLayout: layout,
      watermark: wmValue ?? undefined,
      qrConfig: qrConfig.enabled ? qrConfig : undefined,
      showBorder,
    })
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
      await GenerateLabelPDF(await buildJob(), savePath)
    })
  }

  function handlePrint() {
    return run(async () => {
      const tmpPath = await GetTempPDFPath()
      const outPath = await GenerateLabelPDF(await buildJob(), tmpPath)
      await PrintPDF(outPath)
    })
  }

  const selectedSender = senders.find((s) => s.id === selectedSenderId)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-80 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">印刷確認</h2>

        <div className="space-y-2 text-sm text-gray-700">
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
            disabled={loading || count === 0}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '処理中...' : '印刷'}
          </button>
          <button
            onClick={handleSavePDF}
            disabled={loading || count === 0}
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
