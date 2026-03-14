import { useEffect, useRef } from 'react'
import type { Template } from '../../types'

/** 1mm あたりのピクセル数 (LabelCanvas と同じ定数) */
const MM_TO_PX = 96 / 25.4

// ── ハンドル定義 ────────────────────────────────────────────────────────────

interface Handle {
  id: string
  label: string
  xMm: number
  yMm: number
  color: string
}

function buildHandles(tpl: Template): Handle[] {
  const isV = tpl.orientation === 'vertical'
  const handles: Handle[] = []

  if (tpl.postalCode) {
    handles.push({
      id: 'postalCode',
      label: '〒',
      xMm: tpl.postalCode.x,
      yMm: tpl.postalCode.y,
      color: '#3b82f6',
    })
  }

  handles.push({
    id: 'recipientName',
    label: '宛名',
    // 縦書き: nameX は右端なので少し左にずらしてハンドルを表示
    xMm: isV ? tpl.recipient.nameX - 5 : tpl.recipient.nameX,
    yMm: tpl.recipient.nameY,
    color: '#10b981',
  })

  handles.push({
    id: 'recipientAddr',
    label: '住所',
    xMm: isV ? tpl.recipient.addressX - 4 : tpl.recipient.addressX,
    yMm: tpl.recipient.addressY,
    color: '#f59e0b',
  })

  handles.push({
    id: 'senderName',
    label: '差出',
    xMm: isV ? tpl.sender.nameX - 3 : tpl.sender.nameX,
    yMm: tpl.sender.nameY,
    color: '#8b5cf6',
  })

  handles.push({
    id: 'senderAddr',
    label: '差住',
    xMm: isV ? tpl.sender.addressX - 2 : tpl.sender.addressX,
    yMm: tpl.sender.addressY,
    color: '#ec4899',
  })

  return handles
}

// ── テンプレート座標の更新 ──────────────────────────────────────────────────

function applyDelta(tpl: Template, id: string, dxMm: number, dyMm: number): Template {
  const r = (v: number) => Math.round(v * 10) / 10
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return {
        ...tpl,
        postalCode: {
          ...tpl.postalCode,
          x: r(tpl.postalCode.x + dxMm),
          y: r(tpl.postalCode.y + dyMm),
        },
      }
    case 'recipientName':
      return {
        ...tpl,
        recipient: {
          ...tpl.recipient,
          nameX: r(tpl.recipient.nameX + dxMm),
          nameY: r(tpl.recipient.nameY + dyMm),
        },
      }
    case 'recipientAddr':
      return {
        ...tpl,
        recipient: {
          ...tpl.recipient,
          addressX: r(tpl.recipient.addressX + dxMm),
          addressY: r(tpl.recipient.addressY + dyMm),
        },
      }
    case 'senderName':
      return {
        ...tpl,
        sender: {
          ...tpl.sender,
          nameX: r(tpl.sender.nameX + dxMm),
          nameY: r(tpl.sender.nameY + dyMm),
        },
      }
    case 'senderAddr':
      return {
        ...tpl,
        sender: {
          ...tpl.sender,
          addressX: r(tpl.sender.addressX + dxMm),
          addressY: r(tpl.sender.addressY + dyMm),
        },
      }
    default:
      return tpl
  }
}

// ── コンポーネント ──────────────────────────────────────────────────────────

interface Props {
  template: Template
  zoom: number
  onTemplateChange: (t: Template) => void
}

/**
 * ラベルキャンバス上に重ねて表示する要素配置ハンドル。
 * 各ハンドルをドラッグすると対応するテンプレート座標が更新される。
 */
export default function LabelEditorOverlay({ template, zoom, onTemplateChange }: Props) {
  const handles = buildHandles(template)
  const onMoveRef = useRef<((e: MouseEvent) => void) | null>(null)
  const onUpRef = useRef<((e: MouseEvent) => void) | null>(null)

  useEffect(() => {
    return () => {
      if (onMoveRef.current) window.removeEventListener('mousemove', onMoveRef.current)
      if (onUpRef.current) window.removeEventListener('mouseup', onUpRef.current)
    }
  }, [])

  function handleDragStart(e: React.MouseEvent, handleId: string) {
    e.stopPropagation() // オフセットドラッグへのバブリングを防ぐ
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    const pxPerMm = zoom * MM_TO_PX
    // ドラッグ開始時点のテンプレートをキャプチャ
    const baseTemplate = template

    const onMove = (me: MouseEvent) => {
      const dxMm = (me.clientX - startX) / pxPerMm
      const dyMm = (me.clientY - startY) / pxPerMm
      onTemplateChange(applyDelta(baseTemplate, handleId, dxMm, dyMm))
    }

    const onUp = () => {
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

  return (
    <>
      {handles.map((h) => (
        <div
          key={h.id}
          onMouseDown={(e) => handleDragStart(e, h.id)}
          title={`${h.label}をドラッグして位置調整`}
          style={{
            position: 'absolute',
            left: Math.round(h.xMm * zoom * MM_TO_PX),
            top: Math.round(h.yMm * zoom * MM_TO_PX),
            cursor: 'move',
            userSelect: 'none',
            background: h.color,
            color: '#fff',
            fontSize: Math.max(8, Math.round(9 * zoom)),
            padding: '1px 4px',
            borderRadius: 3,
            opacity: 0.72,
            whiteSpace: 'nowrap',
            lineHeight: 1.5,
            pointerEvents: 'auto',
            zIndex: 10,
          }}
        >
          {h.label}
        </div>
      ))}
    </>
  )
}
