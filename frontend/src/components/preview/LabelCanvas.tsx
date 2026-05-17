import { useEffect, useRef } from 'react'
import type { Contact, Template } from '../../types'
import { MM_TO_PX_AT_96_DPI, renderLabelTextLayer } from '../../lib/labelRenderer'
import { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_HORIZONTAL } from '../../lib/labelPresets'

/** 1mm あたりのピクセル数 (96 dpi 基準) */
const MM_TO_PX = MM_TO_PX_AT_96_DPI // ≈ 3.78

// 後方互換のための再エクスポート (PreviewArea / PrintConfirmDialog などが参照)
export { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_HORIZONTAL }

interface LabelCanvasProps {
  contact: Contact
  template?: Template
  /** 表示倍率 (デフォルト 1.0) */
  zoom?: number
}

export interface PreviewCanvasMetrics {
  pxPerMm: number
  canvasW: number
  canvasH: number
}

/**
 * プレビュー（UI）用の寸法計算。
 * LabelCanvas/回帰テストで共通使用し、UI の実寸算出を固定化する。
 */
export function computePreviewCanvasMetrics(template: Template, zoom = 1): PreviewCanvasMetrics {
  const pxPerMm = MM_TO_PX * zoom
  return {
    pxPerMm,
    canvasW: Math.round(template.labelWidth * pxPerMm),
    canvasH: Math.round(template.labelHeight * pxPerMm),
  }
}

/**
 * UI プレビューのテキスト描画エントリポイント。
 * LabelCanvas と一致性回帰テストで共通使用する。
 */
export function renderPreviewLabelTextLayer(
  ctx: CanvasRenderingContext2D,
  contact: Contact,
  template: Template,
  pxPerMm: number,
): void {
  renderLabelTextLayer(ctx, contact, template, {
    pxPerMm,
    showBackground: true,
    showBorder: true,
  })
}

export default function LabelCanvas({
  contact,
  template = DEFAULT_TEMPLATE,
  zoom = 1,
}: LabelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { pxPerMm, canvasW, canvasH } = computePreviewCanvasMetrics(template, zoom)

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

    renderPreviewLabelTextLayer(ctx, contact, template, pxPerMm)
  }, [contact, template, pxPerMm, canvasW, canvasH])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasW, height: canvasH }}
      className="shadow-sm"
    />
  )
}
