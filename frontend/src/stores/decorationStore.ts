import { create } from 'zustand'
import type { Watermark, QRConfig } from '../types'

interface DecorationState {
  watermark: Watermark | null
  qrConfig: QRConfig
  setWatermark: (watermark: Watermark | null) => void
  setQRConfig: (config: Partial<QRConfig>) => void
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
  setWatermark: (watermark) => set({ watermark }),
  setQRConfig: (config) => set({ qrConfig: { ...get().qrConfig, ...config } }),
}))
