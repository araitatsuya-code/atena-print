import type { Contact, Template } from '../types'
import { drawVerticalBlock } from './verticalText'

/** 96dpi 時の 1mm あたりピクセル数 */
export const MM_TO_PX_AT_96_DPI = 96 / 25.4
const PT_TO_MM = 25.4 / 72

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

const JOINT_NAME_SEPARATOR = /[・･/／&＆]/

const NAME_AUTO_LAYOUT_RULES = {
  horizontalMinFontPt: 7,
  horizontalSplitThresholdChars: 12,
  horizontalLineHeight: 1.35,
  horizontalRightPaddingMm: 2,
  horizontalBottomPaddingMm: 2,
  horizontalAddressGapMm: 1.2,
  horizontalGlyphWidthRatio: 0.95,
  verticalMinFontPt: 6,
  verticalBottomPaddingMm: 2,
  verticalLeftPaddingMm: 2,
  verticalAddressGapMm: 1.2,
  verticalColumnGapRatio: 0.2,
  verticalCharHeightRatio: 1.05,
  maxVerticalColumns: 3,
} as const

interface HorizontalNameLayout {
  lines: string[]
  fontPt: number
  lineHeightMm: number
}

interface VerticalNameLayout {
  columns: string[]
  fontPt: number
}

function ptToMm(valuePt: number): number {
  return valuePt * PT_TO_MM
}

function estimateTextUnits(text: string): number {
  let units = 0
  for (const ch of [...text]) {
    if (ch === ' ' || ch === '\u3000') {
      units += 0.55
    } else if (/^[\u0020-\u007E\uFF61-\uFF9F]$/.test(ch)) {
      units += 0.55
    } else if (ch === 'ー' || ch === 'ｰ' || ch === '-') {
      units += 0.8
    } else {
      units += 1
    }
  }
  return units
}

function estimateLineWidthMm(text: string, fontPt: number): number {
  return estimateTextUnits(text) * ptToMm(fontPt) * NAME_AUTO_LAYOUT_RULES.horizontalGlyphWidthRatio
}

function listFontCandidates(basePt: number, minPt: number): number[] {
  const floor = Math.min(basePt, minPt)
  if (basePt <= floor + 1e-6) return [basePt]

  const out: number[] = []
  for (let pt = basePt; pt >= floor-1e-6; pt -= 0.5) {
    out.push(Math.round(pt * 10) / 10)
  }
  if (Math.abs(out[out.length - 1] - floor) > 1e-6) {
    out.push(floor)
  }
  return [...new Set(out)]
}

function splitEvenly(text: string, pieces: number): string[] {
  const chars = [...text]
  if (pieces <= 1 || chars.length <= 1) return [text]

  const bucketCount = Math.min(pieces, chars.length)
  const out: string[] = []
  let index = 0
  for (let i = 0; i < bucketCount; i++) {
    const remainingChars = chars.length - index
    const remainingBuckets = bucketCount - i
    const take = Math.ceil(remainingChars / remainingBuckets)
    out.push(chars.slice(index, index + take).join(''))
    index += take
  }
  return out.filter(Boolean)
}

function splitJointNameBody(nameBody: string): string[] {
  const out: string[] = []
  let buf = ''
  for (const ch of [...nameBody]) {
    if (JOINT_NAME_SEPARATOR.test(ch)) {
      if (buf) {
        out.push(`${buf}${ch}`)
        buf = ''
      }
      continue
    }
    buf += ch
  }
  if (buf) out.push(buf)
  return out.length >= 2 ? out : []
}

function buildHorizontalNameCandidates(contact: Contact, honorific: string): string[][] {
  const nameBody = `${contact.familyName}${contact.givenName}`
  const defaultNameLine = `${nameBody}\u3000${honorific}`
  const company = contact.company.trim()
  const department = contact.department.trim()
  const orgLines = [company, department].filter(Boolean)

  let splitNameLines: string[] = [defaultNameLine]
  const jointParts = splitJointNameBody(nameBody)
  if (jointParts.length >= 2) {
    splitNameLines = [...jointParts]
    splitNameLines[splitNameLines.length - 1] = `${splitNameLines[splitNameLines.length - 1]}\u3000${honorific}`
  } else if ([...nameBody].length >= NAME_AUTO_LAYOUT_RULES.horizontalSplitThresholdChars) {
    const [first, second] = splitEvenly(nameBody, 2)
    if (first && second) {
      splitNameLines = [first, `${second}\u3000${honorific}`]
    }
  }

  const mergedOrgLines = orgLines.length > 1 ? [orgLines.join(' ')] : orgLines

  const keys = new Set<string>()
  const candidates: string[][] = []
  const add = (lines: string[]) => {
    const normalized = lines.filter(Boolean)
    if (normalized.length === 0) return
    const key = normalized.join('\n')
    if (keys.has(key)) return
    keys.add(key)
    candidates.push(normalized)
  }

  add([...orgLines, defaultNameLine])
  add([...orgLines, ...splitNameLines])
  add([...mergedOrgLines, defaultNameLine])
  add([...mergedOrgLines, ...splitNameLines])
  add([defaultNameLine])
  add(splitNameLines)

  return candidates
}

function computeHorizontalNameLayout(contact: Contact, tpl: Template): HorizontalNameLayout {
  const rc = tpl.recipient
  const honorific = contact.honorific || '様'
  const candidates = buildHorizontalNameCandidates(contact, honorific)
  const baseFontPt = rc.nameFont
  const minFontPt = Math.min(baseFontPt, NAME_AUTO_LAYOUT_RULES.horizontalMinFontPt)
  const lineHeightRatio = NAME_AUTO_LAYOUT_RULES.horizontalLineHeight

  const availableWidthMm = Math.max(10, tpl.labelWidth - rc.nameX - NAME_AUTO_LAYOUT_RULES.horizontalRightPaddingMm)
  let availableHeightMm = tpl.labelHeight - rc.nameY - NAME_AUTO_LAYOUT_RULES.horizontalBottomPaddingMm
  if (rc.addressY > rc.nameY) {
    availableHeightMm = Math.min(
      availableHeightMm,
      rc.addressY - rc.nameY - NAME_AUTO_LAYOUT_RULES.horizontalAddressGapMm,
    )
  }
  availableHeightMm = Math.max(availableHeightMm, ptToMm(minFontPt) * lineHeightRatio)

  const fontCandidates = listFontCandidates(baseFontPt, minFontPt)
  for (const lines of candidates) {
    for (const fontPt of fontCandidates) {
      const lineHeightMm = ptToMm(fontPt) * lineHeightRatio
      const requiredHeightMm = lineHeightMm * lines.length
      if (requiredHeightMm > availableHeightMm + 1e-6) {
        continue
      }
      const maxLineWidthMm = lines.reduce(
        (max, line) => Math.max(max, estimateLineWidthMm(line, fontPt)),
        0,
      )
      if (maxLineWidthMm <= availableWidthMm + 1e-6) {
        return { lines, fontPt, lineHeightMm }
      }
    }
  }

  const fallbackLines = candidates[candidates.length - 1] ?? [`${contact.familyName}${contact.givenName}\u3000${honorific}`]
  return {
    lines: fallbackLines,
    fontPt: minFontPt,
    lineHeightMm: ptToMm(minFontPt) * lineHeightRatio,
  }
}

function buildVerticalNameCandidates(nameBody: string, honorific: string): string[][] {
  const fullName = `${nameBody}${honorific}`
  const keys = new Set<string>()
  const candidates: string[][] = []
  const add = (columns: string[]) => {
    const normalized = columns.filter(Boolean)
    if (normalized.length === 0) return
    const key = normalized.join('\n')
    if (keys.has(key)) return
    keys.add(key)
    candidates.push(normalized)
  }

  add([fullName])

  const jointParts = splitJointNameBody(nameBody)
  if (jointParts.length >= 2) {
    const columns = [...jointParts].slice(0, NAME_AUTO_LAYOUT_RULES.maxVerticalColumns)
    if (jointParts.length > NAME_AUTO_LAYOUT_RULES.maxVerticalColumns) {
      columns[columns.length - 1] += jointParts.slice(NAME_AUTO_LAYOUT_RULES.maxVerticalColumns).join('')
    }
    columns[columns.length - 1] = `${columns[columns.length - 1]}${honorific}`
    add(columns)
  }

  for (let cols = 2; cols <= NAME_AUTO_LAYOUT_RULES.maxVerticalColumns; cols++) {
    const columns = splitEvenly(nameBody, cols)
    if (columns.length <= 1) continue
    columns[columns.length - 1] = `${columns[columns.length - 1]}${honorific}`
    add(columns)
  }

  return candidates
}

function computeVerticalNameLayout(contact: Contact, tpl: Template): VerticalNameLayout {
  const rc = tpl.recipient
  const honorific = contact.honorific || '様'
  const nameBody = `${contact.familyName}${contact.givenName}`
  const candidates = buildVerticalNameCandidates(nameBody, honorific)

  const baseFontPt = rc.nameFont
  const minFontPt = Math.min(baseFontPt, NAME_AUTO_LAYOUT_RULES.verticalMinFontPt)
  const fontCandidates = listFontCandidates(baseFontPt, minFontPt)
  const availableHeightMm = Math.max(
    ptToMm(minFontPt) * NAME_AUTO_LAYOUT_RULES.verticalCharHeightRatio,
    tpl.labelHeight - rc.nameY - NAME_AUTO_LAYOUT_RULES.verticalBottomPaddingMm,
  )

  let leftLimitMm = NAME_AUTO_LAYOUT_RULES.verticalLeftPaddingMm
  if (rc.addressX > 0 && rc.addressX < rc.nameX) {
    leftLimitMm = Math.max(
      leftLimitMm,
      rc.addressX + ptToMm(rc.addressFont) * 1.2 + NAME_AUTO_LAYOUT_RULES.verticalAddressGapMm,
    )
  }
  const availableWidthMm = Math.max(ptToMm(minFontPt), rc.nameX - leftLimitMm)

  for (const columns of candidates) {
    const maxChars = columns.reduce((max, line) => Math.max(max, [...line].length), 0)
    if (maxChars <= 0) continue

    for (const fontPt of fontCandidates) {
      const fontMm = ptToMm(fontPt)
      const colGap = fontMm * NAME_AUTO_LAYOUT_RULES.verticalColumnGapRatio
      const requiredWidthMm = fontMm * columns.length + colGap * (columns.length - 1)
      const requiredHeightMm = maxChars * fontMm * NAME_AUTO_LAYOUT_RULES.verticalCharHeightRatio
      if (requiredWidthMm <= availableWidthMm + 1e-6 && requiredHeightMm <= availableHeightMm + 1e-6) {
        return { columns, fontPt }
      }
    }
  }

  const fallbackColumns = candidates[candidates.length - 1] ?? [`${nameBody}${honorific}`]
  return { columns: fallbackColumns, fontPt: minFontPt }
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
    const nameLayout = computeVerticalNameLayout(contact, tpl)
    const nameFontPx = ptToPx(nameLayout.fontPt, pxPerMm)

    ctx.fillStyle = '#111827'
    const nameWeight = rc.nameBold ? 'bold' : 'normal'
    ctx.font = `${nameWeight} ${nameFontPx}px ${resolveFontFamily(rc.nameFontFamily)}`

    drawVerticalBlock({
      ctx,
      lines: nameLayout.columns,
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
    const nameLayout = computeHorizontalNameLayout(contact, tpl)
    const nameFontPx = ptToPx(nameLayout.fontPt, pxPerMm)
    const nameLineHeightPx = mmToPx(nameLayout.lineHeightMm, pxPerMm)

    ctx.fillStyle = '#111827'
    ctx.font = `${rc.nameBold ? 'bold' : 'normal'} ${nameFontPx}px ${resolveFontFamily(rc.nameFontFamily)}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    nameLayout.lines.forEach((line, i) => {
      ctx.fillText(line, mmToPx(rc.nameX, pxPerMm), mmToPx(rc.nameY, pxPerMm) + i * nameLineHeightPx)
    })
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
