import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact, QRConfig, Template } from '../types'

vi.mock('./labelRenderer', () => ({
  renderLabelTextLayer: vi.fn(),
}))
vi.mock('./watermarkRenderer', () => ({
  renderWatermarkLayer: vi.fn(async () => {}),
}))
vi.mock('./qrRenderer', () => ({
  renderQRLayer: vi.fn(async () => {}),
}))

import {
  computeSnapshotMetrics,
  renderLabelSnapshotToBlob,
  renderLabelSnapshotToDataURL,
  renderLabelSnapshotsToDataURLBatch,
} from './labelSnapshot'
import { renderLabelTextLayer } from './labelRenderer'
import { renderWatermarkLayer } from './watermarkRenderer'
import { renderQRLayer } from './qrRenderer'

interface MockCanvas {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
  toDataURL: ReturnType<typeof vi.fn>
  toBlob: ReturnType<typeof vi.fn>
}

const template: Template = {
  id: 'tmpl',
  name: '標準',
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

const contact: Contact = {
  id: 'c1',
  familyName: '山田',
  givenName: '太郎',
  familyNameKana: '',
  givenNameKana: '',
  isPrintTarget: true,
  honorific: '様',
  postalCode: '1000001',
  prefecture: '東京都',
  city: '千代田区',
  street: '1-1-1',
  building: '',
  company: '',
  department: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
}

const disabledQR: QRConfig = {
  enabled: false,
  content: '',
  size: 128,
  position: 'bottom-right',
}

let createdCanvases: MockCanvas[] = []

function makeCanvas(): MockCanvas {
  const ctx = {}
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
    toBlob: vi.fn((cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' }))),
  }
}

beforeEach(() => {
  createdCanvases = []
  vi.clearAllMocks()

  const createElement = vi.fn(() => {
    const canvas = makeCanvas()
    createdCanvases.push(canvas)
    return canvas as unknown as HTMLCanvasElement
  })
  vi.stubGlobal('document', { createElement })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('computeSnapshotMetrics', () => {
  it('mm と dpi からピクセル寸法を計算する', () => {
    const m = computeSnapshotMetrics(86.4, 42.3, 300)
    expect(m.pixelWidth).toBe(1020)
    expect(m.pixelHeight).toBe(500)
    expect(m.pxPerMm).toBeCloseTo(300 / 25.4, 10)
    expect(m.renderScale).toBeCloseTo(300 / 96, 10)
  })

  it('不正な dpi を拒否する', () => {
    expect(() => computeSnapshotMetrics(86.4, 42.3, 0)).toThrow('invalid dpi')
  })
})

describe('labelSnapshot', () => {
  it('data URL を生成し、共通レンダラを呼び出す', async () => {
    const result = await renderLabelSnapshotToDataURL({
      contact,
      template,
      qrConfig: disabledQR,
      dpi: 300,
    })

    const canvas = createdCanvases[0]
    expect(canvas.width).toBe(1020)
    expect(canvas.height).toBe(500)
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(result.dataURL).toBe('data:image/png;base64,mock')

    expect(renderLabelTextLayer).toHaveBeenCalledTimes(1)
    expect(renderWatermarkLayer).toHaveBeenCalledTimes(1)
    expect(renderQRLayer).toHaveBeenCalledTimes(1)
  })

  it('showBorder=false をレンダラ引数へ渡す', async () => {
    await renderLabelSnapshotToDataURL({
      contact,
      template,
      qrConfig: disabledQR,
      showBorder: false,
    })

    expect(renderLabelTextLayer).toHaveBeenCalledWith(
      expect.anything(),
      contact,
      template,
      expect.objectContaining({ showBorder: false }),
    )
  })

  it('PNG Blob を生成できる', async () => {
    const result = await renderLabelSnapshotToBlob({
      contact,
      template,
      qrConfig: disabledQR,
    })

    expect(result.blob.type).toBe('image/png')
    expect(createdCanvases[0].toBlob).toHaveBeenCalledTimes(1)
  })

  it('10件以上を連続生成しても処理できる', async () => {
    const inputs = Array.from({ length: 12 }, (_, i) => ({
      contact: { ...contact, id: `c-${i}` },
      template,
      qrConfig: disabledQR,
      dpi: 300,
    }))

    const result = await renderLabelSnapshotsToDataURLBatch(inputs)
    expect(result).toHaveLength(12)
    expect(createdCanvases).toHaveLength(12)
    expect(renderLabelTextLayer).toHaveBeenCalledTimes(12)
  })
})
