import type { Watermark } from '../types'

/** プリセット透かし絵文字マップ */
export const PRESET_WATERMARK_EMOJIS: Record<string, string> = {
  sakura: '🌸',
  wave: '🌊',
  bamboo: '🎋',
  fuji: '🗻',
  crane: '🦢',
}

interface RenderWatermarkLayerOptions {
  ctx: CanvasRenderingContext2D
  watermark: Watermark | null
  widthPx: number
  heightPx: number
  /** 96dpi 基準のスケール値（zoom や dpi/96） */
  renderScale: number
  clear?: boolean
}

/**
 * 透かしレイヤーを描画する。
 * - preset: 絵文字タイル
 * - custom: 画像を全体にストレッチ
 */
export async function renderWatermarkLayer(opts: RenderWatermarkLayerOptions): Promise<void> {
  const {
    ctx,
    watermark,
    widthPx,
    heightPx,
    renderScale,
    clear = false,
  } = opts

  if (clear) {
    ctx.clearRect(0, 0, widthPx, heightPx)
  }
  if (!watermark || watermark.id === 'none') return

  if (watermark.type === 'preset') {
    const emoji = PRESET_WATERMARK_EMOJIS[watermark.id]
    if (!emoji) return
    ctx.save()
    ctx.globalAlpha = watermark.opacity
    drawEmojiPattern(ctx, emoji, widthPx, heightPx, renderScale)
    ctx.restore()
    return
  }

  if (watermark.type === 'custom' && watermark.filePath) {
    const img = await loadImage(watermark.filePath)
    ctx.save()
    ctx.globalAlpha = watermark.opacity
    ctx.drawImage(img, 0, 0, widthPx, heightPx)
    ctx.restore()
  }
}

/** 絵文字をタイル状に描画する */
export function drawEmojiPattern(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  widthPx: number,
  heightPx: number,
  renderScale: number,
): void {
  const fontSize = Math.max(1, Math.round(18 * renderScale))
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const step = Math.max(1, Math.round(fontSize * 2.2))
  const offsetX = step / 2

  let row = 0
  for (let y = fontSize; y < heightPx + fontSize; y += step) {
    const xStart = row % 2 === 0 ? fontSize : fontSize + offsetX
    for (let x = xStart; x < widthPx + fontSize; x += step) {
      ctx.fillText(emoji, x, y)
    }
    row++
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load image: ${src}`))
    img.src = src
  })
}
