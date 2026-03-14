import { useEffect, useRef } from 'react'
import type { Contact, Template } from '../../types'
import { drawVerticalBlock } from '../../lib/verticalText'

/** 1mm あたりのピクセル数 (96 dpi 基準) */
const MM_TO_PX = 96 / 25.4 // ≈ 3.78

/**
 * デフォルトテンプレート: A4 12面ラベル (86.4×42.3mm) 縦書き
 * テンプレート選択 UI が実装されるまでのフォールバック用。
 */
export const DEFAULT_TEMPLATE: Template = {
  id: 'default-a4-12',
  name: '標準 (A4 12面)',
  orientation: 'vertical',
  labelWidth: 86.4,
  labelHeight: 42.3,
  postalCode: {
    x: 36,        // 〒マーク左端 (mm)
    y: 4.5,       // 上端からの距離 (mm)
    digitSpacing: 5.5,
    fontSize: 10,
  },
  recipient: {
    nameX: 79,    // 氏名カラム右端 (mm)
    nameY: 8,     // 上端からの距離 (mm)
    nameFont: 13,
    addressX: 69, // 住所ブロック右端 (mm)
    addressY: 8,  // 上端からの距離 (mm)
    addressFont: 8.5,
  },
  sender: {
    nameX: 16,    // 差出人氏名カラム右端 (mm)
    nameY: 24,
    nameFont: 6.5,
    addressX: 8,  // 差出人住所ブロック右端 (mm)
    addressY: 24,
    addressFont: 5.5,
  },
}

/**
 * デフォルトテンプレート: A4 12面ラベル (86.4×42.3mm) 横書き
 */
export const DEFAULT_TEMPLATE_HORIZONTAL: Template = {
  id: 'default-a4-12-h',
  name: '標準 (A4 12面) 横書き',
  orientation: 'horizontal',
  labelWidth: 86.4,
  labelHeight: 42.3,
  postalCode: {
    x: 5,
    y: 3,
    digitSpacing: 7,
    fontSize: 9,
  },
  recipient: {
    nameX: 5,
    nameY: 13,
    nameFont: 12,
    addressX: 5,
    addressY: 24,
    addressFont: 8.5,
  },
  sender: {
    nameX: 50,
    nameY: 33,
    nameFont: 6.5,
    addressX: 50,
    addressY: 37,
    addressFont: 5.5,
  },
}

/** 郵便番号を "NNN-NNNN" 形式に整形する */
function formatPostalCode(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return raw
}

/** px 変換ヘルパー */
function mm(value: number, scale: number): number {
  return value * MM_TO_PX * scale
}

interface LabelCanvasProps {
  contact: Contact
  template?: Template
  /** 表示倍率 (デフォルト 1.0) */
  zoom?: number
}

export default function LabelCanvas({
  contact,
  template = DEFAULT_TEMPLATE,
  zoom = 1,
}: LabelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const canvasW = Math.round(mm(template.labelWidth, zoom))
  const canvasH = Math.round(mm(template.labelHeight, zoom))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // デバイスピクセル比を考慮した高解像度レンダリング
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`
    ctx.scale(dpr, dpr)

    renderLabel(ctx, contact, template, zoom)
  }, [contact, template, zoom, canvasW, canvasH])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasW, height: canvasH }}
      className="shadow-sm"
    />
  )
}

function renderLabel(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  zoom: number,
): void {
  const s = zoom // スケール係数 (zoom のみ。MM_TO_PX は mm() 内で適用済み)
  const W = mm(tpl.labelWidth, s)
  const H = mm(tpl.labelHeight, s)

  // ─── 背景 ───────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ─── 外枠 ───────────────────────────────────────────────
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 0.5
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

  // ─── 郵便番号 ────────────────────────────────────────────
  if (tpl.postalCode && contact.postalCode) {
    const pc = tpl.postalCode
    const fontSize = mm(pc.fontSize / 2.835, s) // pt → mm → px (1pt≈0.353mm)
    const spacing = mm(pc.digitSpacing, s)
    const startX = mm(pc.x, s)
    const baseY = mm(pc.y, s)

    ctx.fillStyle = '#111827'
    ctx.font = `${fontSize}px "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    // 〒マーク
    ctx.fillText('〒', startX - spacing * 0.3, baseY)

    const digits = contact.postalCode.replace(/\D/g, '')
    const formatted = formatPostalCode(digits)
    // ハイフン込みで1文字ずつ等間隔に描画
    let ox = startX + spacing * 0.5
    for (const ch of formatted) {
      ctx.fillText(ch, ox, baseY)
      ox += ch === '-' ? spacing * 0.5 : spacing
    }
  }

  if (tpl.orientation === 'horizontal') {
    renderHorizontalLabel(ctx, contact, tpl, s)
  } else {
    renderVerticalLabel(ctx, contact, tpl, s)
  }
}

/** 縦書きラベルの宛先・差出人描画 */
function renderVerticalLabel(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  s: number,
): void {
  // ─── 宛先 氏名 ───────────────────────────────────────────
  {
    const rc = tpl.recipient
    const nameFontPx = mm(rc.nameFont / 2.835, s)
    const name = `${contact.familyName}${contact.givenName}`
    const honorific = contact.honorific || '様'

    ctx.fillStyle = '#111827'
    ctx.font = `${nameFontPx}px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif`

    // 氏名: 右端カラム、敬称は独立した右隣カラム
    drawVerticalBlock({
      ctx,
      lines: [honorific, name],
      rightX: mm(rc.nameX, s),
      topY: mm(rc.nameY, s),
      fontSize: nameFontPx,
      convertNumbers: false,
    })
  }

  // ─── 宛先 住所 ───────────────────────────────────────────
  {
    const rc = tpl.recipient
    const addrFontPx = mm(rc.addressFont / 2.835, s)

    // 住所を2列に分割: 都道府県+市区町村 / 番地+建物名
    const addrLine1 = `${contact.prefecture}${contact.city}`
    const addrLine2 = `${contact.street}${contact.building ? `　${contact.building}` : ''}`

    ctx.fillStyle = '#111827'
    ctx.font = `${addrFontPx}px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif`

    drawVerticalBlock({
      ctx,
      lines: [addrLine1, addrLine2].filter(Boolean),
      rightX: mm(rc.addressX, s),
      topY: mm(rc.addressY, s),
      fontSize: addrFontPx,
      convertNumbers: true,
    })
  }
}

/** 横書きラベルの宛先・差出人描画 */
function renderHorizontalLabel(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  s: number,
): void {
  const serifFont = '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif'

  // ─── 宛先 氏名 ───────────────────────────────────────────
  {
    const rc = tpl.recipient
    const nameFontPx = mm(rc.nameFont / 2.835, s)
    const honorific = contact.honorific || '様'
    const fullName = `${contact.familyName}${contact.givenName}　${honorific}`

    ctx.fillStyle = '#111827'
    ctx.font = `${nameFontPx}px ${serifFont}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(fullName, mm(rc.nameX, s), mm(rc.nameY, s))
  }

  // ─── 宛先 住所 ───────────────────────────────────────────
  {
    const rc = tpl.recipient
    const addrFontPx = mm(rc.addressFont / 2.835, s)
    const lineH = addrFontPx * 1.5

    const addrLines = [
      `${contact.prefecture}${contact.city}`,
      `${contact.street}${contact.building ? `　${contact.building}` : ''}`,
    ].filter(Boolean)

    ctx.fillStyle = '#111827'
    ctx.font = `${addrFontPx}px ${serifFont}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    addrLines.forEach((line, i) => {
      ctx.fillText(line, mm(rc.addressX, s), mm(rc.addressY, s) + i * lineH)
    })
  }

  // ─── 差出人エリアは将来 Sender エンティティで置き換える ──────
  // 仕様: 差出人は別エンティティなので、ここでは表示領域の余白のみ確保
}
