import { useEffect, useRef } from 'react'
import type { Template } from '../../types'
import {
  applyFontDelta,
  applyMove,
  buildEditableBoxes,
  type EditableFieldId,
} from './labelEditorTemplate'

/** 1mm あたりのピクセル数 (LabelCanvas と同じ定数) */
const MM_TO_PX = 96 / 25.4

interface Props {
  template: Template
  zoom: number
  selectedFieldId: EditableFieldId | null
  onSelectField: (id: EditableFieldId) => void
  onTemplateChange: (t: Template) => void
}

export default function LabelEditorOverlay({
  template,
  zoom,
  selectedFieldId,
  onSelectField,
  onTemplateChange,
}: Props) {
  const boxes = buildEditableBoxes(template)

  const moveListeners = useRef<{
    move: (e: MouseEvent) => void
    up: () => void
    blur: () => void
  } | null>(null)
  const resizeListeners = useRef<{
    move: (e: MouseEvent) => void
    up: () => void
    blur: () => void
  } | null>(null)

  useEffect(() => {
    return () => {
      if (moveListeners.current) {
        window.removeEventListener('mousemove', moveListeners.current.move)
        window.removeEventListener('mouseup', moveListeners.current.up)
        window.removeEventListener('blur', moveListeners.current.blur)
      }
      if (resizeListeners.current) {
        window.removeEventListener('mousemove', resizeListeners.current.move)
        window.removeEventListener('mouseup', resizeListeners.current.up)
        window.removeEventListener('blur', resizeListeners.current.blur)
      }
    }
  }, [])

  function startMove(e: React.MouseEvent, id: EditableFieldId) {
    e.stopPropagation()
    e.preventDefault()
    onSelectField(id)

    if (moveListeners.current) {
      window.removeEventListener('mousemove', moveListeners.current.move)
      window.removeEventListener('mouseup', moveListeners.current.up)
      window.removeEventListener('blur', moveListeners.current.blur)
      moveListeners.current = null
    }

    const startX = e.clientX
    const startY = e.clientY
    const pxPerMm = zoom * MM_TO_PX
    const base = template

    const onMove = (me: MouseEvent) => {
      onTemplateChange(applyMove(base, id, (me.clientX - startX) / pxPerMm, (me.clientY - startY) / pxPerMm))
    }
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
      window.removeEventListener('blur', cleanup)
      moveListeners.current = null
    }
    moveListeners.current = { move: onMove, up: cleanup, blur: cleanup }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
    window.addEventListener('blur', cleanup)
  }

  function startResize(e: React.MouseEvent, id: EditableFieldId, baseFontPt: number) {
    e.stopPropagation()
    e.preventDefault()
    onSelectField(id)

    if (resizeListeners.current) {
      window.removeEventListener('mousemove', resizeListeners.current.move)
      window.removeEventListener('mouseup', resizeListeners.current.up)
      window.removeEventListener('blur', resizeListeners.current.blur)
      resizeListeners.current = null
    }

    const startX = e.clientX
    const pxPerMm = zoom * MM_TO_PX
    const base = template

    const onMove = (me: MouseEvent) => {
      const dxMm = (me.clientX - startX) / pxPerMm
      const nextFont = Math.max(4, Math.round((baseFontPt + dxMm * 1.2) * 2) / 2)
      onTemplateChange(applyFontDelta(base, id, nextFont - baseFontPt))
    }
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
      window.removeEventListener('blur', cleanup)
      resizeListeners.current = null
    }
    resizeListeners.current = { move: onMove, up: cleanup, blur: cleanup }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
    window.addEventListener('blur', cleanup)
  }

  return (
    <>
      {boxes.map((box) => {
        const x = Math.round(box.visualXMm * zoom * MM_TO_PX)
        const y = Math.round(box.visualYMm * zoom * MM_TO_PX)
        const w = Math.max(20, Math.round(box.widthMm * zoom * MM_TO_PX))
        const h = Math.max(16, Math.round(box.heightMm * zoom * MM_TO_PX))
        const selected = box.id === selectedFieldId

        return (
          <div
            key={box.id}
            onMouseDown={(e) => startMove(e, box.id)}
            title={`${box.label}: クリックで編集対象選択 / ドラッグで移動 / 右下ハンドルで文字サイズ調整`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: h,
              border: `${selected ? 2 : 1.5}px dashed ${box.color}`,
              background: selected ? `${box.color}20` : 'transparent',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              cursor: 'move',
              userSelect: 'none',
              zIndex: selected ? 2 : 1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 1,
                top: 1,
                fontSize: Math.max(9, Math.round(10 * zoom)),
                background: `${box.color}d9`,
                color: '#fff',
                borderRadius: 2,
                padding: '0 4px',
                lineHeight: 1.3,
              }}
            >
              {box.label}
            </span>
            <div
              onMouseDown={(e) => startResize(e, box.id, box.fontPt)}
              title="ドラッグでフォントサイズ変更"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 12,
                height: 12,
                background: box.color,
                cursor: 'nwse-resize',
                opacity: 0.9,
              }}
            />
          </div>
        )
      })}
    </>
  )
}
