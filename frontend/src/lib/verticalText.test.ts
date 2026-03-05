import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toKanjiNumerals,
  drawVerticalColumn,
  drawVerticalBlock,
} from './verticalText'

// Canvas 2D コンテキストのモック
function makeCtx() {
  const calls: string[] = []
  const ctx = {
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    textAlign: '',
    textBaseline: '',
    _calls: calls,
  }
  return ctx as unknown as CanvasRenderingContext2D & { _calls: string[] }
}

// ─── toKanjiNumerals ──────────────────────────────────────────────────────────

describe('toKanjiNumerals', () => {
  it('アラビア数字を漢数字に変換する', () => {
    expect(toKanjiNumerals('123')).toBe('一二三')
    expect(toKanjiNumerals('0')).toBe('〇')
    expect(toKanjiNumerals('9876543210')).toBe('九八七六五四三二一〇')
  })

  it('非数字はそのまま残る', () => {
    expect(toKanjiNumerals('東京都1丁目2番3号')).toBe('東京都一丁目二番三号')
    expect(toKanjiNumerals('ABC')).toBe('ABC')
  })

  it('空文字列を処理できる', () => {
    expect(toKanjiNumerals('')).toBe('')
  })
})

// ─── drawVerticalColumn ───────────────────────────────────────────────────────

describe('drawVerticalColumn', () => {
  let ctx: ReturnType<typeof makeCtx>
  beforeEach(() => {
    ctx = makeCtx()
  })

  it('save/restore で状態を保護する', () => {
    drawVerticalColumn({ ctx, text: 'あ', x: 10, y: 10, fontSize: 12 })
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('1文字を描画する', () => {
    drawVerticalColumn({ ctx, text: 'あ', x: 10, y: 10, fontSize: 12 })
    expect(ctx.fillText).toHaveBeenCalledTimes(1)
    expect(ctx.fillText).toHaveBeenCalledWith('あ', 10, 16) // y + fontSize/2
  })

  it('複数文字を縦に描画する', () => {
    drawVerticalColumn({ ctx, text: 'abc', x: 20, y: 0, fontSize: 10 })
    expect(ctx.fillText).toHaveBeenCalledTimes(3)
    // 各文字の y 座標が cellHeight(10*1.05=10.5) ずつ増加
    const yCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (args: unknown[]) => args[2] as number,
    )
    expect(yCalls[1] - yCalls[0]).toBeCloseTo(10 * 1.05, 1)
    expect(yCalls[2] - yCalls[1]).toBeCloseTo(10 * 1.05, 1)
  })

  it('長音符（ー）は rotate(90度) で描画する', () => {
    drawVerticalColumn({ ctx, text: 'ー', x: 10, y: 10, fontSize: 12 })
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
  })

  it('通常文字では rotate を呼ばない', () => {
    drawVerticalColumn({ ctx, text: '東', x: 10, y: 10, fontSize: 12 })
    expect(ctx.rotate).not.toHaveBeenCalled()
  })

  it('convertNumbers=true で数字を漢数字に変換する', () => {
    drawVerticalColumn({
      ctx,
      text: '1丁目',
      x: 10,
      y: 0,
      fontSize: 10,
      convertNumbers: true,
    })
    const chars = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (args: unknown[]) => args[0] as string,
    )
    expect(chars[0]).toBe('一')
    expect(chars[1]).toBe('丁')
    expect(chars[2]).toBe('目')
  })

  it('convertNumbers=false (デフォルト) は変換しない', () => {
    drawVerticalColumn({ ctx, text: '1丁目', x: 10, y: 0, fontSize: 10 })
    const chars = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (args: unknown[]) => args[0] as string,
    )
    expect(chars[0]).toBe('1')
  })

  it('消費した高さを返す', () => {
    const height = drawVerticalColumn({ ctx, text: 'あいう', x: 10, y: 0, fontSize: 10 })
    // 3文字 × (10 * 1.05)
    expect(height).toBeCloseTo(3 * 10 * 1.05, 5)
  })

  it('空文字列は何も描画せず 0 を返す', () => {
    const height = drawVerticalColumn({ ctx, text: '', x: 10, y: 0, fontSize: 10 })
    expect(ctx.fillText).not.toHaveBeenCalled()
    expect(height).toBe(0)
  })

  it('サロゲートペア（絵文字）を正しく分割する', () => {
    // split('') ではなく [...text] を使うのでサロゲートペアも1文字として扱われる
    drawVerticalColumn({ ctx, text: '🌸テスト', x: 0, y: 0, fontSize: 12 })
    expect(ctx.fillText).toHaveBeenCalledTimes(4) // 🌸, テ, ス, ト
  })
})

// ─── drawVerticalBlock ────────────────────────────────────────────────────────

describe('drawVerticalBlock', () => {
  let ctx: ReturnType<typeof makeCtx>
  beforeEach(() => {
    ctx = makeCtx()
  })

  it('空の lines 配列でも描画しない', () => {
    drawVerticalBlock({ ctx, lines: [], rightX: 100, topY: 0, fontSize: 12 })
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it('空文字列の列はスキップする', () => {
    drawVerticalBlock({
      ctx,
      lines: ['', 'あ'],
      rightX: 100,
      topY: 0,
      fontSize: 12,
    })
    // 'あ' の 1 文字だけ
    expect(ctx.fillText).toHaveBeenCalledTimes(1)
  })

  it('lines[0] が最右列、lines[1] がその左隣', () => {
    drawVerticalBlock({
      ctx,
      lines: ['あ', 'い'],
      rightX: 100,
      topY: 0,
      fontSize: 10,
    })
    const xCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (args: unknown[]) => args[1] as number,
    )
    // lines[0] ('あ') の x > lines[1] ('い') の x
    expect(xCalls[0]).toBeGreaterThan(xCalls[1])
  })
})
