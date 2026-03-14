import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  offsetX: 0,
  offsetY: 0,
}

interface LabelState {
  layout: LabelLayout
  orientation: 'vertical' | 'horizontal'
  selectedSender: Sender | null
  showPanel: boolean
  setLayout: (layout: Partial<LabelLayout>) => void
  setOrientation: (orientation: 'vertical' | 'horizontal') => void
  setSelectedSender: (sender: Sender | null) => void
  togglePanel: () => void
  resetOffset: () => void
}

export const useLabelStore = create<LabelState>()(
  persist(
    (set, get) => ({
      layout: defaultLayout,
      orientation: 'vertical',
      selectedSender: null,
      showPanel: false,
      setLayout: (layout) => set({ layout: { ...get().layout, ...layout } }),
      setOrientation: (orientation) => set({ orientation }),
      setSelectedSender: (sender) => set({ selectedSender: sender }),
      togglePanel: () => set({ showPanel: !get().showPanel }),
      resetOffset: () => set({ layout: { ...get().layout, offsetX: 0, offsetY: 0 } }),
    }),
    {
      name: 'atena-label-layout',
      partialize: (state) => ({ layout: state.layout, orientation: state.orientation }),
      // 旧バージョンの保存データに offsetX/offsetY がない場合でも安全にマージ
      merge: (persisted, current) => {
        const saved = persisted as Partial<LabelState>
        return {
          ...current,
          layout: { ...defaultLayout, ...saved.layout },
          orientation: saved.orientation ?? current.orientation,
        }
      },
    },
  ),
)
