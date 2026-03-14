import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { useContactStore } from '../../stores/contactStore'
import { usePreviewStore } from '../../stores/previewStore'
import { useDecorationStore } from '../../stores/decorationStore'
import LabelCanvas, { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_HORIZONTAL } from './LabelCanvas'
import WatermarkLayer from './WatermarkLayer'
import QROverlay from './QROverlay'
import { useLabelStore } from '../../stores/labelStore'
import type { Contact, Template, Watermark, QRConfig } from '../../types'

/** 1mm あたりのピクセル数 (96 dpi 基準) — LabelCanvas と同じ定数 */
const MM_TO_PX = 96 / 25.4

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4.0
const ZOOM_STEP = 0.25

export default function PreviewArea() {
  const { contacts, selectedIds } = useContactStore(
    useShallow((s) => ({ contacts: s.contacts, selectedIds: s.selectedIds })),
  )
  const { zoom, selectedTemplate, previewContactIndex, setZoom, setPreviewContactIndex } =
    usePreviewStore(
      useShallow((s) => ({
        zoom: s.zoom,
        selectedTemplate: s.selectedTemplate,
        previewContactIndex: s.previewContactIndex,
        setZoom: s.setZoom,
        setPreviewContactIndex: s.setPreviewContactIndex,
      })),
    )
  const { watermark, qrConfig } = useDecorationStore(
    useShallow((s) => ({ watermark: s.watermark, qrConfig: s.qrConfig })),
  )
  const { orientation, layout, setLayout, resetOffset } = useLabelStore(
    useShallow((s) => ({
      orientation: s.orientation,
      layout: s.layout,
      setLayout: s.setLayout,
      resetOffset: s.resetOffset,
    })),
  )

  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id))

  // 選択件数が減ったときにインデックスを範囲内にクランプ
  useEffect(() => {
    if (selectedContacts.length === 0) return
    const clamped = Math.min(previewContactIndex, selectedContacts.length - 1)
    if (clamped !== previewContactIndex) {
      setPreviewContactIndex(clamped)
    }
  }, [selectedContacts.length, previewContactIndex, setPreviewContactIndex])

  const safeIndex = Math.max(0, Math.min(previewContactIndex, selectedContacts.length - 1))
  const currentContact: Contact | null = selectedContacts[safeIndex] ?? null

  const defaultTpl = orientation === 'horizontal' ? DEFAULT_TEMPLATE_HORIZONTAL : DEFAULT_TEMPLATE
  const template: Template = selectedTemplate
    ? { ...selectedTemplate, orientation }
    : { ...defaultTpl, orientation }

  const zoomIn = () => setZoom(Math.min(ZOOM_MAX, Math.round((zoom + ZOOM_STEP) * 100) / 100))
  const zoomOut = () => setZoom(Math.max(ZOOM_MIN, Math.round((zoom - ZOOM_STEP) * 100) / 100))
  const zoomReset = () => setZoom(1)

  // ドラッグ状態
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const isDragging = useRef(false)

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: layout.offsetX,
      oy: layout.offsetY,
    }
    isDragging.current = false

    const onMove = (me: MouseEvent) => {
      if (!dragStart.current) return
      const dx = me.clientX - dragStart.current.x
      const dy = me.clientY - dragStart.current.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        isDragging.current = true
      }
      const pxPerMm = zoom * MM_TO_PX
      const newOx = Math.round((dragStart.current.ox + dx / pxPerMm) * 10) / 10
      const newOy = Math.round((dragStart.current.oy + dy / pxPerMm) * 10) / 10
      setLayout({ offsetX: newOx, offsetY: newOy })
    }

    const onUp = () => {
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const hasOffset = layout.offsetX !== 0 || layout.offsetY !== 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f0f0]">
      {/* ツールバー */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <span className="text-sm font-medium text-gray-700 mr-auto">
          {template.name}
          {selectedContacts.length > 0 && (
            <span className="ml-2 text-xs text-gray-400">
              {safeIndex + 1} / {selectedContacts.length} 件
            </span>
          )}
        </span>
        {/* オフセット表示 */}
        {currentContact && hasOffset && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <span>
              補正: X {layout.offsetX.toFixed(1)} / Y {layout.offsetY.toFixed(1)} mm
            </span>
            <button
              onClick={resetOffset}
              className="underline hover:text-amber-800"
              title="補正を初期値に戻す"
            >
              リセット
            </button>
          </div>
        )}
        {/* ズームコントロール */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
            aria-label="ズームアウト"
          >
            −
          </button>
          <button
            onClick={zoomReset}
            className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 min-w-[52px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
            aria-label="ズームイン"
          >
            ＋
          </button>
        </div>
      </div>

      {/* キャンバスエリア */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6">
        {currentContact ? (
          <div
            onMouseDown={handleMouseDown}
            style={{ cursor: 'grab' }}
            title="ドラッグで印刷位置を微調整"
          >
            <LabelStack
              contact={currentContact}
              template={template}
              zoom={zoom}
              watermark={watermark}
              qrConfig={qrConfig}
            />
          </div>
        ) : (
          <p className="text-gray-400 text-sm">住所録から連絡先を選択してください</p>
        )}
      </div>

      {/* サムネイルナビゲーション (複数選択時) */}
      {selectedContacts.length > 1 && (
        <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          {selectedContacts.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setPreviewContactIndex(i)}
              className={`shrink-0 flex flex-col items-center gap-1 p-1 rounded border-2 transition-colors ${
                i === safeIndex
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-transparent hover:border-gray-300'
              }`}
              title={`${c.familyName} ${c.givenName}`}
            >
              {/* サムネイル */}
              <div className="overflow-hidden rounded" style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
                <LabelStack
                  contact={c}
                  template={template}
                  zoom={0.35}
                  watermark={watermark}
                  qrConfig={qrConfig}
                />
              </div>
              <span className="text-[10px] text-gray-600 max-w-[80px] truncate">
                {c.familyName} {c.givenName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** LabelCanvas + WatermarkLayer + QROverlay の積み重ねコンテナ */
interface LabelStackProps {
  contact: Contact
  template: Template
  zoom: number
  watermark: Watermark | null
  qrConfig: QRConfig
}

function LabelStack({ contact, template, zoom, watermark, qrConfig }: LabelStackProps) {
  return (
    <div className="relative shadow-md" style={{ display: 'inline-block' }}>
      <LabelCanvas contact={contact} template={template} zoom={zoom} />
      <WatermarkLayer
        watermark={watermark}
        labelWidth={template.labelWidth}
        labelHeight={template.labelHeight}
        zoom={zoom}
      />
      <QROverlay
        qrConfig={qrConfig}
        labelWidth={template.labelWidth}
        labelHeight={template.labelHeight}
        zoom={zoom}
      />
    </div>
  )
}
