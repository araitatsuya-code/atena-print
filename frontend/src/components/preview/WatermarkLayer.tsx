import { useEffect, useRef } from 'react'
import type { Watermark } from '../../types'

const MM_TO_PX = 96 / 25.4

/** プリセット透かし絵文字マップ */
const PRESET_EMOJIS: Record<string, string> = {
  sakura: '🌸',
  wave: '🌊',
  bamboo: '🎋',
  fuji: '🗻',
  crane: '🦢',
}

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

    ctx.clearRect(0, 0, canvasW, canvasH)

    if (!watermark || watermark.id === 'none') return

    ctx.globalAlpha = watermark.opacity

    if (watermark.type === 'preset') {
      const emoji = PRESET_EMOJIS[watermark.id]
      if (emoji) {
        drawEmojiPattern(ctx, emoji, canvasW, canvasH, zoom)
      }
    } else if (watermark.type === 'custom' && watermark.filePath) {
      const img = new Image()
      img.onload = () => {
        ctx.globalAlpha = watermark.opacity
        // ラベル全体に引き伸ばして描画
        ctx.drawImage(img, 0, 0, canvasW, canvasH)
      }
      img.src = watermark.filePath
    }
  }, [watermark, canvasW, canvasH, zoom])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasW, height: canvasH }}
    />
  )
}

/** 絵文字をタイル状に描画する */
function drawEmojiPattern(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  w: number,
  h: number,
  zoom: number,
) {
  const fontSize = Math.round(18 * zoom)
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const step = Math.round(fontSize * 2.2)
  const offsetX = step / 2

  let row = 0
  for (let y = fontSize; y < h + fontSize; y += step) {
    const xStart = row % 2 === 0 ? fontSize : fontSize + offsetX
    for (let x = xStart; x < w + fontSize; x += step) {
      ctx.fillText(emoji, x, y)
    }
    row++
  }
}
