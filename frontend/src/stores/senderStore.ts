import { create } from 'zustand'
import type { Sender } from '../types'

interface SenderState {
  senders: Sender[]
  setSenders: (senders: Sender[]) => void
}

export const useSenderStore = create<SenderState>((set) => ({
  senders: [],
  setSenders: (senders) => set({ senders }),
}))
