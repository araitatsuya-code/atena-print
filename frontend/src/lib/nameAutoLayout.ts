const NAME_AUTO_MIN_SCALE = 0.6
const VERTICAL_CHAR_HEIGHT_SCALE = 1.05

/** 長い氏名が横幅を超える場合にフォントを自動縮小する */
export function fitHorizontalNameFontPx(
  baseFontPx: number,
  measuredWidthPx: number,
  availableWidthPx: number,
): number {
  if (baseFontPx <= 0 || measuredWidthPx <= 0 || availableWidthPx <= 0) {
    return baseFontPx
  }
  if (measuredWidthPx <= availableWidthPx) {
    return baseFontPx
  }
  const scaled = baseFontPx * (availableWidthPx / measuredWidthPx)
  return Math.max(baseFontPx * NAME_AUTO_MIN_SCALE, scaled)
}

/** 長い氏名が縦方向に収まらない場合にフォントを自動縮小する */
export function fitVerticalNameFontPx(
  baseFontPx: number,
  maxChars: number,
  availableHeightPx: number,
): number {
  if (baseFontPx <= 0 || maxChars <= 0 || availableHeightPx <= 0) {
    return baseFontPx
  }
  const requiredHeight = baseFontPx * VERTICAL_CHAR_HEIGHT_SCALE * maxChars
  if (requiredHeight <= availableHeightPx) {
    return baseFontPx
  }
  const scaled = availableHeightPx / (VERTICAL_CHAR_HEIGHT_SCALE * maxChars)
  return Math.max(baseFontPx * NAME_AUTO_MIN_SCALE, scaled)
}

