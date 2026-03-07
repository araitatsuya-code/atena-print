import { describe, it, expect, beforeEach } from 'vitest'
import { useDecorationStore } from './decorationStore'
import type { Watermark, QRConfig } from '../types'

const defaultQRConfig: QRConfig = {
  enabled: false,
  content: '',
  size: 40,
  position: 'bottom-right',
}

beforeEach(() => {
  useDecorationStore.setState({ watermark: null, qrConfig: defaultQRConfig, showDecoPanel: false })
})

describe('decorationStore', () => {
  it('初期状態', () => {
    const s = useDecorationStore.getState()
    expect(s.watermark).toBeNull()
    expect(s.qrConfig).toEqual(defaultQRConfig)
  })

  it('setWatermark: 値をセット', () => {
    const wm: Watermark = { id: 'w1', name: '年賀', type: 'preset', filePath: '/path', opacity: 0.5 }
    useDecorationStore.getState().setWatermark(wm)
    expect(useDecorationStore.getState().watermark).toEqual(wm)
  })

  it('setWatermark: nullでクリア', () => {
    const wm: Watermark = { id: 'w1', name: '年賀', type: 'preset', filePath: '/path', opacity: 0.5 }
    useDecorationStore.setState({ watermark: wm })
    useDecorationStore.getState().setWatermark(null)
    expect(useDecorationStore.getState().watermark).toBeNull()
  })

  it('setQRConfig: 部分更新', () => {
    useDecorationStore.getState().setQRConfig({ enabled: true, content: 'https://example.com' })
    const qr = useDecorationStore.getState().qrConfig
    expect(qr.enabled).toBe(true)
    expect(qr.content).toBe('https://example.com')
    expect(qr.size).toBe(40)
    expect(qr.position).toBe('bottom-right')
  })

  it('setQRConfig: positionの変更', () => {
    useDecorationStore.getState().setQRConfig({ position: 'top-left' })
    expect(useDecorationStore.getState().qrConfig.position).toBe('top-left')
  })

  it('toggleDecoPanel: ON/OFFが切り替わる', () => {
    expect(useDecorationStore.getState().showDecoPanel).toBe(false)
    useDecorationStore.getState().toggleDecoPanel()
    expect(useDecorationStore.getState().showDecoPanel).toBe(true)
    useDecorationStore.getState().toggleDecoPanel()
    expect(useDecorationStore.getState().showDecoPanel).toBe(false)
  })
})
