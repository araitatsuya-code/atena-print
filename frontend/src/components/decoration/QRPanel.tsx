import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { useShallow } from 'zustand/shallow'
import { useDecorationStore } from '../../stores/decorationStore'
import type { QRConfig } from '../../types'

const POSITIONS: { id: QRConfig['position']; label: string }[] = [
  { id: 'top-left', label: '左上' },
  { id: 'top-right', label: '右上' },
  { id: 'bottom-left', label: '左下' },
  { id: 'bottom-right', label: '右下' },
]

export default function QRPanel() {
  const { qrConfig, setQRConfig } = useDecorationStore(
    useShallow((s) => ({ qrConfig: s.qrConfig, setQRConfig: s.setQRConfig })),
  )
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !qrConfig.enabled || !qrConfig.content) return
    QRCode.toCanvas(canvas, qrConfig.content, { width: 80, margin: 1 }).catch(() => {})
  }, [qrConfig.enabled, qrConfig.content])

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        QRコード
      </h3>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-700">QRコードを表示</span>
        <button
          onClick={() => setQRConfig({ enabled: !qrConfig.enabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            qrConfig.enabled ? 'bg-blue-500' : 'bg-gray-300'
          }`}
          aria-label="QRコードON/OFF"
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              qrConfig.enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {qrConfig.enabled && (
        <>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">URLまたはテキスト</label>
            <input
              type="text"
              value={qrConfig.content}
              onChange={(e) => setQRConfig({ content: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">配置</label>
            <div className="grid grid-cols-2 gap-1">
              {POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setQRConfig({ position: pos.id })}
                  className={`py-1 text-xs rounded border transition-colors ${
                    qrConfig.position === pos.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {qrConfig.content && (
            <div className="flex justify-center">
              <canvas ref={canvasRef} className="border border-gray-200 rounded" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
