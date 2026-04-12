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

export interface EditableFieldInspectorValue {
  xMm: number
  yMm: number
  fontPt: number
}

const roundMm = (value: number) => Math.round(value * 10) / 10
const roundPt = (value: number) => Math.max(4, Math.round(value * 2) / 2)

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

export function getEditableFieldInspectorValue(
  tpl: Template,
  id: EditableFieldId,
): EditableFieldInspectorValue | null {
  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return null
      return {
        xMm: tpl.postalCode.x,
        yMm: tpl.postalCode.y,
        fontPt: tpl.postalCode.fontSize,
      }
    case 'recipientName':
      return {
        xMm: tpl.recipient.nameX,
        yMm: tpl.recipient.nameY,
        fontPt: tpl.recipient.nameFont,
      }
    case 'recipientAddr':
      return {
        xMm: tpl.recipient.addressX,
        yMm: tpl.recipient.addressY,
        fontPt: tpl.recipient.addressFont,
      }
    default:
      return null
  }
}

export function setEditableFieldPosition(
  tpl: Template,
  id: EditableFieldId,
  xMm: number,
  yMm: number,
): Template {
  const roundedX = roundMm(xMm)
  const roundedY = roundMm(yMm)

  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return {
        ...tpl,
        postalCode: {
          ...tpl.postalCode,
          x: roundedX,
          y: roundedY,
        },
      }
    case 'recipientName':
      return {
        ...tpl,
        recipient: {
          ...tpl.recipient,
          nameX: roundedX,
          nameY: roundedY,
        },
      }
    case 'recipientAddr':
      return {
        ...tpl,
        recipient: {
          ...tpl.recipient,
          addressX: roundedX,
          addressY: roundedY,
        },
      }
    default:
      return tpl
  }
}

export function setEditableFieldFontPt(
  tpl: Template,
  id: EditableFieldId,
  fontPt: number,
): Template {
  const roundedFont = roundPt(fontPt)

  switch (id) {
    case 'postalCode':
      if (!tpl.postalCode) return tpl
      return {
        ...tpl,
        postalCode: {
          ...tpl.postalCode,
          fontSize: roundedFont,
        },
      }
    case 'recipientName':
      return {
        ...tpl,
        recipient: { ...tpl.recipient, nameFont: roundedFont },
      }
    case 'recipientAddr':
      return {
        ...tpl,
        recipient: { ...tpl.recipient, addressFont: roundedFont },
      }
    default:
      return tpl
  }
}

export function applyMove(tpl: Template, id: EditableFieldId, dxMm: number, dyMm: number): Template {
  const current = getEditableFieldInspectorValue(tpl, id)
  if (!current) return tpl
  return setEditableFieldPosition(tpl, id, current.xMm + dxMm, current.yMm + dyMm)
}

export function applyFontDelta(tpl: Template, id: EditableFieldId, delta: number): Template {
  const current = getEditableFieldInspectorValue(tpl, id)
  if (!current) return tpl
  return setEditableFieldFontPt(tpl, id, current.fontPt + delta)
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
