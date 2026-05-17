import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { SaveContact } from '../../../wailsjs/go/main/App'
import { useContactStore } from '../../stores/contactStore'
import { usePreviewStore } from '../../stores/previewStore'
import { useDecorationStore } from '../../stores/decorationStore'
import LabelCanvas from './LabelCanvas'
import { resolveTemplate } from '../../lib/labelPresets'
import LabelEditorOverlay from './LabelEditorOverlay'
import LabelGridOverlay from './LabelGridOverlay'
import WatermarkLayer from './WatermarkLayer'
import QROverlay from './QROverlay'
import { Popover } from '../ui/popover'
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
const ZOOM_MAX = 8.0
const ZOOM_STEP = 0.25
const KEYBOARD_FINE_STEP_MM = 0.1
const KEYBOARD_COARSE_STEP_MM = 1.0
const SAVE_TIMEOUT_MS = 10_000

type EditableContactField =
  | 'postalCode'
  | 'familyName'
  | 'givenName'
  | 'honorific'
  | 'company'
  | 'department'
  | 'prefecture'
  | 'city'
  | 'street'
  | 'building'

interface ContentDraft {
  contactId: string
  patch: Partial<Pick<Contact, EditableContactField>>
}

const EDITABLE_FIELDS_BY_BOX: Record<EditableFieldId, EditableContactField[]> = {
  postalCode: ['postalCode'],
  recipientName: ['familyName', 'givenName', 'honorific', 'company', 'department'],
  recipientAddr: ['prefecture', 'city', 'street', 'building'],
}

const EDITABLE_FIELD_LABELS: Record<EditableContactField, string> = {
  postalCode: '郵便番号',
  familyName: '姓',
  givenName: '名',
  honorific: '敬称',
  company: '会社',
  department: '部署',
  prefecture: '都道府県',
  city: '市区町村',
  street: '番地',
  building: '建物',
}

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

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

export default function PreviewArea() {
  const { contacts, setContacts } = useContactStore(
    useShallow((s) => ({ contacts: s.contacts, setContacts: s.setContacts })),
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

  // 書字方向またはラベル寸法が変わったら、整合しなくなった保存済みテンプレートを破棄
  useEffect(() => {
    if (!selectedTemplate) return
    const orientationMismatch = selectedTemplate.orientation !== orientation
    const widthMismatch = Math.abs(selectedTemplate.labelWidth - layout.labelWidth) >= 0.5
    const heightMismatch = Math.abs(selectedTemplate.labelHeight - layout.labelHeight) >= 0.5
    if (orientationMismatch || widthMismatch || heightMismatch) {
      setSelectedTemplate(null)
    }
  }, [orientation, layout.labelWidth, layout.labelHeight, selectedTemplate, setSelectedTemplate])

  const safeIndex = Math.max(0, Math.min(previewContactIndex, selectedContacts.length - 1))
  const currentContact: Contact | null = selectedContacts[safeIndex] ?? null

  const template: Template = resolveTemplate(
    selectedTemplate,
    layout.labelWidth,
    layout.labelHeight,
    orientation,
  )

  const zoomIn = () => setZoom(clampZoom(Math.round((zoom + ZOOM_STEP) * 100) / 100))
  const zoomOut = () => setZoom(clampZoom(Math.round((zoom - ZOOM_STEP) * 100) / 100))

  // 要素配置変更ハンドラ
  function handleTemplateChange(updated: Template) {
    setSelectedTemplate(updated)
  }

  // グリッド表示フラグ (ローカル状態)
  const [showGrid, setShowGrid] = useState(false)
  // 文字設定リボン (2段目) の表示フラグ
  const [showFieldRibbon, setShowFieldRibbon] = useState(true)
  // フォント編集対象フィールド
  const [selectedFieldId, setSelectedFieldId] = useState<EditableFieldId | null>(null)
  // 内容編集ドラフト（選択中連絡先のみ）
  const [contentDraft, setContentDraft] = useState<ContentDraft | null>(null)
  const [contentSaving, setContentSaving] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)
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
  const currentZoomPct = Math.round(zoom * 100)
  const zoomPresets = [50, 75, 100, 125, 150, 200, 300, 400, 600, 800]
  const zoomOptions = zoomPresets.includes(currentZoomPct)
    ? zoomPresets
    : [...zoomPresets, currentZoomPct].sort((a, b) => a - b)
  const selectedBox = editableBoxes.find((box) => box.id === selectedFieldId) ?? null
  const selectedInspector = selectedFieldId
    ? getEditableFieldInspectorValue(template, selectedFieldId)
    : null
  const selectedEditableFields = selectedFieldId ? EDITABLE_FIELDS_BY_BOX[selectedFieldId] : []
  const mergedCurrentContact =
    currentContact && contentDraft?.contactId === currentContact.id
      ? { ...currentContact, ...contentDraft.patch }
      : currentContact
  const hasContentDraft =
    !!currentContact &&
    !!contentDraft &&
    contentDraft.contactId === currentContact.id &&
    Object.keys(contentDraft.patch).length > 0

  useEffect(() => {
    if (editableBoxes.length === 0) {
      if (selectedFieldId !== null) setSelectedFieldId(null)
      return
    }
    if (selectedFieldId && editableBoxes.some((box) => box.id === selectedFieldId)) return
    setSelectedFieldId(editableBoxes[0].id)
  }, [editableBoxes, selectedFieldId])

  useEffect(() => {
    setContentError(null)
    setContentDraft((prev) => {
      if (!currentContact) return null
      if (prev && prev.contactId === currentContact.id) return prev
      return null
    })
  }, [currentContact])

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

  function getEditableFieldValue(field: EditableContactField): string {
    if (!currentContact) return ''
    if (contentDraft?.contactId === currentContact.id && contentDraft.patch[field] !== undefined) {
      return contentDraft.patch[field] ?? ''
    }
    return currentContact[field]
  }

  function updateEditableFieldValue(field: EditableContactField, value: string) {
    if (!currentContact) return
    setContentError(null)
    setContentDraft((prev) => {
      const base = prev?.contactId === currentContact.id ? prev : { contactId: currentContact.id, patch: {} }
      const nextPatch = { ...base.patch }
      if (currentContact[field] === value) {
        delete nextPatch[field]
      } else {
        nextPatch[field] = value
      }
      if (Object.keys(nextPatch).length === 0) return null
      return { contactId: currentContact.id, patch: nextPatch }
    })
  }

  function cancelEditableContent() {
    setContentDraft(null)
    setContentError(null)
  }

  async function saveEditableContent() {
    if (!currentContact || !contentDraft || contentDraft.contactId !== currentContact.id) return
    setContentSaving(true)
    setContentError(null)
    try {
      const saved = await withTimeout(
        SaveContact({
          ...currentContact,
          ...contentDraft.patch,
        } as Parameters<typeof SaveContact>[0]),
        SAVE_TIMEOUT_MS,
        '保存処理がタイムアウトしました。',
      )
      const latest = useContactStore.getState().contacts
      setContacts(latest.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)))
      setContentDraft(null)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : '内容の保存に失敗しました。再度お試しください。'
      setContentError(message)
    } finally {
      setContentSaving(false)
    }
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
    <div className="relative flex-1 flex flex-col overflow-hidden bg-slate-200">
      {/* ツールバー */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-2 mr-auto min-w-0">
            <span className="text-sm font-medium text-gray-700 truncate">
              {template.name}
            </span>
            {selectedContacts.length > 0 && (
              <span className="text-xs text-gray-400 shrink-0">
                {safeIndex + 1} / {selectedContacts.length} 件
              </span>
            )}
            {/* オフセット表示 (バッジ) */}
            {currentContact && hasOffset && (
              <span className="inline-flex items-center gap-1 shrink-0 pl-2 pr-1 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
                <span aria-hidden="true">⚠</span>
                <span>
                  補正 X {displayOffset.x.toFixed(1)} / Y {displayOffset.y.toFixed(1)} mm
                </span>
                <button
                  type="button"
                  onClick={resetOffset}
                  className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-600 hover:bg-amber-100 hover:text-amber-800"
                  title="補正を初期値に戻す"
                  aria-label="補正をリセット"
                >
                  ×
                </button>
              </span>
            )}
          </div>
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
              className="h-8 w-8 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
              aria-label="ズームアウト"
            >
              −
            </button>
            <Popover
              triggerLabel={`${currentZoomPct}%`}
              triggerClassName="h-8 px-3 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100 min-w-[64px] text-center"
              triggerTitle="表示倍率を選択"
              align="right"
            >
              {(close) => (
                <div className="flex flex-col py-1 min-w-[88px]">
                  {zoomOptions.map((pct) => {
                    const isCurrent = pct === currentZoomPct
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setZoom(clampZoom(pct / 100))
                          close()
                        }}
                        className={`px-3 py-1 text-xs text-right hover:bg-gray-100 ${
                          isCurrent ? 'text-blue-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    )
                  })}
                </div>
              )}
            </Popover>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              className="h-8 w-8 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
              aria-label="ズームイン"
            >
              ＋
            </button>
          </div>
          {/* 文字設定リボン折りたたみトグル */}
          <button
            onClick={() => setShowFieldRibbon((v) => !v)}
            className="h-8 px-2 inline-flex items-center gap-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100"
            title={showFieldRibbon ? '文字設定を折りたたむ' : '文字設定を展開'}
            aria-expanded={showFieldRibbon}
          >
            <span aria-hidden="true" className="text-[10px]">
              {showFieldRibbon ? '▴' : '▾'}
            </span>
            文字設定
          </button>
        </div>

        {showFieldRibbon && (
        <div className="flex flex-wrap items-stretch gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50">
          {/* Block A: 対象選択 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">対象</span>
            <div className="flex flex-wrap items-center gap-1">
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
                    className={`h-7 rounded-md px-2 text-xs border transition-colors inline-flex items-center gap-1.5 ${
                      selected
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    } disabled:opacity-40`}
                    style={selected ? { boxShadow: `0 0 0 2px ${box.color}55` } : undefined}
                    title={`${box.label} を編集`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        selected ? 'ring-2 ring-white ring-offset-0' : ''
                      }`}
                      style={{ backgroundColor: box.color }}
                    />
                    {box.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="w-px bg-gray-200 self-stretch" aria-hidden="true" />

          {/* Block B: 内容編集 */}
          <div
            className={`flex items-center gap-2 -mx-1 px-2 py-0.5 rounded-md transition-colors ${
              hasContentDraft ? 'bg-amber-50 ring-1 ring-amber-200' : ''
            }`}
          >
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">内容</span>
            {hasContentDraft && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                未保存
              </span>
            )}
            <div className="flex flex-wrap items-center gap-1">
              {!currentContact && (
                <span className="px-1 text-xs text-gray-400">印刷対象を選択してください</span>
              )}
              {currentContact && selectedEditableFields.length === 0 && (
                <span className="px-1 text-xs text-gray-400">編集項目を選択してください</span>
              )}
              {currentContact &&
                selectedEditableFields.map((field) => (
                  <label key={field} className="flex items-center gap-1 pl-1">
                    <span className="text-[11px] text-gray-500">{EDITABLE_FIELD_LABELS[field]}</span>
                    <input
                      type="text"
                      value={getEditableFieldValue(field)}
                      onChange={(e) => updateEditableFieldValue(field, e.target.value)}
                      disabled={contentSaving}
                      className="h-8 min-w-[86px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-700 disabled:opacity-40"
                    />
                  </label>
                ))}
            </div>
          </div>

          <div className="w-px bg-gray-200 self-stretch" aria-hidden="true" />

          {/* Block C: 形状編集 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">形状</span>
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
          </div>

          <Popover
            triggerLabel="?"
            triggerClassName="ml-auto h-7 w-7 rounded-full border border-gray-300 bg-white text-xs text-gray-500 hover:bg-gray-100"
            triggerTitle="操作ヘルプを表示"
            triggerAriaLabel="操作ヘルプを表示"
            align="right"
          >
            {() => (
              <div className="w-72 p-3 text-xs text-gray-600 space-y-2">
                <p>
                  <span className="font-medium text-gray-700">移動: </span>
                  矢印キーで 0.1mm、Shift+矢印で 1.0mm 移動。ドラッグと数値は同期。
                </p>
                <p>
                  <span className="font-medium text-gray-700">内容編集: </span>
                  入力は即時プレビュー反映。「確定」で保存、「キャンセル」で破棄。
                </p>
              </div>
            )}
          </Popover>
          {contentError && (
            <span className="text-[11px] text-red-600">{contentError}</span>
          )}
        </div>
        )}
      </div>

      {/* キャンバスエリア */}
      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex items-center justify-center p-6">
        {mergedCurrentContact ? (
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
              contact={mergedCurrentContact}
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
                  contact={contentDraft?.contactId === c.id ? { ...c, ...contentDraft.patch } : c}
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

      {/* フローティング確定バー (内容ドラフト中のみ) — overflow-auto の外側に配置してズーム時もビューポートに固定 */}
      {(hasContentDraft || contentSaving) && (
        <div
          className={`pointer-events-none absolute inset-x-0 flex justify-center z-20 ${
            selectedContacts.length > 1 ? 'bottom-28' : 'bottom-4'
          }`}
        >
          <div className="pointer-events-auto inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white shadow-lg ring-1 ring-amber-200">
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <span aria-hidden="true">●</span>
              内容に未保存の変更があります
            </span>
            <button
              type="button"
              onClick={cancelEditableContent}
              disabled={contentSaving}
              className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => void saveEditableContent()}
              disabled={contentSaving}
              className="h-8 rounded-md bg-blue-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-70"
            >
              {contentSaving ? '保存中...' : '確定'}
            </button>
          </div>
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
    <div className="relative shadow-lg ring-1 ring-black/5" style={{ display: 'inline-block' }}>
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
