import { useEffect, useRef } from 'react'
import type { Watermark } from '../../types'
import { MM_TO_PX_AT_96_DPI } from '../../lib/labelRenderer'
import { renderWatermarkLayer } from '../../lib/watermarkRenderer'

const MM_TO_PX = MM_TO_PX_AT_96_DPI

interface WatermarkLayerProps {
  watermark: Watermark | null
  labelWidth: number   // mm
  labelHeight: number  // mm
  zoom: number
}

export default function WatermarkLayer({
  watermark,
  labelWidth,
  labelHeight,
  zoom,
}: WatermarkLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const canvasW = Math.round(labelWidth * MM_TO_PX * zoom)
  const canvasH = Math.round(labelHeight * MM_TO_PX * zoom)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`
    ctx.scale(dpr, dpr)

    void renderWatermarkLayer({
      ctx,
      watermark,
      widthPx: canvasW,
      heightPx: canvasH,
      renderScale: zoom,
      clear: true,
    }).catch(() => {
      // 画像ロード失敗時は描画をスキップ
    })
  }, [watermark, canvasW, canvasH, zoom])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasW, height: canvasH }}
    />
  )
}
