/** 1mm あたりのピクセル数 (LabelCanvas と同じ定数) */
const MM_TO_PX = 96 / 25.4

interface Props {
  labelWidthMm: number
  labelHeightMm: number
  zoom: number
  /** グリッド間隔 (mm) デフォルト 5 */
  stepMm?: number
}

/**
 * ラベルキャンバス上に重ねて表示するグリッドオーバーレイ。
 * SVG で mm 単位のグリッド線を描画する。
 */
export default function LabelGridOverlay({
  labelWidthMm,
  labelHeightMm,
  zoom,
  stepMm = 5,
}: Props) {
  const pxPerMm = zoom * MM_TO_PX
  const w = Math.round(labelWidthMm * pxPerMm)
  const h = Math.round(labelHeightMm * pxPerMm)
  const step = stepMm * pxPerMm

  // 縦線の x 座標
  const vLines: number[] = []
  for (let x = step; x < w; x += step) {
    vLines.push(Math.round(x))
  }
  // 横線の y 座標
  const hLines: number[] = []
  for (let y = step; y < h; y += step) {
    hLines.push(Math.round(y))
  }

  return (
    <svg
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 縦線 */}
      {vLines.map((x) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.6} />
      ))}
      {/* 横線 */}
      {hLines.map((y) => (
        <line key={`h${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.6} />
      ))}
      {/* mm ラベル (5mm 刻みで表示、小さいズームでは省略) */}
      {zoom >= 0.8 &&
        vLines.map((x, i) => (
          <text
            key={`vl${x}`}
            x={x + 1}
            y={9}
            fontSize={Math.max(6, 7 * zoom)}
            fill="#64748b"
            opacity={0.7}
          >
            {((i + 1) * stepMm).toFixed(0)}
          </text>
        ))}
      {zoom >= 0.8 &&
        hLines.map((y, i) => (
          <text
            key={`hl${y}`}
            x={2}
            y={y - 1}
            fontSize={Math.max(6, 7 * zoom)}
            fill="#64748b"
            opacity={0.7}
          >
            {((i + 1) * stepMm).toFixed(0)}
          </text>
        ))}
    </svg>
  )
}
