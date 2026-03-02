import { create } from 'zustand'
import type { Contact } from '../types'

interface ContactState {
  contacts: Contact[]
  selectedIds: Set<string>
  currentGroupId: string
  searchQuery: string
  setContacts: (contacts: Contact[]) => void
  setSelectedIds: (ids: Set<string>) => void
  toggleSelected: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  setCurrentGroupId: (groupId: string) => void
  setSearchQuery: (query: string) => void
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  selectedIds: new Set(),
  currentGroupId: '',
  searchQuery: '',

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
}))
