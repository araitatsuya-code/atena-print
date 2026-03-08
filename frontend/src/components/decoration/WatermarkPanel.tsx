import { useShallow } from 'zustand/shallow'
import { useDecorationStore } from '../../stores/decorationStore'

const PRESETS = [
  { id: 'none', label: 'なし', emoji: '✕' },
  { id: 'sakura', label: '桜', emoji: '🌸' },
  { id: 'wave', label: '波', emoji: '🌊' },
  { id: 'bamboo', label: '竹', emoji: '🎋' },
  { id: 'fuji', label: '富士山', emoji: '🗻' },
  { id: 'crane', label: '鶴', emoji: '🦢' },
  { id: 'custom', label: 'カスタム', emoji: '📷' },
]

export default function WatermarkPanel() {
  const { watermark, setWatermark } = useDecorationStore(
    useShallow((s) => ({ watermark: s.watermark, setWatermark: s.setWatermark })),
  )

  const currentId = watermark?.id ?? 'none'
  const opacity = watermark?.opacity ?? 0.3

  const handlePresetSelect = (id: string) => {
    if (id === 'none') {
      setWatermark(null)
      return
    }
    if (id === 'custom') {
      setWatermark({
        id: 'custom',
        name: 'カスタム',
        type: 'custom',
        filePath: watermark?.type === 'custom' ? watermark.filePath : '',
        opacity,
      })
      return
    }
    const preset = PRESETS.find((p) => p.id === id)!
    setWatermark({ id, name: preset.label, type: 'preset', filePath: '', opacity })
  }

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!watermark || watermark.id === 'none') return
    setWatermark({ ...watermark, opacity: Number(e.target.value) / 100 })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setWatermark({ id: 'custom', name: 'カスタム', type: 'custom', filePath: dataUrl, opacity })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        透かし画像
      </h3>

      <div className="grid grid-cols-3 gap-1 mb-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetSelect(preset.id)}
            className={`flex flex-col items-center justify-center p-2 rounded border text-center transition-colors ${
              currentId === preset.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-base leading-none">{preset.emoji}</span>
            <span className="text-[10px] mt-0.5 text-gray-600">{preset.label}</span>
          </button>
        ))}
      </div>

      {watermark && watermark.id !== 'none' && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>透明度</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={Math.round(opacity * 100)}
            onChange={handleOpacityChange}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {currentId === 'custom' && (
        <label className="block cursor-pointer">
          <div className="flex items-center justify-center w-full px-3 py-2 border border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs text-gray-500">
            画像をアップロード
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>
      )}
    </div>
  )
}
