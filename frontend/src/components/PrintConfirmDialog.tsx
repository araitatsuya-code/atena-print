import { useEffect, useState } from 'react'
import { GenerateLabelPDF, GetTempPDFPath, PrintPDF, SavePDFFileDialog, GetSenders } from '../../wailsjs/go/main/App'
import { entity } from '../../wailsjs/go/models'
import { useContactStore } from '../stores/contactStore'
import { useDecorationStore } from '../stores/decorationStore'
import { useLabelStore } from '../stores/labelStore'
import { useSenderStore } from '../stores/senderStore'
import { useShallow } from 'zustand/shallow'

interface Props {
  onClose: () => void
}

export default function PrintConfirmDialog({ onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSenderId, setSelectedSenderId] = useState('')

  const { contacts, selectedIds } = useContactStore(
    useShallow((s) => ({ contacts: s.contacts, selectedIds: s.selectedIds })),
  )
  const { watermark, qrConfig } = useDecorationStore(
    useShallow((s) => ({ watermark: s.watermark, qrConfig: s.qrConfig })),
  )
  const layout = useLabelStore((s) => s.layout)
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

  const paperLabel = `${layout.paperWidth}×${layout.paperHeight}mm (${layout.columns}列×${layout.rows}行)`

  function buildJob(): entity.PrintJob {
    return entity.PrintJob.createFrom({
      contactIds: selectedContacts.map((c) => c.id),
      template: {
        id: '',
        name: 'default',
        orientation: 'vertical',
        labelWidth: layout.labelWidth,
        labelHeight: layout.labelHeight,
        recipient: { nameX: 0, nameY: 0, nameFont: 0, addressX: 0, addressY: 0, addressFont: 0 },
        sender: { nameX: 0, nameY: 0, nameFont: 0, addressX: 0, addressY: 0, addressFont: 0 },
      },
      senderId: selectedSenderId,
      labelLayout: layout,
      watermark: watermark ?? undefined,
      qrConfig: qrConfig.enabled ? qrConfig : undefined,
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
      await GenerateLabelPDF(buildJob(), savePath)
    })
  }

  function handlePrint() {
    return run(async () => {
      const tmpPath = await GetTempPDFPath()
      const outPath = await GenerateLabelPDF(buildJob(), tmpPath)
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
            <span className="text-gray-500">印刷枚数</span>
            <span className="font-medium">{count} 件</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">用紙</span>
            <span className="font-medium text-right">{paperLabel}</span>
          </div>
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
