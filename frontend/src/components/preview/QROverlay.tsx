import { useEffect, useRef } from 'react'
import type { QRConfig } from '../../types'
import { MM_TO_PX_AT_96_DPI } from '../../lib/labelRenderer'
import { renderQRLayer } from '../../lib/qrRenderer'

const MM_TO_PX = MM_TO_PX_AT_96_DPI

interface QROverlayProps {
  qrConfig: QRConfig
  labelWidth: number   // mm
  labelHeight: number  // mm
  zoom: number
}

export default function QROverlay({
  qrConfig,
  labelWidth,
  labelHeight,
  zoom,
}: QROverlayProps) {
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

    void renderQRLayer({
      ctx,
      qrConfig,
      widthPx: canvasW,
      heightPx: canvasH,
      renderScale: zoom,
      clear: true,
    }).catch(() => {
      // content が無効な場合は描画をスキップ
    })
  }, [qrConfig, canvasW, canvasH, zoom])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasW, height: canvasH }}
    />
  )
}
