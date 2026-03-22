import QRCode from 'qrcode'
import type { QRConfig } from '../types'

interface RenderQRLayerOptions {
  ctx: CanvasRenderingContext2D
  qrConfig: QRConfig
  widthPx: number
  heightPx: number
  /** 96dpi 基準のスケール値（zoom や dpi/96） */
  renderScale: number
  clear?: boolean
}

/** QR レイヤーを描画する */
export async function renderQRLayer(opts: RenderQRLayerOptions): Promise<void> {
  const {
    ctx,
    qrConfig,
    widthPx,
    heightPx,
    renderScale,
    clear = false,
  } = opts

  if (clear) {
    ctx.clearRect(0, 0, widthPx, heightPx)
  }
  if (!qrConfig.enabled || !qrConfig.content) return

  const qrSize = Math.max(1, Math.round(qrConfig.size * renderScale))
  const padding = Math.max(1, Math.round(4 * renderScale))
  const { x, y } = resolveQRPosition(qrConfig.position, widthPx, heightPx, qrSize, padding)

  const tmpCanvas = document.createElement('canvas')
  await QRCode.toCanvas(tmpCanvas, qrConfig.content, {
    width: qrSize,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 2, y - 2, qrSize + 4, qrSize + 4)
  ctx.drawImage(tmpCanvas, x, y, qrSize, qrSize)
}

export function resolveQRPosition(
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
