import { useEffect, useRef } from 'react'
import type { Template } from '../../types'

/** 1mm あたりのピクセル数 (LabelCanvas と同じ定数) */
const MM_TO_PX = 96 / 25.4

// ── バウンディングボックスの計算 ────────────────────────────────────────────

interface Box {
  id: string
  label: string
  /** 表示上の左端 (mm) */
  visualXMm: number
  /** 表示上の上端 (mm) */
  visualYMm: number
  widthMm: number
  heightMm: number
  fontPt: number
  fontFamily: 'serif' | 'sans-serif'
  bold: boolean
  color: string
}

function buildBoxes(tpl: Template): Box[] {
  const isV = tpl.orientation === 'vertical'
  const lh = tpl.labelHeight
  const lw = tpl.labelWidth
  const boxes: Box[] = []

  // ── 郵便番号 ──────────────────────────────────────────────────────────────
  if (tpl.postalCode) {
    const pc = tpl.postalCode
    boxes.push({
      id: 'postalCode',
      label: '〒 郵便番号',
      visualXMm: pc.x - pc.digitSpacing * 0.4,
      visualYMm: pc.y,
      widthMm: pc.digitSpacing * 8.5,
      heightMm: (pc.fontSize / 2.835) * 1.8,
      fontPt: pc.fontSize,
      fontFamily: pc.fontFamily ?? 'sans-serif',
      bold: pc.bold ?? false,
      color: '#3b82f6',
    })
  }

  const rc = tpl.recipient
  if (isV) {
    // 縦書き: nameX / addressX は右端
    const nw = (rc.nameFont / 2.835) * 2.5
    boxes.push({
      id: 'recipientName',
      label: '宛名',
      visualXMm: rc.nameX - nw,
      visualYMm: rc.nameY,
      widthMm: nw,
      heightMm: Math.max(5, lh - rc.nameY - 2),
      fontPt: rc.nameFont,
      fontFamily: rc.nameFontFamily ?? 'serif',
      bold: rc.nameBold ?? false,
      color: '#10b981',
    })
    const aw = (rc.addressFont / 2.835) * 2.5
    boxes.push({
      id: 'recipientAddr',
      label: '住所',
      visualXMm: rc.addressX - aw,
      visualYMm: rc.addressY,
      widthMm: aw,
      heightMm: Math.max(5, lh - rc.addressY - 2),
      fontPt: rc.addressFont,
      fontFamily: rc.addressFontFamily ?? 'serif',
      bold: rc.addressBold ?? false,
      color: '#f59e0b',
    })
  } else {
    // 横書き: nameX / addressX は左端
    boxes.push({
      id: 'recipientName',
      label: '宛名',
      visualXMm: rc.nameX,
      visualYMm: rc.nameY,
      widthMm: Math.max(10, lw - rc.nameX - 2),
      heightMm: (rc.nameFont / 2.835) * 1.8,
      fontPt: rc.nameFont,
      fontFamily: rc.nameFontFamily ?? 'serif',
      bold: rc.nameBold ?? false,
      color: '#10b981',
    })
    boxes.push({
      id: 'recipientAddr',
      label: '住所',
      visualXMm: rc.addressX,
      visualYMm: rc.addressY,
      widthMm: Math.max(10, lw - rc.addressX - 2),
      heightMm: (rc.addressFont / 2.835) * 3.5,
      fontPt: rc.addressFont,
      fontFamily: rc.addressFontFamily ?? 'serif',
      bold: rc.addressBold ?? false,
      color: '#f59e0b',
    })
  }

  const snd = tpl.sender
  if (isV) {
    const snw = (snd.nameFont / 2.835) * 2.5
    boxes.push({
      id: 'senderName',
      label: '差出人名',
      visualXMm: snd.nameX - snw,
      visualYMm: snd.nameY,
      widthMm: snw,
      heightMm: Math.max(3, Math.min(15, lh - snd.nameY - 1)),
      fontPt: snd.nameFont,
      fontFamily: snd.nameFontFamily ?? 'serif',
      bold: snd.nameBold ?? false,
      color: '#8b5cf6',
    })
    const saw = (snd.addressFont / 2.835) * 2.5
    boxes.push({
      id: 'senderAddr',
      label: '差出人住所',
      visualXMm: snd.addressX - saw,
      visualYMm: snd.addressY,
      widthMm: saw,
      heightMm: Math.max(3, Math.min(12, lh - snd.addressY - 1)),
      fontPt: snd.addressFont,
      fontFamily: snd.addressFontFamily ?? 'serif',
      bold: snd.addressBold ?? false,
      color: '#ec4899',
    })
  } else {
    boxes.push({
      id: 'senderName',
      label: '差出人名',
      visualXMm: snd.nameX,
      visualYMm: snd.nameY,
      widthMm: Math.max(10, lw - snd.nameX - 2),
      heightMm: (snd.nameFont / 2.835) * 1.8,
      fontPt: snd.nameFont,
      fontFamily: snd.nameFontFamily ?? 'serif',
      bold: snd.nameBold ?? false,
      color: '#8b5cf6',
    })
    boxes.push({
      id: 'senderAddr',
      label: '差出人住所',
      visualXMm: snd.addressX,
      visualYMm: snd.addressY,
      widthMm: Math.max(10, lw - snd.addressX - 2),
      heightMm: (snd.addressFont / 2.835) * 1.8,
      fontPt: snd.addressFont,
      fontFamily: snd.addressFontFamily ?? 'serif',
      bold: snd.addressBold ?? false,
      color: '#ec4899',
    })
  }

  return boxes
}

// ── テンプレート更新ヘルパー ────────────────────────────────────────────────

function applyMove(tpl: Template, id: string, dxMm: number, dyMm: number): Template {
  const r = (v: number) => Math.round(v * 10) / 10
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return { ...tpl, postalCode: { ...tpl.postalCode, x: r(tpl.postalCode.x + dxMm), y: r(tpl.postalCode.y + dyMm) } }
    case 'recipientName':
      return { ...tpl, recipient: { ...tpl.recipient, nameX: r(tpl.recipient.nameX + dxMm), nameY: r(tpl.recipient.nameY + dyMm) } }
    case 'recipientAddr':
      return { ...tpl, recipient: { ...tpl.recipient, addressX: r(tpl.recipient.addressX + dxMm), addressY: r(tpl.recipient.addressY + dyMm) } }
    case 'senderName':
      return { ...tpl, sender: { ...tpl.sender, nameX: r(tpl.sender.nameX + dxMm), nameY: r(tpl.sender.nameY + dyMm) } }
    case 'senderAddr':
      return { ...tpl, sender: { ...tpl.sender, addressX: r(tpl.sender.addressX + dxMm), addressY: r(tpl.sender.addressY + dyMm) } }
    default:
      return tpl
  }
}

/** fontPt を delta だけ変更 (0.5pt 刻み・最小 4pt) */
function applyFontDelta(tpl: Template, id: string, delta: number): Template {
  const r = (v: number) => Math.max(4, Math.round(v * 2) / 2)
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return { ...tpl, postalCode: { ...tpl.postalCode, fontSize: r(tpl.postalCode.fontSize + delta) } }
    case 'recipientName':
      return { ...tpl, recipient: { ...tpl.recipient, nameFont: r(tpl.recipient.nameFont + delta) } }
    case 'recipientAddr':
      return { ...tpl, recipient: { ...tpl.recipient, addressFont: r(tpl.recipient.addressFont + delta) } }
    case 'senderName':
      return { ...tpl, sender: { ...tpl.sender, nameFont: r(tpl.sender.nameFont + delta) } }
    case 'senderAddr':
      return { ...tpl, sender: { ...tpl.sender, addressFont: r(tpl.sender.addressFont + delta) } }
    default:
      return tpl
  }
}

/** フォントファミリーを変更 */
function applyFontFamily(tpl: Template, id: string, family: 'serif' | 'sans-serif'): Template {
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return { ...tpl, postalCode: { ...tpl.postalCode, fontFamily: family } }
    case 'recipientName':
      return { ...tpl, recipient: { ...tpl.recipient, nameFontFamily: family } }
    case 'recipientAddr':
      return { ...tpl, recipient: { ...tpl.recipient, addressFontFamily: family } }
    case 'senderName':
      return { ...tpl, sender: { ...tpl.sender, nameFontFamily: family } }
    case 'senderAddr':
      return { ...tpl, sender: { ...tpl.sender, addressFontFamily: family } }
    default:
      return tpl
  }
}

/** 太字フラグをトグル */
function applyBold(tpl: Template, id: string, bold: boolean): Template {
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return { ...tpl, postalCode: { ...tpl.postalCode, bold } }
    case 'recipientName':
      return { ...tpl, recipient: { ...tpl.recipient, nameBold: bold } }
    case 'recipientAddr':
      return { ...tpl, recipient: { ...tpl.recipient, addressBold: bold } }
    case 'senderName':
      return { ...tpl, sender: { ...tpl.sender, nameBold: bold } }
    case 'senderAddr':
      return { ...tpl, sender: { ...tpl.sender, addressBold: bold } }
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

export default function LabelEditorOverlay({ template, zoom, onTemplateChange }: Props) {
  const boxes = buildBoxes(template)

  // 移動ドラッグ用 refs
  const moveListeners = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null)
  // リサイズドラッグ用 refs
  const resizeListeners = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null)

  useEffect(() => {
    return () => {
      if (moveListeners.current) {
        window.removeEventListener('mousemove', moveListeners.current.move)
        window.removeEventListener('mouseup', moveListeners.current.up)
      }
      if (resizeListeners.current) {
        window.removeEventListener('mousemove', resizeListeners.current.move)
        window.removeEventListener('mouseup', resizeListeners.current.up)
      }
    }
  }, [])

  /** ボックス本体ドラッグ → 位置移動 */
  function startMove(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const pxPerMm = zoom * MM_TO_PX
    const base = template

    const onMove = (me: MouseEvent) => {
      onTemplateChange(applyMove(base, id, (me.clientX - startX) / pxPerMm, (me.clientY - startY) / pxPerMm))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      moveListeners.current = null
    }
    moveListeners.current = { move: onMove, up: onUp }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  /** 右下ハンドルドラッグ → フォントサイズ変更 (1.2pt/mm) */
  function startResize(e: React.MouseEvent, id: string, baseFontPt: number) {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const pxPerMm = zoom * MM_TO_PX
    const base = template

    const onMove = (me: MouseEvent) => {
      const dxMm = (me.clientX - startX) / pxPerMm
      const newFont = Math.max(4, Math.round((baseFontPt + dxMm * 1.2) * 2) / 2)
      onTemplateChange(applyFontDelta(base, id, newFont - baseFontPt))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      resizeListeners.current = null
    }
    resizeListeners.current = { move: onMove, up: onUp }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <>
      {boxes.map((box) => {
        const x = Math.round(box.visualXMm * zoom * MM_TO_PX)
        const y = Math.round(box.visualYMm * zoom * MM_TO_PX)
        const w = Math.max(20, Math.round(box.widthMm * zoom * MM_TO_PX))
        const h = Math.max(16, Math.round(box.heightMm * zoom * MM_TO_PX))
        const fs = Math.max(7, Math.round(8 * zoom))

        return (
          <div
            key={box.id}
            onMouseDown={(e) => startMove(e, box.id)}
            title={`${box.label}: ドラッグで移動 / 右下ハンドルでフォントサイズ変更`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: h,
              border: `1.5px dashed ${box.color}`,
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              cursor: 'move',
              userSelect: 'none',
            }}
          >
            {/* コントロールバッジ (右上・半透明) */}
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, position: 'absolute', top: 1, right: 1 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* フォントサイズ行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onTemplateChange(applyFontDelta(template, box.id, -0.5)) }}
                  style={{ fontSize: fs, padding: '0 2px', cursor: 'pointer', background: `${box.color}cc`, border: 'none', color: '#fff', borderRadius: 2, lineHeight: 1 }}
                >−</button>
                <span style={{ fontSize: fs, minWidth: 24, textAlign: 'center', background: `${box.color}cc`, color: '#fff', borderRadius: 2, padding: '0 2px', lineHeight: 1 }}>{box.fontPt}pt</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTemplateChange(applyFontDelta(template, box.id, +0.5)) }}
                  style={{ fontSize: fs, padding: '0 2px', cursor: 'pointer', background: `${box.color}cc`, border: 'none', color: '#fff', borderRadius: 2, lineHeight: 1 }}
                >＋</button>
              </div>
              {/* フォントスタイル行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* 太字トグル */}
                <button
                  onClick={(e) => { e.stopPropagation(); onTemplateChange(applyBold(template, box.id, !box.bold)) }}
                  title="太字"
                  style={{ fontSize: fs, padding: '0 3px', cursor: 'pointer', border: 'none', color: '#fff', borderRadius: 2, lineHeight: 1, fontWeight: 'bold',
                    background: box.bold ? box.color : `${box.color}88` }}
                >B</button>
                {/* 明朝トグル */}
                <button
                  onClick={(e) => { e.stopPropagation(); onTemplateChange(applyFontFamily(template, box.id, 'serif')) }}
                  title="明朝体"
                  style={{ fontSize: fs, padding: '0 2px', cursor: 'pointer', border: 'none', color: '#fff', borderRadius: 2, lineHeight: 1,
                    background: box.fontFamily === 'serif' ? box.color : `${box.color}88` }}
                >明</button>
                {/* ゴシックトグル */}
                <button
                  onClick={(e) => { e.stopPropagation(); onTemplateChange(applyFontFamily(template, box.id, 'sans-serif')) }}
                  title="ゴシック体"
                  style={{ fontSize: fs, padding: '0 2px', cursor: 'pointer', border: 'none', color: '#fff', borderRadius: 2, lineHeight: 1,
                    background: box.fontFamily === 'sans-serif' ? box.color : `${box.color}88` }}
                >ゴ</button>
              </div>
            </div>

            {/* リサイズハンドル (右下) */}
            <div
              onMouseDown={(e) => startResize(e, box.id, box.fontPt)}
              title="ドラッグでフォントサイズ変更"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 10,
                height: 10,
                background: box.color,
                cursor: 'nwse-resize',
                opacity: 0.85,
              }}
            />
          </div>
        )
      })}
    </>
  )
}
