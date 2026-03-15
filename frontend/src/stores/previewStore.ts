import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Template } from '../types'

interface PreviewState {
  selectedTemplate: Template | null
  zoom: number
  previewContactIndex: number
  setSelectedTemplate: (template: Template | null) => void
  setZoom: (zoom: number) => void
  setPreviewContactIndex: (index: number) => void
}

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set) => ({
      selectedTemplate: null,
      zoom: 1,
      previewContactIndex: 0,
      setSelectedTemplate: (template) => set({ selectedTemplate: template }),
      setZoom: (zoom) => set({ zoom }),
      setPreviewContactIndex: (index) => set({ previewContactIndex: index }),
    }),
    {
      name: 'atena-preview',
      partialize: (state) => ({ selectedTemplate: state.selectedTemplate, zoom: state.zoom }),
    },
  ),
)
