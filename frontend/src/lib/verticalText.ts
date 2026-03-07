/**
 * 縦書きテキスト描画エンジン (Canvas API)
 * Canvas (プレビュー) と gofpdf (印刷) で同じ見た目になるよう
 * テンプレートJSONを共通のソースとして使用する。
 */

/** 拗音・促音（小さいかな）—右寄り・上寄りにオフセット */
const SMALL_KANA = new Set(
  'ぁぃぅぇぉゃゅょゎゕゖっァィゥェォャュョヮヵヶッ',
)

/** 長音符・波ダッシュ—90度回転して縦に表示 */
const ROTATE_90 = new Set('ーｰ〜～―─━')

/** 句読点・括弧の位置調整 (dx, dy は fontSize の倍率) */
const PUNCT_OFFSET: Record<string, [number, number]> = {
  '。': [0.35, -0.35],
  '、': [0.35, -0.35],
  '．': [0.35, -0.35],
  '，': [0.35, -0.35],
  '・': [0.0, 0.0],
  '「': [-0.15, 0.25],
  '」': [-0.15, -0.25],
  '『': [-0.15, 0.25],
  '』': [-0.15, -0.25],
  '（': [-0.1, 0.3],
  '）': [-0.1, -0.3],
  '【': [-0.1, 0.3],
  '】': [-0.1, -0.3],
  '〔': [-0.1, 0.3],
  '〕': [-0.1, -0.3],
}

/** アラビア数字→漢数字 */
const ARABIC_TO_KANJI: Record<string, string> = {
  '0': '〇',
  '1': '一',
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
}

/** アラビア数字を漢数字に変換する */
export function toKanjiNumerals(text: string): string {
  return text.replace(/[0-9]/g, (d) => ARABIC_TO_KANJI[d] ?? d)
}

export interface DrawVerticalColumnOptions {
  /** Canvas 2D コンテキスト */
  ctx: CanvasRenderingContext2D
  /** 描画するテキスト */
  text: string
  /** カラム中心の x 座標（ピクセル） */
  x: number
  /** 開始 y 座標（ピクセル）—最初の文字の上端 */
  y: number
  /** フォントサイズ（ピクセル） */
  fontSize: number
  /** 文字間の余白（fontSize に対する倍率, デフォルト 0.05） */
  charGap?: number
  /** アラビア数字を漢数字に変換するか */
  convertNumbers?: boolean
}

/**
 * 1列の縦書きテキストを描画し、消費した高さ（ピクセル）を返す。
 * ctx の fillStyle / font は呼び出し側で設定すること。
 */
export function drawVerticalColumn(opts: DrawVerticalColumnOptions): number {
  const { ctx, x, y, fontSize, charGap = 0.05, convertNumbers = false } = opts
  const text = convertNumbers ? toKanjiNumerals(opts.text) : opts.text
  const chars = [...text] // サロゲートペア対応
  const cellHeight = fontSize * (1 + charGap)

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let currentY = y + fontSize / 2

  for (const char of chars) {
    const cx = x
    const cy = currentY

    if (ROTATE_90.has(char)) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.PI / 2)
      ctx.fillText(char, 0, 0)
      ctx.restore()
    } else if (SMALL_KANA.has(char)) {
      // 小さいかなは右上方向にずらす
      ctx.fillText(char, cx + fontSize * 0.12, cy - fontSize * 0.1)
    } else if (char in PUNCT_OFFSET) {
      const [dx, dy] = PUNCT_OFFSET[char]
      ctx.fillText(char, cx + fontSize * dx, cy + fontSize * dy)
    } else {
      ctx.fillText(char, cx, cy)
    }

    currentY += cellHeight
  }

  ctx.restore()
  return chars.length * cellHeight
}

export interface DrawVerticalBlockOptions {
  ctx: CanvasRenderingContext2D
  /** 各要素が1列になる文字列の配列（右から左へ並ぶ） */
  lines: string[]
  /** 右端の x 座標（ピクセル） */
  rightX: number
  /** 上端の y 座標（ピクセル） */
  topY: number
  /** フォントサイズ（ピクセル） */
  fontSize: number
  /** 列間の水平余白（ピクセル, デフォルト fontSize * 0.2） */
  columnGap?: number
  /** 文字間の余白（fontSize に対する倍率, デフォルト 0.05） */
  charGap?: number
  /** アラビア数字を漢数字に変換するか */
  convertNumbers?: boolean
}

/**
 * 複数列の縦書きテキストブロックを描画する。
 * lines[0] が最右列、lines[1] が左隣、... となる。
 */
export function drawVerticalBlock(opts: DrawVerticalBlockOptions): void {
  const { ctx, lines, rightX, topY, fontSize, columnGap, charGap, convertNumbers } = opts
  const colGap = columnGap ?? fontSize * 0.2
  const colWidth = fontSize + colGap

  lines.forEach((line, i) => {
    if (!line) return
    const colCenterX = rightX - fontSize / 2 - colWidth * i
    drawVerticalColumn({
      ctx,
      text: line,
      x: colCenterX,
      y: topY,
      fontSize,
      charGap,
      convertNumbers,
    })
  })
}
