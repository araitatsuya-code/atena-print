import type { Contact, QRConfig, Template, Watermark } from '../types'
import { renderLabelTextLayer } from './labelRenderer'
import { renderQRLayer } from './qrRenderer'
import { renderWatermarkLayer } from './watermarkRenderer'

const DEFAULT_DPI = 300

const DISABLED_QR: QRConfig = {
  enabled: false,
  content: '',
  size: 128,
  position: 'bottom-right',
}

export interface SnapshotMetrics {
  dpi: number
  pxPerMm: number
  renderScale: number
  pixelWidth: number
  pixelHeight: number
}

export interface LabelSnapshotRenderInput {
  contact: Contact
  template: Template
  watermark?: Watermark | null
  qrConfig?: QRConfig
  dpi?: number
  showBorder?: boolean
}

export interface LabelSnapshotDataURLResult extends SnapshotMetrics {
  dataURL: string
}

export interface LabelSnapshotBlobResult extends SnapshotMetrics {
  blob: Blob
}

export function computeSnapshotMetrics(labelWidthMm: number, labelHeightMm: number, dpi = DEFAULT_DPI): SnapshotMetrics {
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new Error(`invalid dpi: ${dpi}`)
  }
  const pxPerMm = dpi / 25.4
  return {
    dpi,
    pxPerMm,
    renderScale: dpi / 96,
    pixelWidth: Math.max(1, Math.round(labelWidthMm * pxPerMm)),
    pixelHeight: Math.max(1, Math.round(labelHeightMm * pxPerMm)),
  }
}

/** 与えられた canvas に印刷用ラベルを描画する */
export async function renderLabelSnapshotToCanvas(
  canvas: HTMLCanvasElement,
  input: LabelSnapshotRenderInput,
): Promise<SnapshotMetrics> {
  const metrics = computeSnapshotMetrics(input.template.labelWidth, input.template.labelHeight, input.dpi ?? DEFAULT_DPI)
  canvas.width = metrics.pixelWidth
  canvas.height = metrics.pixelHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context is not available')

  renderLabelTextLayer(ctx, input.contact, input.template, {
    pxPerMm: metrics.pxPerMm,
    showBackground: true,
    showBorder: input.showBorder ?? true,
  })

  await renderWatermarkLayer({
    ctx,
    watermark: input.watermark ?? null,
    widthPx: metrics.pixelWidth,
    heightPx: metrics.pixelHeight,
    renderScale: metrics.renderScale,
    clear: false,
  })

  await renderQRLayer({
    ctx,
    qrConfig: input.qrConfig ?? DISABLED_QR,
    widthPx: metrics.pixelWidth,
    heightPx: metrics.pixelHeight,
    renderScale: metrics.renderScale,
    clear: false,
  })

  return metrics
}

/** オフスクリーンでラベルを描画し data URL (PNG) を返す */
export async function renderLabelSnapshotToDataURL(
  input: LabelSnapshotRenderInput,
): Promise<LabelSnapshotDataURLResult> {
  const canvas = document.createElement('canvas')
  const metrics = await renderLabelSnapshotToCanvas(canvas, input)
  return {
    ...metrics,
    dataURL: canvas.toDataURL('image/png'),
  }
}

/** オフスクリーンでラベルを描画し Blob (PNG) を返す */
export async function renderLabelSnapshotToBlob(
  input: LabelSnapshotRenderInput,
): Promise<LabelSnapshotBlobResult> {
  const canvas = document.createElement('canvas')
  const metrics = await renderLabelSnapshotToCanvas(canvas, input)
  const blob = await canvasToBlob(canvas)
  return {
    ...metrics,
    blob,
  }
}

/** 連続レンダリング（低メモリのため逐次処理） */
export async function renderLabelSnapshotsToDataURLBatch(
  inputs: LabelSnapshotRenderInput[],
): Promise<LabelSnapshotDataURLResult[]> {
  const results: LabelSnapshotDataURLResult[] = []
  for (const input of inputs) {
    results.push(await renderLabelSnapshotToDataURL(input))
  }
  return results
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('failed to create blob from canvas'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
