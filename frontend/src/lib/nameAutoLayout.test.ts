import { describe, expect, it } from 'vitest'
import { fitHorizontalNameFontPx, fitVerticalNameFontPx } from './nameAutoLayout'

describe('fitHorizontalNameFontPx', () => {
  it('収まる場合は元サイズを維持する', () => {
    expect(fitHorizontalNameFontPx(40, 180, 200)).toBe(40)
  })

  it('はみ出す場合は縮小する', () => {
    const fitted = fitHorizontalNameFontPx(40, 240, 180)
    expect(fitted).toBeLessThan(40)
    expect(fitted).toBeCloseTo(30)
  })

  it('縮小下限を下回らない', () => {
    const fitted = fitHorizontalNameFontPx(40, 1000, 100)
    expect(fitted).toBeCloseTo(24) // 40 * 0.6
  })
})

describe('fitVerticalNameFontPx', () => {
  it('収まる場合は元サイズを維持する', () => {
    expect(fitVerticalNameFontPx(40, 4, 200)).toBe(40)
  })

  it('文字数が多い場合は縮小する', () => {
    const fitted = fitVerticalNameFontPx(40, 10, 300)
    expect(fitted).toBeLessThan(40)
  })

  it('縦方向でも縮小下限を下回らない', () => {
    const fitted = fitVerticalNameFontPx(40, 30, 100)
    expect(fitted).toBeCloseTo(24) // 40 * 0.6
  })
})

