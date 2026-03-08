import { create } from 'zustand'
import type { LabelLayout, Sender } from '../types'

const defaultLayout: LabelLayout = {
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
}

interface LabelState {
  layout: LabelLayout
  selectedSender: Sender | null
  showPanel: boolean
  setLayout: (layout: Partial<LabelLayout>) => void
  setSelectedSender: (sender: Sender | null) => void
  togglePanel: () => void
}

export const useLabelStore = create<LabelState>((set, get) => ({
  layout: defaultLayout,
  selectedSender: null,
  showPanel: false,
  setLayout: (layout) => set({ layout: { ...get().layout, ...layout } }),
  setSelectedSender: (sender) => set({ selectedSender: sender }),
  togglePanel: () => set({ showPanel: !get().showPanel }),
}))
