import { describe, it, expect, beforeEach } from 'vitest'
import { useLabelStore } from './labelStore'
import type { Sender } from '../types'

const defaultLayout = {
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
  offsetX: 0,
  offsetY: 0,
}

const makeSender = (): Sender => ({
  id: 's1',
  familyName: '山田',
  givenName: '花子',
  postalCode: '200-0001',
  prefecture: '神奈川県',
  city: '横浜市',
  street: '1-1',
  building: '',
  company: '',
  isDefault: true,
})

beforeEach(() => {
  useLabelStore.setState({ layout: { ...defaultLayout }, selectedSender: null })
})

describe('labelStore', () => {
  it('初期状態', () => {
    const s = useLabelStore.getState()
    expect(s.layout).toEqual(defaultLayout)
    expect(s.selectedSender).toBeNull()
  })

  it('setLayout: 部分更新', () => {
    useLabelStore.getState().setLayout({ columns: 3, rows: 8 })
    const l = useLabelStore.getState().layout
    expect(l.columns).toBe(3)
    expect(l.rows).toBe(8)
    expect(l.paperWidth).toBe(210)
  })

  it('setLayout: 複数プロパティの同時更新', () => {
    useLabelStore.getState().setLayout({ marginTop: 20, marginLeft: 15, gapX: 5 })
    const l = useLabelStore.getState().layout
    expect(l.marginTop).toBe(20)
    expect(l.marginLeft).toBe(15)
    expect(l.gapX).toBe(5)
    expect(l.gapY).toBe(0)
  })

  it('setSelectedSender: 送り主をセット', () => {
    const sender = makeSender()
    useLabelStore.getState().setSelectedSender(sender)
    expect(useLabelStore.getState().selectedSender).toEqual(sender)
  })

  it('setSelectedSender: nullでクリア', () => {
    useLabelStore.getState().setSelectedSender(makeSender())
    useLabelStore.getState().setSelectedSender(null)
    expect(useLabelStore.getState().selectedSender).toBeNull()
  })
})
