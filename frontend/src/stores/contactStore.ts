import { create } from 'zustand'
import type { Contact, ContactYearStatus } from '../types'

interface ContactState {
  contacts: Contact[]
  selectedIds: Set<string>
  currentGroupId: string
  searchQuery: string
  annualStatusYear: number
  annualStatuses: Record<string, ContactYearStatus>
  annualStatusesLoadedYear: number | null
  annualStatusesLoading: boolean
  setContacts: (contacts: Contact[]) => void
  setSelectedIds: (ids: Set<string>) => void
  toggleSelected: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  setCurrentGroupId: (groupId: string) => void
  setSearchQuery: (query: string) => void
  setAnnualStatusYear: (year: number) => void
  setAnnualStatusesLoading: (loading: boolean) => void
  setAnnualStatuses: (year: number, statuses: ContactYearStatus[]) => void
  upsertAnnualStatuses: (statuses: ContactYearStatus[]) => void
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  selectedIds: new Set(),
  currentGroupId: '',
  searchQuery: '',
  annualStatusYear: new Date().getFullYear(),
  annualStatuses: {},
  annualStatusesLoadedYear: null,
  annualStatusesLoading: false,

  setContacts: (contacts) => set({ contacts }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelected: (id) => {
    const ids = new Set(get().selectedIds)
    if (ids.has(id)) {
      ids.delete(id)
    } else {
      ids.add(id)
    }
    set({ selectedIds: ids })
  },

  selectAll: () => {
    const ids = new Set(get().contacts.map((c) => c.id))
    set({ selectedIds: ids })
  },

  clearSelection: () => set({ selectedIds: new Set() }),
  setCurrentGroupId: (groupId) => set({ currentGroupId: groupId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setAnnualStatusYear: (year) =>
    set((state) =>
      state.annualStatusYear === year
        ? { annualStatusYear: year }
        : {
            annualStatusYear: year,
            annualStatuses: {},
            annualStatusesLoadedYear: null,
            annualStatusesLoading: false,
          },
    ),
  setAnnualStatusesLoading: (loading) => set({ annualStatusesLoading: loading }),
  setAnnualStatuses: (year, statuses) =>
    set((state) => {
      if (state.annualStatusYear !== year) {
        return state
      }
      return {
        annualStatuses: Object.fromEntries(statuses.map((status) => [status.contactId, status])),
        annualStatusesLoadedYear: year,
        annualStatusesLoading: false,
      }
    }),
  upsertAnnualStatuses: (statuses) =>
    set((state) => {
      const next = { ...state.annualStatuses }
      statuses.forEach((status) => {
        if (status.year !== state.annualStatusYear) {
          return
        }
        next[status.contactId] = status
      })
      return { annualStatuses: next }
    }),
}))
