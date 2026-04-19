import { describe, it, expect, beforeEach } from 'vitest'
import { useContactStore } from './contactStore'
import type { Contact, ContactYearStatus } from '../types'

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
  useContactStore.setState({
    contacts: [],
    selectedIds: new Set(),
    currentGroupId: '',
    searchQuery: '',
    annualStatusYear: new Date().getFullYear(),
    annualStatuses: {},
    annualStatusesLoadedYear: null,
    annualStatusesLoading: false,
  })
})

describe('contactStore', () => {
  it('初期状態', () => {
    const s = useContactStore.getState()
    expect(s.contacts).toEqual([])
    expect(s.selectedIds.size).toBe(0)
    expect(s.currentGroupId).toBe('')
    expect(s.searchQuery).toBe('')
    expect(s.annualStatusYear).toBe(new Date().getFullYear())
    expect(s.annualStatuses).toEqual({})
    expect(s.annualStatusesLoadedYear).toBeNull()
    expect(s.annualStatusesLoading).toBe(false)
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

  it('setAnnualStatusYear: 年切替時に年次ステータスをクリア', () => {
    const status: ContactYearStatus = {
      contactId: '1',
      year: 2026,
      sent: true,
      received: false,
      mourning: false,
      createdAt: '',
      updatedAt: '',
    }
    useContactStore.setState({
      annualStatusYear: 2026,
      annualStatuses: { '1': status },
      annualStatusesLoadedYear: 2026,
      annualStatusesLoading: true,
    })
    useContactStore.getState().setAnnualStatusYear(2027)
    expect(useContactStore.getState().annualStatusYear).toBe(2027)
    expect(useContactStore.getState().annualStatuses).toEqual({})
    expect(useContactStore.getState().annualStatusesLoadedYear).toBeNull()
    expect(useContactStore.getState().annualStatusesLoading).toBe(false)
  })

  it('setAnnualStatusesLoading', () => {
    useContactStore.getState().setAnnualStatusesLoading(true)
    expect(useContactStore.getState().annualStatusesLoading).toBe(true)
  })

  it('setAnnualStatuses', () => {
    const status: ContactYearStatus = {
      contactId: '1',
      year: 2026,
      sent: true,
      received: false,
      mourning: false,
      createdAt: '',
      updatedAt: '',
    }
    useContactStore.getState().setAnnualStatusYear(2026)
    useContactStore.getState().setAnnualStatuses(2026, [status])
    expect(useContactStore.getState().annualStatuses).toEqual({ '1': status })
    expect(useContactStore.getState().annualStatusesLoadedYear).toBe(2026)
    expect(useContactStore.getState().annualStatusesLoading).toBe(false)
  })

  it('setAnnualStatuses: 現在年と異なるレスポンスは無視', () => {
    const status: ContactYearStatus = {
      contactId: '1',
      year: 2026,
      sent: true,
      received: false,
      mourning: false,
      createdAt: '',
      updatedAt: '',
    }
    useContactStore.setState({ annualStatusYear: 2027 })
    useContactStore.getState().setAnnualStatuses(2026, [status])
    expect(useContactStore.getState().annualStatuses).toEqual({})
    expect(useContactStore.getState().annualStatusesLoadedYear).toBeNull()
  })

  it('upsertAnnualStatuses', () => {
    const base: ContactYearStatus = {
      contactId: '1',
      year: 2026,
      sent: false,
      received: false,
      mourning: false,
      createdAt: '',
      updatedAt: '',
    }
    const updated: ContactYearStatus = { ...base, sent: true, updatedAt: '2026-01-01T00:00:00Z' }
    const another: ContactYearStatus = { ...base, contactId: '2' }
    useContactStore.getState().setAnnualStatusYear(2026)
    useContactStore.getState().setAnnualStatuses(2026, [base])
    useContactStore.getState().upsertAnnualStatuses([updated, another])
    expect(useContactStore.getState().annualStatuses['1'].sent).toBe(true)
    expect(useContactStore.getState().annualStatuses['2'].contactId).toBe('2')
  })

  it('upsertAnnualStatuses: 現在年と異なるデータはマージしない', () => {
    const base: ContactYearStatus = {
      contactId: '1',
      year: 2026,
      sent: false,
      received: false,
      mourning: false,
      createdAt: '',
      updatedAt: '',
    }
    const anotherYear: ContactYearStatus = { ...base, contactId: '2', year: 2027, sent: true }
    useContactStore.getState().setAnnualStatusYear(2026)
    useContactStore.getState().setAnnualStatuses(2026, [base])
    useContactStore.getState().upsertAnnualStatuses([anotherYear])
    expect(useContactStore.getState().annualStatuses['2']).toBeUndefined()
  })
})
