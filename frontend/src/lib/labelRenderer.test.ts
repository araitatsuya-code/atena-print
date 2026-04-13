import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact, Template } from '../types'

vi.mock('./verticalText', () => ({
  drawVerticalBlock: vi.fn(),
}))

import { renderLabelTextLayer } from './labelRenderer'
import { drawVerticalBlock } from './verticalText'

type MockContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'font' | 'textAlign' | 'textBaseline' | 'fillRect' | 'strokeRect' | 'fillText'
>

function createMockContext(): MockContext {
  return {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  }
}

const baseContact: Contact = {
  id: 'c1',
  familyName: '山田',
  givenName: '太郎',
  familyNameKana: '',
  givenNameKana: '',
  honorific: '様',
  postalCode: '',
  prefecture: '東京都',
  city: '千代田区',
  street: '1-2-3',
  building: 'テストビル',
  company: '',
  department: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
}

const baseTemplate: Template = {
  id: 'tmpl',
  name: 'test',
  orientation: 'vertical',
  labelWidth: 86.4,
  labelHeight: 42.3,
  recipient: {
    nameX: 79,
    nameY: 8,
    nameFont: 13,
    addressX: 69,
    addressY: 8,
    addressFont: 8.5,
  },
  sender: {
    nameX: 16,
    nameY: 24,
    nameFont: 6.5,
    addressX: 8,
    addressY: 24,
    addressFont: 5.5,
  },
}

describe('renderLabelTextLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('縦書きでは氏名と敬称を同一列で描画する', () => {
    const ctx = createMockContext()

    renderLabelTextLayer(
      ctx as unknown as CanvasRenderingContext2D,
      baseContact,
      baseTemplate,
      { pxPerMm: 1, showBackground: false, showBorder: false },
    )

    expect(drawVerticalBlock).toHaveBeenCalledTimes(2)
    expect(drawVerticalBlock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        lines: ['山田太郎様'],
        convertNumbers: false,
      }),
    )
  })

  it('横書きでは従来どおり氏名と敬称を全角スペース区切りで描画する', () => {
    const ctx = createMockContext()
    const fillText = vi.mocked(ctx.fillText)

    renderLabelTextLayer(
      ctx as unknown as CanvasRenderingContext2D,
      baseContact,
      { ...baseTemplate, orientation: 'horizontal' },
      { pxPerMm: 1, showBackground: false, showBorder: false },
    )

    expect(drawVerticalBlock).not.toHaveBeenCalled()
    const renderedTexts = fillText.mock.calls.map(([text]) => text)
    expect(renderedTexts).toContain('山田太郎　様')
  })
})
