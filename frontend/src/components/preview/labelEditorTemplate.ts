import type { Template } from '../../types'

export type EditableFieldId =
  | 'postalCode'
  | 'recipientName'
  | 'recipientAddr'

export interface EditableBox {
  id: EditableFieldId
  label: string
  visualXMm: number
  visualYMm: number
  widthMm: number
  heightMm: number
  fontPt: number
  fontFamily: 'serif' | 'sans-serif'
  bold: boolean
  color: string
}

export function buildEditableBoxes(tpl: Template): EditableBox[] {
  const isVertical = tpl.orientation === 'vertical'
  const labelHeight = tpl.labelHeight
  const labelWidth = tpl.labelWidth
  const boxes: EditableBox[] = []

  if (tpl.postalCode) {
    const postal = tpl.postalCode
    boxes.push({
      id: 'postalCode',
      label: '〒 郵便番号',
      visualXMm: postal.x - postal.digitSpacing * 0.4,
      visualYMm: postal.y,
      widthMm: postal.digitSpacing * 8.5,
      heightMm: (postal.fontSize / 2.835) * 1.8,
      fontPt: postal.fontSize,
      fontFamily: postal.fontFamily ?? 'sans-serif',
      bold: postal.bold ?? false,
      color: '#3b82f6',
    })
  }

  const recipient = tpl.recipient
  if (isVertical) {
    const nameWidth = (recipient.nameFont / 2.835) * 2.5
    boxes.push({
      id: 'recipientName',
      label: '宛名',
      visualXMm: recipient.nameX - nameWidth,
      visualYMm: recipient.nameY,
      widthMm: nameWidth,
      heightMm: Math.max(5, labelHeight - recipient.nameY - 2),
      fontPt: recipient.nameFont,
      fontFamily: recipient.nameFontFamily ?? 'serif',
      bold: recipient.nameBold ?? false,
      color: '#10b981',
    })
    const addressWidth = (recipient.addressFont / 2.835) * 2.5
    boxes.push({
      id: 'recipientAddr',
      label: '住所',
      visualXMm: recipient.addressX - addressWidth,
      visualYMm: recipient.addressY,
      widthMm: addressWidth,
      heightMm: Math.max(5, labelHeight - recipient.addressY - 2),
      fontPt: recipient.addressFont,
      fontFamily: recipient.addressFontFamily ?? 'serif',
      bold: recipient.addressBold ?? false,
      color: '#f59e0b',
    })
  } else {
    boxes.push({
      id: 'recipientName',
      label: '宛名',
      visualXMm: recipient.nameX,
      visualYMm: recipient.nameY,
      widthMm: Math.max(10, labelWidth - recipient.nameX - 2),
      heightMm: (recipient.nameFont / 2.835) * 1.8,
      fontPt: recipient.nameFont,
      fontFamily: recipient.nameFontFamily ?? 'serif',
      bold: recipient.nameBold ?? false,
      color: '#10b981',
    })
    boxes.push({
      id: 'recipientAddr',
      label: '住所',
      visualXMm: recipient.addressX,
      visualYMm: recipient.addressY,
      widthMm: Math.max(10, labelWidth - recipient.addressX - 2),
      heightMm: (recipient.addressFont / 2.835) * 3.5,
      fontPt: recipient.addressFont,
      fontFamily: recipient.addressFontFamily ?? 'serif',
      bold: recipient.addressBold ?? false,
      color: '#f59e0b',
    })
  }

  return boxes
}

export function applyMove(tpl: Template, id: EditableFieldId, dxMm: number, dyMm: number): Template {
  const roundMm = (value: number) => Math.round(value * 10) / 10
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return {
        ...tpl,
        postalCode: {
          ...tpl.postalCode,
          x: roundMm(tpl.postalCode.x + dxMm),
          y: roundMm(tpl.postalCode.y + dyMm),
        },
      }
    case 'recipientName':
      return {
        ...tpl,
        recipient: {
          ...tpl.recipient,
          nameX: roundMm(tpl.recipient.nameX + dxMm),
          nameY: roundMm(tpl.recipient.nameY + dyMm),
        },
      }
    case 'recipientAddr':
      return {
        ...tpl,
        recipient: {
          ...tpl.recipient,
          addressX: roundMm(tpl.recipient.addressX + dxMm),
          addressY: roundMm(tpl.recipient.addressY + dyMm),
        },
      }
    default:
      return tpl
  }
}

export function applyFontDelta(tpl: Template, id: EditableFieldId, delta: number): Template {
  const roundPt = (value: number) => Math.max(4, Math.round(value * 2) / 2)
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return {
        ...tpl,
        postalCode: {
          ...tpl.postalCode,
          fontSize: roundPt(tpl.postalCode.fontSize + delta),
        },
      }
    case 'recipientName':
      return {
        ...tpl,
        recipient: { ...tpl.recipient, nameFont: roundPt(tpl.recipient.nameFont + delta) },
      }
    case 'recipientAddr':
      return {
        ...tpl,
        recipient: { ...tpl.recipient, addressFont: roundPt(tpl.recipient.addressFont + delta) },
      }
    default:
      return tpl
  }
}

export function applyFontFamily(
  tpl: Template,
  id: EditableFieldId,
  family: 'serif' | 'sans-serif',
): Template {
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return { ...tpl, postalCode: { ...tpl.postalCode, fontFamily: family } }
    case 'recipientName':
      return { ...tpl, recipient: { ...tpl.recipient, nameFontFamily: family } }
    case 'recipientAddr':
      return { ...tpl, recipient: { ...tpl.recipient, addressFontFamily: family } }
    default:
      return tpl
  }
}

export function applyBold(tpl: Template, id: EditableFieldId, bold: boolean): Template {
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return { ...tpl, postalCode: { ...tpl.postalCode, bold } }
    case 'recipientName':
      return { ...tpl, recipient: { ...tpl.recipient, nameBold: bold } }
    case 'recipientAddr':
      return { ...tpl, recipient: { ...tpl.recipient, addressBold: bold } }
    default:
      return tpl
  }
}
