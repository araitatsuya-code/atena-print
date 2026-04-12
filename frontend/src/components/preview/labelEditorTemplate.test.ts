import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE } from './LabelCanvas'
import {
  applyFontDelta,
  applyMove,
  getEditableFieldInspectorValue,
  setEditableFieldFontPt,
  setEditableFieldPosition,
} from './labelEditorTemplate'
import type { Template } from '../../types'

function cloneTemplate(base: Template = DEFAULT_TEMPLATE): Template {
  return {
    ...base,
    recipient: { ...base.recipient },
    sender: { ...base.sender },
    postalCode: base.postalCode ? { ...base.postalCode } : undefined,
  }
}

describe('labelEditorTemplate inspector helpers', () => {
  it('選択中フィールドの値を取得できる', () => {
    const tpl = cloneTemplate()
    const inspector = getEditableFieldInspectorValue(tpl, 'recipientName')

    expect(inspector).not.toBeNull()
    expect(inspector?.xMm).toBe(tpl.recipient.nameX)
    expect(inspector?.yMm).toBe(tpl.recipient.nameY)
    expect(inspector?.fontPt).toBe(tpl.recipient.nameFont)
  })

  it('座標を 0.1mm 刻みで直接更新できる', () => {
    const tpl = cloneTemplate()
    const updated = setEditableFieldPosition(tpl, 'recipientAddr', 12.34, 56.78)

    expect(updated.recipient.addressX).toBe(12.3)
    expect(updated.recipient.addressY).toBe(56.8)
  })

  it('フォントサイズを 0.5pt 刻みで更新し、最小値を下回らない', () => {
    const tpl = cloneTemplate()
    const rounded = setEditableFieldFontPt(tpl, 'recipientName', 10.26)
    const clamped = setEditableFieldFontPt(tpl, 'recipientName', 2)

    expect(rounded.recipient.nameFont).toBe(10.5)
    expect(clamped.recipient.nameFont).toBe(4)
  })

  it('applyMove は既存座標に差分を適用する', () => {
    const tpl = cloneTemplate()
    const updated = applyMove(tpl, 'postalCode', 0.26, -0.24)

    expect(updated.postalCode?.x).toBe(36.3)
    expect(updated.postalCode?.y).toBe(4.3)
  })

  it('applyFontDelta は差分でフォント更新する', () => {
    const tpl = cloneTemplate()
    const updated = applyFontDelta(tpl, 'postalCode', -6.2)

    expect(updated.postalCode?.fontSize).toBe(4)
  })

  it('郵便番号設定がない場合は postalCode の編集を無視する', () => {
    const tpl = cloneTemplate({ ...DEFAULT_TEMPLATE, postalCode: undefined })

    expect(getEditableFieldInspectorValue(tpl, 'postalCode')).toBeNull()
    expect(setEditableFieldPosition(tpl, 'postalCode', 1, 1)).toEqual(tpl)
    expect(setEditableFieldFontPt(tpl, 'postalCode', 9)).toEqual(tpl)
  })
})
