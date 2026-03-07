import { create } from 'zustand'
import type { Watermark, QRConfig } from '../types'

interface DecorationState {
  watermark: Watermark | null
  qrConfig: QRConfig
  showDecoPanel: boolean
  setWatermark: (watermark: Watermark | null) => void
  setQRConfig: (config: Partial<QRConfig>) => void
  toggleDecoPanel: () => void
}

const defaultQRConfig: QRConfig = {
  enabled: false,
  content: '',
  size: 40,
  position: 'bottom-right',
}

export const useDecorationStore = create<DecorationState>((set, get) => ({
  watermark: null,
  qrConfig: defaultQRConfig,
  showDecoPanel: false,
  setWatermark: (watermark) => set({ watermark }),
  setQRConfig: (config) => set({ qrConfig: { ...get().qrConfig, ...config } }),
  toggleDecoPanel: () => set({ showDecoPanel: !get().showDecoPanel }),
}))
