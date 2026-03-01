import { describe, it, expect, beforeEach } from 'vitest'
import { usePreviewStore } from './previewStore'
import type { Template } from '../types'

const makeTemplate = (): Template => ({
  id: 't1',
  name: '標準縦書き',
  orientation: 'vertical',
  labelWidth: 86.4,
  labelHeight: 42.3,
  recipient: { nameX: 30, nameY: 20, nameFont: 14, addressX: 20, addressY: 30, addressFont: 10 },
  sender: { nameX: 70, nameY: 70, nameFont: 8, addressX: 65, addressY: 80, addressFont: 6 },
})

beforeEach(() => {
  usePreviewStore.setState({ selectedTemplate: null, zoom: 1, previewContactIndex: 0 })
})

describe('previewStore', () => {
  it('初期状態', () => {
    const s = usePreviewStore.getState()
    expect(s.selectedTemplate).toBeNull()
    expect(s.zoom).toBe(1)
    expect(s.previewContactIndex).toBe(0)
  })

  it('setSelectedTemplate', () => {
    const tmpl = makeTemplate()
    usePreviewStore.getState().setSelectedTemplate(tmpl)
    expect(usePreviewStore.getState().selectedTemplate).toEqual(tmpl)
  })

  it('setSelectedTemplate: nullでクリア', () => {
    usePreviewStore.getState().setSelectedTemplate(makeTemplate())
    usePreviewStore.getState().setSelectedTemplate(null)
    expect(usePreviewStore.getState().selectedTemplate).toBeNull()
  })

  it('setZoom', () => {
    usePreviewStore.getState().setZoom(1.5)
    expect(usePreviewStore.getState().zoom).toBe(1.5)
  })

  it('setPreviewContactIndex', () => {
    usePreviewStore.getState().setPreviewContactIndex(3)
    expect(usePreviewStore.getState().previewContactIndex).toBe(3)
  })
})
