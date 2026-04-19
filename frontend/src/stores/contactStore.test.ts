import { describe, it, expect, beforeEach } from 'vitest'
import { useContactStore } from './contactStore'
import type { Contact } from '../types'

const makeContact = (id: string, familyName: string): Contact => ({
  id,
  familyName,
  givenName: '太郎',
  familyNameKana: 'タナカ',
  givenNameKana: 'タロウ',
  isPrintTarget: true,
  honorific: '様',
  postalCode: '100-0001',
  prefecture: '東京都',
  city: '千代田区',
  street: '1-1',
  building: '',
  company: '',
  department: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
})

beforeEach(() => {
  useContactStore.setState({ contacts: [], selectedIds: new Set(), currentGroupId: '', searchQuery: '' })
})

describe('contactStore', () => {
  it('初期状態', () => {
    const s = useContactStore.getState()
    expect(s.contacts).toEqual([])
    expect(s.selectedIds.size).toBe(0)
    expect(s.currentGroupId).toBe('')
    expect(s.searchQuery).toBe('')
  })

  it('setContacts', () => {
    const contacts = [makeContact('1', '田中'), makeContact('2', '鈴木')]
    useContactStore.getState().setContacts(contacts)
    expect(useContactStore.getState().contacts).toEqual(contacts)
  })

  it('toggleSelected: 未選択→選択', () => {
    useContactStore.getState().setContacts([makeContact('1', '田中')])
    useContactStore.getState().toggleSelected('1')
    expect(useContactStore.getState().selectedIds.has('1')).toBe(true)
  })

  it('toggleSelected: 選択済→解除', () => {
    useContactStore.setState({ selectedIds: new Set(['1']) })
    useContactStore.getState().toggleSelected('1')
    expect(useContactStore.getState().selectedIds.has('1')).toBe(false)
  })

  it('selectAll: 全件選択', () => {
    useContactStore.getState().setContacts([makeContact('1', '田中'), makeContact('2', '鈴木')])
    useContactStore.getState().selectAll()
    const ids = useContactStore.getState().selectedIds
    expect(ids.has('1')).toBe(true)
    expect(ids.has('2')).toBe(true)
    expect(ids.size).toBe(2)
  })

  it('clearSelection', () => {
    useContactStore.setState({ selectedIds: new Set(['1', '2']) })
    useContactStore.getState().clearSelection()
    expect(useContactStore.getState().selectedIds.size).toBe(0)
  })

  it('setCurrentGroupId', () => {
    useContactStore.getState().setCurrentGroupId('family')
    expect(useContactStore.getState().currentGroupId).toBe('family')
  })

  it('setSearchQuery', () => {
    useContactStore.getState().setSearchQuery('田中')
    expect(useContactStore.getState().searchQuery).toBe('田中')
  })
})
