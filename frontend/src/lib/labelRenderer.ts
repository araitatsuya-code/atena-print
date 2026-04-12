import type { Contact, Template } from '../types'
import { drawVerticalBlock } from './verticalText'
import { fitHorizontalNameFontPx, fitVerticalNameFontPx } from './nameAutoLayout'

/** 96dpi 時の 1mm あたりピクセル数 */
export const MM_TO_PX_AT_96_DPI = 96 / 25.4
const PT_TO_MM = 25.4 / 72
const NAME_LAYOUT_PADDING_MM = 2

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, fallbackFontPx: number): number {
  if (typeof ctx.measureText === 'function') {
    return ctx.measureText(text).width
  }
  return [...text].length * fallbackFontPx
}

/** 郵便番号を "NNN-NNNN" 形式に整形する */
export function formatPostalCode(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return raw
}

/** mm → px 変換 */
export function mmToPx(valueMm: number, pxPerMm: number): number {
  return valueMm * pxPerMm
}

/** pt → px 変換 */
export function ptToPx(valuePt: number, pxPerMm: number): number {
  return valuePt * PT_TO_MM * pxPerMm
}

/** フォントファミリー文字列を返す */
export function resolveFontFamily(
  family?: 'serif' | 'sans-serif',
  fallback: 'serif' | 'sans-serif' = 'serif',
): string {
  return (family ?? fallback) === 'sans-serif'
    ? '"Hiragino Kaku Gothic ProN", "Meiryo", sans-serif'
    : '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif'
}

interface RenderLabelTextLayerOptions {
  pxPerMm: number
  showBackground?: boolean
  showBorder?: boolean
}

/** 住所テキストレイヤーを描画（LabelCanvas と snapshot で共通使用） */
export function renderLabelTextLayer(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  opts: RenderLabelTextLayerOptions,
): void {
  const { pxPerMm, showBackground = true, showBorder = true } = opts
  const widthPx = mmToPx(tpl.labelWidth, pxPerMm)
  const heightPx = mmToPx(tpl.labelHeight, pxPerMm)

  if (showBackground) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, widthPx, heightPx)
  }

  if (showBorder) {
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 0.5
    ctx.strokeRect(0.5, 0.5, widthPx - 1, heightPx - 1)
  }

  if (tpl.postalCode && contact.postalCode) {
    renderPostalCode(ctx, contact, tpl, pxPerMm)
  }

  if (tpl.orientation === 'horizontal') {
    renderHorizontalLabel(ctx, contact, tpl, pxPerMm)
  } else {
    renderVerticalLabel(ctx, contact, tpl, pxPerMm)
  }
}

function renderPostalCode(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  pxPerMm: number,
): void {
  const pc = tpl.postalCode
  if (!pc) return

  const fontSize = ptToPx(pc.fontSize, pxPerMm)
  const spacing = mmToPx(pc.digitSpacing, pxPerMm)
  const startX = mmToPx(pc.x, pxPerMm)
  const baseY = mmToPx(pc.y, pxPerMm)

  ctx.fillStyle = '#111827'
  const pcWeight = pc.bold ? 'bold' : 'normal'
  ctx.font = `${pcWeight} ${fontSize}px ${resolveFontFamily(pc.fontFamily, 'sans-serif')}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.fillText('〒', startX - spacing * 0.3, baseY)

  const digits = contact.postalCode.replace(/\D/g, '')
  const formatted = formatPostalCode(digits)
  let offsetX = startX + spacing * 0.5
  for (const ch of formatted) {
    ctx.fillText(ch, offsetX, baseY)
    offsetX += ch === '-' ? spacing * 0.5 : spacing
  }
}

function renderVerticalLabel(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  pxPerMm: number,
): void {
  {
    const rc = tpl.recipient
    const baseNameFontPx = ptToPx(rc.nameFont, pxPerMm)
    const name = `${contact.familyName}${contact.givenName}`
    const honorific = contact.honorific || '様'
    const nameLines = [honorific, name]
    const maxChars = nameLines.reduce((max, line) => Math.max(max, [...line].length), 0)
    const availableHeightPx = mmToPx(Math.max(5, tpl.labelHeight - rc.nameY - NAME_LAYOUT_PADDING_MM), pxPerMm)
    const nameFontPx = fitVerticalNameFontPx(baseNameFontPx, maxChars, availableHeightPx)

    ctx.fillStyle = '#111827'
    const nameWeight = rc.nameBold ? 'bold' : 'normal'
    ctx.font = `${nameWeight} ${nameFontPx}px ${resolveFontFamily(rc.nameFontFamily)}`

    drawVerticalBlock({
      ctx,
      lines: nameLines,
      rightX: mmToPx(rc.nameX, pxPerMm),
      topY: mmToPx(rc.nameY, pxPerMm),
      fontSize: nameFontPx,
      convertNumbers: false,
    })
  }

  {
    const rc = tpl.recipient
    const addrFontPx = ptToPx(rc.addressFont, pxPerMm)
    const addrLine1 = `${contact.prefecture}${contact.city}`
    const addrLine2 = `${contact.street}${contact.building ? `　${contact.building}` : ''}`

    ctx.fillStyle = '#111827'
    const addrWeight = rc.addressBold ? 'bold' : 'normal'
    ctx.font = `${addrWeight} ${addrFontPx}px ${resolveFontFamily(rc.addressFontFamily)}`

    drawVerticalBlock({
      ctx,
      lines: [addrLine1, addrLine2].filter(Boolean),
      rightX: mmToPx(rc.addressX, pxPerMm),
      topY: mmToPx(rc.addressY, pxPerMm),
      fontSize: addrFontPx,
      convertNumbers: true,
    })
  }
}

function renderHorizontalLabel(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  tpl: Template,
  pxPerMm: number,
): void {
  {
    const rc = tpl.recipient
    const baseNameFontPx = ptToPx(rc.nameFont, pxPerMm)
    const honorific = contact.honorific || '様'
    const fullName = `${contact.familyName}${contact.givenName}　${honorific}`
    const fontFamily = resolveFontFamily(rc.nameFontFamily)
    const nameWeight = rc.nameBold ? 'bold' : 'normal'
    const availableWidthPx = mmToPx(Math.max(10, tpl.labelWidth - rc.nameX - NAME_LAYOUT_PADDING_MM), pxPerMm)

    ctx.fillStyle = '#111827'
    ctx.font = `${nameWeight} ${baseNameFontPx}px ${fontFamily}`
    const measuredWidth = measureTextWidth(ctx, fullName, baseNameFontPx)
    const nameFontPx = fitHorizontalNameFontPx(baseNameFontPx, measuredWidth, availableWidthPx)
    ctx.font = `${nameWeight} ${nameFontPx}px ${fontFamily}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(fullName, mmToPx(rc.nameX, pxPerMm), mmToPx(rc.nameY, pxPerMm))
  }

  {
    const rc = tpl.recipient
    const addrFontPx = ptToPx(rc.addressFont, pxPerMm)
    const lineHeight = addrFontPx * 1.5
    const addrLines = [
      `${contact.prefecture}${contact.city}`,
      `${contact.street}${contact.building ? `　${contact.building}` : ''}`,
    ].filter(Boolean)

    ctx.fillStyle = '#111827'
    ctx.font = `${rc.addressBold ? 'bold' : 'normal'} ${addrFontPx}px ${resolveFontFamily(rc.addressFontFamily)}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    addrLines.forEach((line, i) => {
      ctx.fillText(line, mmToPx(rc.addressX, pxPerMm), mmToPx(rc.addressY, pxPerMm) + i * lineHeight)
    })
  }
}
