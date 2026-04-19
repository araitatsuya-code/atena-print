import { describe, expect, it } from 'vitest'
import type { Contact, QRConfig, Template, TextConfig, PostalConfig } from '../types'
import { computeSnapshotMetrics, renderLabelSnapshotToCanvas, type LabelSnapshotRenderInput, type SnapshotMetrics } from './labelSnapshot'
import { computePreviewCanvasMetrics, renderPreviewLabelTextLayer } from '../components/preview/LabelCanvas'
import { renderPreviewQRLayer } from '../components/preview/QROverlay'
import { renderPreviewWatermarkLayer } from '../components/preview/WatermarkLayer'

type DrawOp = {
  op: string
  args: unknown[]
}

class RecordingContext {
  fillStyle: string = '#000000'
  strokeStyle: string = '#000000'
  lineWidth = 1
  font = ''
  textAlign: CanvasTextAlign = 'start'
  textBaseline: CanvasTextBaseline = 'alphabetic'
  globalAlpha = 1
  ops: DrawOp[] = []

  save() {
    this.record('save')
  }

  restore() {
    this.record('restore')
  }

  translate(x: number, y: number) {
    this.record('translate', x, y)
  }

  rotate(rad: number) {
    this.record('rotate', rad)
  }

  clearRect(x: number, y: number, w: number, h: number) {
    this.record('clearRect', x, y, w, h)
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.record('fillRect', x, y, w, h, this.fillStyle)
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    this.record('strokeRect', x, y, w, h, this.strokeStyle, this.lineWidth)
  }

  fillText(text: string, x: number, y: number) {
    this.record('fillText', text, x, y, this.font, this.textAlign, this.textBaseline, this.fillStyle)
  }

  drawImage(...args: unknown[]) {
    this.record('drawImage', ...args, this.globalAlpha)
  }

  private record(op: string, ...args: unknown[]) {
    this.ops.push({
      op,
      args: args.map(normalizeArg),
    })
  }
}

type RecordingCanvas = {
  width: number
  height: number
  getContext: (kind: string) => CanvasRenderingContext2D | null
  __ctx: RecordingContext
}

function createRecordingCanvas(): RecordingCanvas {
  const ctx = new RecordingContext()
  return {
    width: 0,
    height: 0,
    getContext: (kind: string) => {
      if (kind !== '2d') return null
      return ctx as unknown as CanvasRenderingContext2D
    },
    __ctx: ctx,
  }
}

function normalizeArg(arg: unknown): unknown {
  if (typeof arg === 'number') {
    return Number(arg.toFixed(4))
  }
  if (
    typeof arg === 'string' ||
    typeof arg === 'boolean' ||
    arg === null ||
    arg === undefined
  ) {
    return arg
  }
  // drawImage などで object が来た場合は参照差を潰して比較可能にする
  return '[object]'
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
  street: '1-2-3',
  building: 'テストビル101',
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

const verticalPostal: PostalConfig = {
  x: 36,
  y: 4.5,
  digitSpacing: 5.5,
  fontSize: 10,
}

const horizontalPostal: PostalConfig = {
  x: 5,
  y: 3,
  digitSpacing: 7,
  fontSize: 9,
}

const verticalRecipient: TextConfig = {
  nameX: 79,
  nameY: 8,
  nameFont: 13,
  addressX: 69,
  addressY: 8,
  addressFont: 8.5,
}

const horizontalRecipient: TextConfig = {
  nameX: 5,
  nameY: 13,
  nameFont: 12,
  addressX: 5,
  addressY: 24,
  addressFont: 8.5,
}

const defaultSender: TextConfig = {
  nameX: 16,
  nameY: 24,
  nameFont: 6.5,
  addressX: 8,
  addressY: 24,
  addressFont: 5.5,
}

function buildTemplate(
  id: string,
  name: string,
  orientation: 'vertical' | 'horizontal',
  labelHeight: number,
): Template {
  const isVertical = orientation === 'vertical'
  return {
    id,
    name,
    orientation,
    labelWidth: 86.4,
    labelHeight,
    postalCode: isVertical ? verticalPostal : horizontalPostal,
    recipient: isVertical ? verticalRecipient : horizontalRecipient,
    sender: defaultSender,
  }
}

const regressionCases = [
  {
    name: '縦書き A4 12面',
    template: buildTemplate('v12', 'A4 12面 縦', 'vertical', 42.3),
  },
  {
    name: '横書き A4 12面',
    template: buildTemplate('h12', 'A4 12面 横', 'horizontal', 42.3),
  },
  {
    name: '縦書き A4 10面',
    template: buildTemplate('v10', 'A4 10面 縦', 'vertical', 50.8),
  },
  {
    name: '横書き A4 10面',
    template: buildTemplate('h10', 'A4 10面 横', 'horizontal', 50.8),
  },
]

async function renderPreviewOps(input: LabelSnapshotRenderInput): Promise<{ metrics: SnapshotMetrics; ops: DrawOp[] }> {
  const canvas = createRecordingCanvas()
  const preview = computePreviewCanvasMetrics(input.template, 1)
  canvas.width = preview.canvasW
  canvas.height = preview.canvasH

  const metrics = computeSnapshotMetrics(input.template.labelWidth, input.template.labelHeight, 96)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context is not available')

  renderPreviewLabelTextLayer(ctx, input.contact, input.template, preview.pxPerMm)

  await renderPreviewWatermarkLayer({
    ctx,
    watermark: input.watermark ?? null,
    widthPx: preview.canvasW,
    heightPx: preview.canvasH,
    zoom: 1,
    clear: false,
  })

  await renderPreviewQRLayer({
    ctx,
    qrConfig: input.qrConfig ?? disabledQR,
    widthPx: preview.canvasW,
    heightPx: preview.canvasH,
    zoom: 1,
    clear: false,
  })

  return {
    metrics,
    ops: canvas.__ctx.ops,
  }
}

async function renderPrintSnapshotOps(input: LabelSnapshotRenderInput): Promise<{ metrics: SnapshotMetrics; ops: DrawOp[]; width: number; height: number }> {
  const canvas = createRecordingCanvas()
  const metrics = await renderLabelSnapshotToCanvas(canvas as unknown as HTMLCanvasElement, input)
  return {
    metrics,
    ops: canvas.__ctx.ops,
    width: canvas.width,
    height: canvas.height,
  }
}

describe('labelSnapshot parity regression', () => {
  it.each(regressionCases)('$name: プレビュー描画と印刷用スナップショット描画が一致する', async ({ template }) => {
    const input: LabelSnapshotRenderInput = {
      contact,
      template,
      dpi: 96,
      qrConfig: disabledQR,
      watermark: null,
      showBorder: true,
    }

    const preview = await renderPreviewOps(input)
    const snapshot = await renderPrintSnapshotOps(input)

    expect(snapshot.metrics).toEqual(preview.metrics)
    expect(snapshot.width).toBe(preview.metrics.pixelWidth)
    expect(snapshot.height).toBe(preview.metrics.pixelHeight)
    expect(snapshot.ops.length).toBeGreaterThan(0)
    expect(snapshot.ops).toEqual(preview.ops)
  })
})
