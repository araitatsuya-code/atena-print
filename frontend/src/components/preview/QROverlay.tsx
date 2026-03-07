import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import type { QRConfig } from '../../types'

const MM_TO_PX = 96 / 25.4

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

    ctx.clearRect(0, 0, canvasW, canvasH)

    if (!qrConfig.enabled || !qrConfig.content) return

    const qrSize = Math.round(qrConfig.size * zoom)
    const padding = Math.round(4 * zoom)

    const { x, y } = resolvePosition(qrConfig.position, canvasW, canvasH, qrSize, padding)

    // 一時 canvas に QR を描画してから貼り付け
    const tmpCanvas = document.createElement('canvas')
    QRCode.toCanvas(tmpCanvas, qrConfig.content, {
      width: qrSize,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => {
        ctx.clearRect(0, 0, canvasW, canvasH)
        // 白背景パディング
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x - 2, y - 2, qrSize + 4, qrSize + 4)
        ctx.drawImage(tmpCanvas, x, y, qrSize, qrSize)
      })
      .catch(() => {
        // content が無効な場合は無視
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

function resolvePosition(
  position: QRConfig['position'],
  canvasW: number,
  canvasH: number,
  qrSize: number,
  padding: number,
): { x: number; y: number } {
  switch (position) {
    case 'top-left':
      return { x: padding, y: padding }
    case 'top-right':
      return { x: canvasW - qrSize - padding, y: padding }
    case 'bottom-left':
      return { x: padding, y: canvasH - qrSize - padding }
    case 'bottom-right':
      return { x: canvasW - qrSize - padding, y: canvasH - qrSize - padding }
  }
}
