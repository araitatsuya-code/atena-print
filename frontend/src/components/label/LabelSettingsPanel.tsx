import { useShallow } from 'zustand/shallow'
import { useLabelStore } from '../../stores/labelStore'
import type { LabelLayout } from '../../types'

interface Preset {
  name: string
  layout?: LabelLayout
}

const PRESETS: Preset[] = [
  {
    name: 'A4 12面',
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      labelWidth: 86.4,
      labelHeight: 42.3,
      columns: 2,
      rows: 6,
      marginTop: 13,
      marginLeft: 10,
      gapX: 0,
      gapY: 0,
    },
  },
  {
    name: 'A4 10面',
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      labelWidth: 86.4,
      labelHeight: 50.8,
      columns: 2,
      rows: 5,
      marginTop: 23,
      marginLeft: 10,
      gapX: 0,
      gapY: 0,
    },
  },
  {
    name: 'A4 8面',
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      labelWidth: 96.5,
      labelHeight: 67.7,
      columns: 2,
      rows: 4,
      marginTop: 13,
      marginLeft: 7,
      gapX: 9,
      gapY: 0,
    },
  },
  {
    name: 'はがき',
    layout: {
      paperWidth: 100,
      paperHeight: 148,
      labelWidth: 100,
      labelHeight: 148,
      columns: 1,
      rows: 1,
      marginTop: 0,
      marginLeft: 0,
      gapX: 0,
      gapY: 0,
    },
  },
  {
    name: 'カスタム',
  },
]

function matchPreset(layout: LabelLayout): string {
  for (const p of PRESETS) {
    if (!p.layout) continue
    if (
      p.layout.columns === layout.columns &&
      p.layout.rows === layout.rows &&
      p.layout.labelWidth === layout.labelWidth &&
      p.layout.labelHeight === layout.labelHeight
    ) {
      return p.name
    }
  }
  return 'カスタム'
}

export default function LabelSettingsPanel() {
  const { layout, setLayout } = useLabelStore(
    useShallow((s) => ({ layout: s.layout, setLayout: s.setLayout })),
  )

  const currentPreset = matchPreset(layout)

  function handlePresetChange(name: string) {
    const preset = PRESETS.find((p) => p.name === name)
    if (preset?.layout) {
      setLayout(preset.layout)
    }
  }

  function numInput(field: keyof LabelLayout, label: string, unit: 'mm' | '面' = 'mm') {
    const step = unit === 'mm' ? 0.1 : 1
    return (
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 w-20 shrink-0">{label}</label>
        <input
          type="number"
          step={step}
          min={0}
          value={(layout[field] as number).toFixed(unit === 'mm' ? 1 : 0)}
          onChange={(e) => setLayout({ [field]: parseFloat(e.target.value) || 0 })}
          className="w-20 border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    )
  }

  // ミニプレビュー: A4 or カスタム用紙上のラベルグリッド
  const previewW = 96
  const previewH = (previewW / layout.paperWidth) * layout.paperHeight
  const scaleX = previewW / layout.paperWidth
  const scaleY = previewH / layout.paperHeight

  return (
    <div className="space-y-4">
      {/* 用紙タイプ */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">用紙タイプ</label>
        <select
          value={currentPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* ラベルサイズ */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">ラベルサイズ</p>
        <div className="space-y-1">
          {numInput('labelWidth', '幅')}
          {numInput('labelHeight', '高さ')}
        </div>
      </div>

      {/* 面付け */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">面付け</p>
        <div className="space-y-1">
          {numInput('columns', '列数', '面')}
          {numInput('rows', '行数', '面')}
        </div>
      </div>

      {/* 余白 */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">余白・間隔</p>
        <div className="space-y-1">
          {numInput('marginTop', '上余白')}
          {numInput('marginLeft', '左余白')}
          {numInput('gapX', '横間隔')}
          {numInput('gapY', '縦間隔')}
        </div>
      </div>

      {/* ミニプレビュー */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">レイアウトプレビュー</p>
        <div
          className="border border-gray-300 bg-white relative"
          style={{ width: previewW, height: previewH }}
        >
          {Array.from({ length: layout.rows }, (_, row) =>
            Array.from({ length: layout.columns }, (_, col) => {
              const x = (layout.marginLeft + col * (layout.labelWidth + layout.gapX)) * scaleX
              const y = (layout.marginTop + row * (layout.labelHeight + layout.gapY)) * scaleY
              const w = layout.labelWidth * scaleX
              const h = layout.labelHeight * scaleY
              return (
                <div
                  key={`${row}-${col}`}
                  className="absolute bg-blue-100 border border-blue-300"
                  style={{ left: x, top: y, width: w, height: h }}
                />
              )
            }),
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {layout.columns}列 × {layout.rows}行 = {layout.columns * layout.rows}面
        </p>
      </div>
    </div>
  )
}
