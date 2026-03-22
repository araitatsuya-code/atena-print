import { useEffect, useRef } from 'react'
import type { Contact, Template } from '../../types'
import { MM_TO_PX_AT_96_DPI, renderLabelTextLayer } from '../../lib/labelRenderer'

/** 1mm あたりのピクセル数 (96 dpi 基準) */
const MM_TO_PX = MM_TO_PX_AT_96_DPI // ≈ 3.78

/**
 * デフォルトテンプレート: A4 12面ラベル (86.4×42.3mm) 縦書き
 * テンプレート選択 UI が実装されるまでのフォールバック用。
 */
export const DEFAULT_TEMPLATE: Template = {
  id: 'default-a4-12',
  name: '標準 (A4 12面)',
  orientation: 'vertical',
  labelWidth: 86.4,
  labelHeight: 42.3,
  postalCode: {
    x: 36,        // 〒マーク左端 (mm)
    y: 4.5,       // 上端からの距離 (mm)
    digitSpacing: 5.5,
    fontSize: 10,
  },
  recipient: {
    nameX: 79,    // 氏名カラム右端 (mm)
    nameY: 8,     // 上端からの距離 (mm)
    nameFont: 13,
    addressX: 69, // 住所ブロック右端 (mm)
    addressY: 8,  // 上端からの距離 (mm)
    addressFont: 8.5,
  },
  sender: {
    nameX: 16,    // 差出人氏名カラム右端 (mm)
    nameY: 24,
    nameFont: 6.5,
    addressX: 8,  // 差出人住所ブロック右端 (mm)
    addressY: 24,
    addressFont: 5.5,
  },
}

/**
 * デフォルトテンプレート: A4 12面ラベル (86.4×42.3mm) 横書き
 */
export const DEFAULT_TEMPLATE_HORIZONTAL: Template = {
  id: 'default-a4-12-h',
  name: '標準 (A4 12面) 横書き',
  orientation: 'horizontal',
  labelWidth: 86.4,
  labelHeight: 42.3,
  postalCode: {
    x: 5,
    y: 3,
    digitSpacing: 7,
    fontSize: 9,
  },
  recipient: {
    nameX: 5,
    nameY: 13,
    nameFont: 12,
    addressX: 5,
    addressY: 24,
    addressFont: 8.5,
  },
  sender: {
    nameX: 50,
    nameY: 33,
    nameFont: 6.5,
    addressX: 50,
    addressY: 37,
    addressFont: 5.5,
  },
}

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
