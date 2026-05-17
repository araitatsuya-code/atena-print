import type { Template } from '../types'

/**
 * ラベルサイズに合わせたフィールド配置のプリセット。
 *
 * 用紙プリセット (LabelSettingsPanel の PRESETS) と labelWidth × labelHeight で
 * マッチさせ、対応する vertical / horizontal テンプレートを返す。
 *
 * マッチしない場合は A4 12面 のデフォルトにフォールバック。
 */

interface PresetTemplatePair {
  /** プリセット識別用 (labelWidth × labelHeight で一致を判定) */
  labelWidth: number
  labelHeight: number
  vertical: Template
  horizontal: Template
}

/**
 * A4 12面 (86.4×42.3mm) — 既存デフォルト
 */
const A4_12: PresetTemplatePair = {
  labelWidth: 86.4,
  labelHeight: 42.3,
  vertical: {
    id: 'preset-a4-12-v',
    name: 'A4 12面 縦書き',
    orientation: 'vertical',
    labelWidth: 86.4,
    labelHeight: 42.3,
    postalCode: { x: 36, y: 4.5, digitSpacing: 5.5, fontSize: 10 },
    recipient: {
      nameX: 79,
      nameY: 8,
      nameFont: 13,
      addressX: 69,
      addressY: 8,
      addressFont: 8.5,
    },
    sender: {
      nameX: 16,
      nameY: 24,
      nameFont: 6.5,
      addressX: 8,
      addressY: 24,
      addressFont: 5.5,
    },
  },
  horizontal: {
    id: 'preset-a4-12-h',
    name: 'A4 12面 横書き',
    orientation: 'horizontal',
    labelWidth: 86.4,
    labelHeight: 42.3,
    // 上から: 郵便番号 → 住所 → 名前 (住所と名前は近接させてまとめる)
    postalCode: { x: 5, y: 3, digitSpacing: 7, fontSize: 9 },
    recipient: {
      // 住所: 中段 (郵便番号の下)
      addressX: 5,
      addressY: 11,
      addressFont: 8.5,
      // 名前: 下段、大きく (住所の直下)
      nameX: 5,
      nameY: 22,
      nameFont: 13,
    },
    sender: {
      nameX: 50,
      nameY: 33,
      nameFont: 6.5,
      addressX: 50,
      addressY: 37,
      addressFont: 5.5,
    },
  },
}

/**
 * A4 10面 (86.4×50.8mm) — 12面 より縦に少し広い
 */
const A4_10: PresetTemplatePair = {
  labelWidth: 86.4,
  labelHeight: 50.8,
  vertical: {
    id: 'preset-a4-10-v',
    name: 'A4 10面 縦書き',
    orientation: 'vertical',
    labelWidth: 86.4,
    labelHeight: 50.8,
    postalCode: { x: 36, y: 5, digitSpacing: 5.5, fontSize: 10 },
    recipient: {
      nameX: 79,
      nameY: 10,
      nameFont: 14,
      addressX: 69,
      addressY: 10,
      addressFont: 9,
    },
    sender: {
      nameX: 16,
      nameY: 32,
      nameFont: 7,
      addressX: 8,
      addressY: 32,
      addressFont: 6,
    },
  },
  horizontal: {
    id: 'preset-a4-10-h',
    name: 'A4 10面 横書き',
    orientation: 'horizontal',
    labelWidth: 86.4,
    labelHeight: 50.8,
    // 上から: 郵便番号 → 住所 → 名前
    postalCode: { x: 5, y: 4, digitSpacing: 7, fontSize: 10 },
    recipient: {
      addressX: 5,
      addressY: 13,
      addressFont: 9,
      nameX: 5,
      nameY: 26,
      nameFont: 15,
    },
    sender: {
      nameX: 50,
      nameY: 40,
      nameFont: 7,
      addressX: 50,
      addressY: 44,
      addressFont: 6,
    },
  },
}

/**
 * A4 8面 (96.5×67.7mm) — 大きめラベル
 * はがきに近いサイズなので、伝統的な縦書きはがき配置に揃える:
 * - 郵便番号: 真ん中上
 * - 受取人氏名: 中央, 大きい
 * - 受取人住所: 右側 (右→左 の読み順)
 * - 差出人: 左下
 */
const A4_8: PresetTemplatePair = {
  labelWidth: 96.5,
  labelHeight: 67.7,
  vertical: {
    id: 'preset-a4-8-v',
    name: 'A4 8面 縦書き',
    orientation: 'vertical',
    labelWidth: 96.5,
    labelHeight: 67.7,
    // 〒 + 7 桁 (digitSpacing 6.5, 全幅 ≈ 54mm) を 96.5mm 幅で水平中央寄せ
    postalCode: { x: 23, y: 6, digitSpacing: 6.5, fontSize: 12 },
    recipient: {
      // 氏名: ラベル幅 96.5 の中央 (column 幅 ≈ 16mm → rightEdge=56 で中央寄せ)
      nameX: 56,
      nameY: 14,
      nameFont: 18,
      // 住所: 右側 column rightEdge=88
      addressX: 88,
      addressY: 14,
      addressFont: 12,
    },
    sender: {
      // 差出人: 左下、控えめサイズ
      nameX: 22,
      nameY: 50,
      nameFont: 8,
      addressX: 12,
      addressY: 50,
      addressFont: 7,
    },
  },
  horizontal: {
    id: 'preset-a4-8-h',
    name: 'A4 8面 横書き',
    orientation: 'horizontal',
    labelWidth: 96.5,
    labelHeight: 67.7,
    // 上から: 郵便番号 → 住所 → 名前
    postalCode: { x: 7, y: 5, digitSpacing: 8, fontSize: 11 },
    recipient: {
      addressX: 7,
      addressY: 16,
      addressFont: 12,
      nameX: 7,
      nameY: 34,
      nameFont: 18,
    },
    sender: {
      nameX: 55,
      nameY: 55,
      nameFont: 8,
      addressX: 55,
      addressY: 60,
      addressFont: 7,
    },
  },
}

/**
 * はがき (100×148mm)
 * - 縦書き: 伝統的レイアウト
 *   - 郵便番号: 真ん中上 (7 桁を水平方向に中央寄せ)
 *   - 受取人氏名: 中央, 大きい (focal point)
 *   - 受取人住所: 右側 (縦書きの読み順 右→左 で最初に来る)
 *   - 差出人: 左下 (控えめに)
 * - 横書き: 郵便番号上, 宛名中央大きく, 差出人下
 */
const HAGAKI: PresetTemplatePair = {
  labelWidth: 100,
  labelHeight: 148,
  vertical: {
    id: 'preset-hagaki-v',
    name: 'はがき 縦書き',
    orientation: 'vertical',
    labelWidth: 100,
    labelHeight: 148,
    // 〒 + 7 桁 (digitSpacing 8mm, 全幅 ≈ 62mm) を 100mm 幅で水平中央寄せ
    postalCode: { x: 21, y: 12, digitSpacing: 8, fontSize: 13 },
    recipient: {
      // 氏名: ラベル幅 100 の中央に column rightEdge=60 (font 24pt の縦書きで column 幅 ≈21mm → 中央寄せ)
      nameX: 60,
      nameY: 35,
      nameFont: 24,
      // 住所: 右側 column rightEdge=88
      addressX: 88,
      addressY: 35,
      addressFont: 14,
    },
    sender: {
      // 差出人: 左下、控えめサイズ
      nameX: 22,
      nameY: 110,
      nameFont: 10,
      addressX: 10,
      addressY: 110,
      addressFont: 8,
    },
  },
  horizontal: {
    id: 'preset-hagaki-h',
    name: 'はがき 横書き',
    orientation: 'horizontal',
    labelWidth: 100,
    labelHeight: 148,
    // 上から: 郵便番号 → 住所 → 名前
    postalCode: { x: 10, y: 12, digitSpacing: 10, fontSize: 14 },
    recipient: {
      addressX: 10,
      addressY: 32,
      addressFont: 14,
      nameX: 10,
      nameY: 60,
      nameFont: 26,
    },
    sender: {
      nameX: 55,
      nameY: 125,
      nameFont: 10,
      addressX: 55,
      addressY: 132,
      addressFont: 8,
    },
  },
}

const PRESET_TEMPLATES: PresetTemplatePair[] = [A4_12, A4_10, A4_8, HAGAKI]

/** ラベル寸法が一致するプリセットを探す (許容差 ±0.5mm) */
function matchPreset(labelWidth: number, labelHeight: number): PresetTemplatePair | null {
  for (const preset of PRESET_TEMPLATES) {
    if (
      Math.abs(preset.labelWidth - labelWidth) < 0.5 &&
      Math.abs(preset.labelHeight - labelHeight) < 0.5
    ) {
      return preset
    }
  }
  return null
}

/**
 * ラベル寸法・書字方向に合ったプリセットテンプレートを返す。
 * 一致するプリセットが無い場合は A4 12面 のテンプレートを labelWidth/Height だけ
 * 差し替えて返す (カスタムサイズでも壊れないように)。
 */
export function pickPresetTemplate(
  labelWidth: number,
  labelHeight: number,
  orientation: 'vertical' | 'horizontal',
): Template {
  const matched = matchPreset(labelWidth, labelHeight)
  if (matched) {
    return orientation === 'horizontal' ? matched.horizontal : matched.vertical
  }
  const fallback = orientation === 'horizontal' ? A4_12.horizontal : A4_12.vertical
  return { ...fallback, labelWidth, labelHeight }
}

/** A4 12面 デフォルトを既存名で再エクスポート (後方互換) */
export const DEFAULT_TEMPLATE = A4_12.vertical
export const DEFAULT_TEMPLATE_HORIZONTAL = A4_12.horizontal

/**
 * 現在のレイアウト・方向に整合するテンプレートを返す。
 *
 * - selectedTemplate が現在の方向 / 寸法と一致するならそれを採用
 * - 不一致 (例: はがき横書きの編集を保存していたが今は縦書き、別サイズに変更) なら
 *   プリセットのデフォルトに切り替える
 *
 * useEffect でクリアする方式だと「初回 render で古い template が一瞬出る」問題が
 * 起きるため、render 時点で同期的に切り替える設計にする。
 */
export function resolveTemplate(
  selectedTemplate: Template | null,
  labelWidth: number,
  labelHeight: number,
  orientation: 'vertical' | 'horizontal',
): Template {
  const defaultTpl = pickPresetTemplate(labelWidth, labelHeight, orientation)
  const isValidSelection =
    selectedTemplate !== null &&
    selectedTemplate.orientation === orientation &&
    Math.abs(selectedTemplate.labelWidth - labelWidth) < 0.5 &&
    Math.abs(selectedTemplate.labelHeight - labelHeight) < 0.5
  const base = isValidSelection ? selectedTemplate : defaultTpl
  return { ...base, orientation, labelWidth, labelHeight }
}
