import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useContactStore } from '../../stores/contactStore'
import { usePreviewStore } from '../../stores/previewStore'
import { useDecorationStore } from '../../stores/decorationStore'
import LabelCanvas, { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_HORIZONTAL } from './LabelCanvas'
import LabelEditorOverlay from './LabelEditorOverlay'
import LabelGridOverlay from './LabelGridOverlay'
import WatermarkLayer from './WatermarkLayer'
import QROverlay from './QROverlay'
import { useLabelStore } from '../../stores/labelStore'
import type { Contact, Template, Watermark, QRConfig } from '../../types'
import {
  applyBold,
  applyFontDelta,
  applyFontFamily,
  applyMove,
  buildEditableBoxes,
  getEditableFieldInspectorValue,
  setEditableFieldFontPt,
  setEditableFieldPosition,
  type EditableFieldId,
} from './labelEditorTemplate'

/** 1mm あたりのピクセル数 (96 dpi 基準) — LabelCanvas と同じ定数 */
const MM_TO_PX = 96 / 25.4

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4.0
const ZOOM_STEP = 0.25
const KEYBOARD_FINE_STEP_MM = 0.1
const KEYBOARD_COARSE_STEP_MM = 1.0

function isEditableInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  )
}

function parseInputNumber(rawValue: string): number | null {
  const parsed = Number.parseFloat(rawValue)
  return Number.isFinite(parsed) ? parsed : null
}

export default function PreviewArea() {
  const { contacts } = useContactStore(
    useShallow((s) => ({ contacts: s.contacts })),
  )
  const {
    zoom,
    selectedTemplate,
    previewContactIndex,
    setZoom,
    setPreviewContactIndex,
    setSelectedTemplate,
  } = usePreviewStore(
    useShallow((s) => ({
      zoom: s.zoom,
      selectedTemplate: s.selectedTemplate,
      previewContactIndex: s.previewContactIndex,
      setZoom: s.setZoom,
      setPreviewContactIndex: s.setPreviewContactIndex,
      setSelectedTemplate: s.setSelectedTemplate,
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

  const selectedContacts = contacts.filter((c) => c.isPrintTarget)

  // 選択件数が減ったときにインデックスを範囲内にクランプ
  useEffect(() => {
    if (selectedContacts.length === 0) return
    const clamped = Math.min(previewContactIndex, selectedContacts.length - 1)
    if (clamped !== previewContactIndex) {
      setPreviewContactIndex(clamped)
    }
  }, [selectedContacts.length, previewContactIndex, setPreviewContactIndex])

  // 書字方向が変わったら保存済みテンプレートをリセット (縦書き用の座標を横書きに流用しない)
  useEffect(() => {
    if (selectedTemplate && selectedTemplate.orientation !== orientation) {
      setSelectedTemplate(null)
    }
  }, [orientation, selectedTemplate, setSelectedTemplate])

  const safeIndex = Math.max(0, Math.min(previewContactIndex, selectedContacts.length - 1))
  const currentContact: Contact | null = selectedContacts[safeIndex] ?? null

  const defaultTpl = orientation === 'horizontal' ? DEFAULT_TEMPLATE_HORIZONTAL : DEFAULT_TEMPLATE
  const template: Template = selectedTemplate
    ? { ...selectedTemplate, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }
    : { ...defaultTpl, orientation, labelWidth: layout.labelWidth, labelHeight: layout.labelHeight }

  const zoomIn = () => setZoom(Math.min(ZOOM_MAX, Math.round((zoom + ZOOM_STEP) * 100) / 100))
  const zoomOut = () => setZoom(Math.max(ZOOM_MIN, Math.round((zoom - ZOOM_STEP) * 100) / 100))
  const zoomReset = () => setZoom(1)

  // 要素配置変更ハンドラ
  function handleTemplateChange(updated: Template) {
    setSelectedTemplate(updated)
  }

  // グリッド表示フラグ (ローカル状態)
  const [showGrid, setShowGrid] = useState(false)
  // フォント編集対象フィールド
  const [selectedFieldId, setSelectedFieldId] = useState<EditableFieldId | null>(null)
  const latestTemplateRef = useRef(template)

  useEffect(() => {
    latestTemplateRef.current = template
  }, [template])

  // ── 背景ドラッグ: 印刷位置補正オフセット ─────────────────────────────────

  const [dragLive, setDragLive] = useState<{ x: number; y: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const onMoveRef = useRef<((me: MouseEvent) => void) | null>(null)
  const onUpRef = useRef<((me: MouseEvent) => void) | null>(null)

  // アンマウント時にリスナーを確実に除去
  useEffect(() => {
    return () => {
      if (onMoveRef.current) window.removeEventListener('mousemove', onMoveRef.current)
      if (onUpRef.current) window.removeEventListener('mouseup', onUpRef.current)
      dragStart.current = null
    }
  }, [])

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const start = {
      x: e.clientX,
      y: e.clientY,
      ox: layout.offsetX,
      oy: layout.offsetY,
    }
    dragStart.current = start

    const calcOffset = (me: MouseEvent) => {
      const pxPerMm = zoom * MM_TO_PX
      return {
        x: Math.round((start.ox + (me.clientX - start.x) / pxPerMm) * 10) / 10,
        y: Math.round((start.oy + (me.clientY - start.y) / pxPerMm) * 10) / 10,
      }
    }

    const onMove = (me: MouseEvent) => {
      setDragLive(calcOffset(me))
    }

    const onUp = (me: MouseEvent) => {
      const final = calcOffset(me)
      setLayout({ offsetX: final.x, offsetY: final.y })
      setDragLive(null)
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      onMoveRef.current = null
      onUpRef.current = null
    }

    onMoveRef.current = onMove
    onUpRef.current = onUp
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ツールバー表示: ドラッグ中はライブ値、それ以外はストアの値
  const displayOffset = dragLive ?? { x: layout.offsetX, y: layout.offsetY }
  const hasOffset = displayOffset.x !== 0 || displayOffset.y !== 0
  const editableBoxes = buildEditableBoxes(template)
  const selectedBox = editableBoxes.find((box) => box.id === selectedFieldId) ?? null
  const selectedInspector = selectedFieldId
    ? getEditableFieldInspectorValue(template, selectedFieldId)
    : null

  useEffect(() => {
    if (editableBoxes.length === 0) {
      if (selectedFieldId !== null) setSelectedFieldId(null)
      return
    }
    if (selectedFieldId && editableBoxes.some((box) => box.id === selectedFieldId)) return
    setSelectedFieldId(editableBoxes[0].id)
  }, [editableBoxes, selectedFieldId])

  function updateSelectedField(
    updater: (tpl: Template, fieldId: EditableFieldId) => Template,
  ) {
    if (!selectedFieldId) return
    handleTemplateChange(updater(template, selectedFieldId))
  }

  function updateSelectedPositionFromInput(axis: 'x' | 'y', rawValue: string) {
    if (!selectedFieldId || !selectedInspector) return
    const parsed = parseInputNumber(rawValue)
    if (parsed === null) return

    const nextX = axis === 'x' ? parsed : selectedInspector.xMm
    const nextY = axis === 'y' ? parsed : selectedInspector.yMm
    handleTemplateChange(setEditableFieldPosition(template, selectedFieldId, nextX, nextY))
  }

  function updateSelectedFontFromInput(rawValue: string) {
    if (!selectedFieldId) return
    const parsed = parseInputNumber(rawValue)
    if (parsed === null) return
    handleTemplateChange(setEditableFieldFontPt(template, selectedFieldId, parsed))
  }

  useEffect(() => {
    if (!currentContact || !selectedFieldId) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableInputTarget(event.target)) return
      const step = event.shiftKey ? KEYBOARD_COARSE_STEP_MM : KEYBOARD_FINE_STEP_MM
      let dx = 0
      let dy = 0

      switch (event.key) {
        case 'ArrowLeft':
          dx = -step
          break
        case 'ArrowRight':
          dx = step
          break
        case 'ArrowUp':
          dy = -step
          break
        case 'ArrowDown':
          dy = step
          break
        default:
          return
      }

      event.preventDefault()
      handleTemplateChange(applyMove(latestTemplateRef.current, selectedFieldId, dx, dy))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentContact, selectedFieldId])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f0f0]">
      {/* ツールバー */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
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
                補正: X {displayOffset.x.toFixed(1)} / Y {displayOffset.y.toFixed(1)} mm
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
          {/* グリッドトグル */}
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              showGrid
                ? 'bg-slate-600 text-white border-slate-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
            title="グリッド表示切り替え (5mm)"
          >
            グリッド
          </button>
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

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-gray-100 bg-gray-50">
          <span className="text-xs font-medium text-gray-700">文字設定</span>

          <div className="flex flex-wrap items-center gap-1 rounded border border-gray-300 bg-white p-1">
            {editableBoxes.length === 0 && (
              <span className="px-2 text-xs text-gray-500">編集項目なし</span>
            )}
            {editableBoxes.map((box) => {
              const selected = box.id === selectedFieldId
              return (
                <button
                  key={box.id}
                  onClick={() => setSelectedFieldId(box.id)}
                  disabled={!currentContact}
                  className={`h-7 rounded px-2 text-xs border transition-colors inline-flex items-center gap-1.5 ${
                    selected
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  } disabled:opacity-40`}
                  title={`${box.label} を編集`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: box.color }}
                  />
                  {box.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">サイズ</span>
            <button
              onClick={() => updateSelectedField((tpl, id) => applyFontDelta(tpl, id, -0.5))}
              disabled={!selectedInspector}
              className="h-8 w-8 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              title="文字サイズを小さくする"
            >
              −
            </button>
            <input
              type="number"
              step={0.5}
              value={selectedInspector ? selectedInspector.fontPt.toFixed(1) : ''}
              onChange={(e) => updateSelectedFontFromInput(e.target.value)}
              disabled={!selectedInspector}
              className="h-8 w-20 rounded border border-gray-300 bg-white px-2 text-right text-xs text-gray-700 disabled:opacity-40"
              title="フォントサイズ (pt)"
            />
            <span className="text-xs text-gray-500">pt</span>
            <button
              onClick={() => updateSelectedField((tpl, id) => applyFontDelta(tpl, id, 0.5))}
              disabled={!selectedInspector}
              className="h-8 w-8 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              title="文字サイズを大きくする"
            >
              ＋
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">X</span>
            <input
              type="number"
              step={0.1}
              value={selectedInspector ? selectedInspector.xMm.toFixed(1) : ''}
              onChange={(e) => updateSelectedPositionFromInput('x', e.target.value)}
              disabled={!selectedInspector}
              className="h-8 w-20 rounded border border-gray-300 bg-white px-2 text-right text-xs text-gray-700 disabled:opacity-40"
              title="X 座標 (mm)"
            />
            <span className="text-xs text-gray-500">mm</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Y</span>
            <input
              type="number"
              step={0.1}
              value={selectedInspector ? selectedInspector.yMm.toFixed(1) : ''}
              onChange={(e) => updateSelectedPositionFromInput('y', e.target.value)}
              disabled={!selectedInspector}
              className="h-8 w-20 rounded border border-gray-300 bg-white px-2 text-right text-xs text-gray-700 disabled:opacity-40"
              title="Y 座標 (mm)"
            />
            <span className="text-xs text-gray-500">mm</span>
          </div>

          <div className="flex items-center rounded border border-gray-300 overflow-hidden">
            <button
              onClick={() => updateSelectedField((tpl, id) => applyFontFamily(tpl, id, 'serif'))}
              disabled={!selectedBox}
              className={`h-8 px-3 text-xs transition-colors ${
                selectedBox?.fontFamily === 'serif'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              } disabled:opacity-40`}
              title="明朝体"
            >
              明朝
            </button>
            <button
              onClick={() =>
                updateSelectedField((tpl, id) => applyFontFamily(tpl, id, 'sans-serif'))
              }
              disabled={!selectedBox}
              className={`h-8 px-3 text-xs border-l border-gray-300 transition-colors ${
                selectedBox?.fontFamily === 'sans-serif'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              } disabled:opacity-40`}
              title="ゴシック体"
            >
              ゴシック
            </button>
          </div>

          <button
            onClick={() => updateSelectedField((tpl, id) => applyBold(tpl, id, !selectedBox?.bold))}
            disabled={!selectedBox}
            className={`h-8 px-3 rounded border text-xs transition-colors ${
              selectedBox?.bold
                ? 'bg-slate-700 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
            } disabled:opacity-40`}
            title="太字切替"
          >
            太字
          </button>

          <span className="text-[11px] text-gray-500">
            矢印キーで 0.1mm、Shift+矢印で 1.0mm 移動。ドラッグと数値は同期。
          </span>
        </div>
      </div>

      {/* キャンバスエリア */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6">
        {currentContact ? (
          // オフセット補正を CSS transform で可視化。
          // 背景ドラッグ → 印刷位置補正 / カラーハンドルドラッグ → 要素個別配置
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'relative',
              display: 'inline-block',
              transform: `translate(${displayOffset.x * zoom * MM_TO_PX}px, ${displayOffset.y * zoom * MM_TO_PX}px)`,
              transition: dragLive ? 'none' : 'transform 0.1s ease',
              cursor: dragLive ? 'grabbing' : 'grab',
            }}
            title="背景ドラッグ: 印刷位置補正 / カラーハンドルドラッグ: 要素の位置調整"
          >
            <LabelStack
              contact={currentContact}
              template={template}
              zoom={zoom}
              watermark={watermark}
              qrConfig={qrConfig}
            />
            {/* グリッドオーバーレイ */}
            {showGrid && (
              <LabelGridOverlay
                labelWidthMm={template.labelWidth}
                labelHeightMm={template.labelHeight}
                zoom={zoom}
              />
            )}
            {/* 要素配置ハンドル (pointer-events: none のラッパー内で各ハンドルだけ auto) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <LabelEditorOverlay
                template={template}
                zoom={zoom}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onTemplateChange={handleTemplateChange}
              />
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">住所録で印刷対象をONにしてください</p>
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
