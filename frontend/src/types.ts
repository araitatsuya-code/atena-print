// Go entity に対応する TypeScript 型定義

export interface Contact {
  id: string
  familyName: string
  givenName: string
  familyNameKana: string
  givenNameKana: string
  honorific: string
  postalCode: string
  prefecture: string
  city: string
  street: string
  building: string
  company: string
  department: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Sender {
  id: string
  familyName: string
  givenName: string
  postalCode: string
  prefecture: string
  city: string
  street: string
  building: string
  company: string
  isDefault: boolean
}

export interface Group {
  id: string
  name: string
}

export interface Watermark {
  id: string
  name: string
  type: 'preset' | 'custom'
  filePath: string
  opacity: number
}

export interface QRConfig {
  enabled: boolean
  content: string
  size: number
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export interface LabelLayout {
  paperWidth: number
  paperHeight: number
  labelWidth: number
  labelHeight: number
  columns: number
  rows: number
  marginTop: number
  marginLeft: number
  gapX: number
  gapY: number
}

export interface PostalConfig {
  x: number
  y: number
  digitSpacing: number
  fontSize: number
}

export interface TextConfig {
  nameX: number
  nameY: number
  nameFont: number
  addressX: number
  addressY: number
  addressFont: number
}

export interface Template {
  id: string
  name: string
  orientation: 'vertical' | 'horizontal'
  labelWidth: number
  labelHeight: number
  postalCode?: PostalConfig
  recipient: TextConfig
  sender: TextConfig
}

export interface ImportResult {
  total: number
  imported: number
  errors: string[]
}

export type View = 'contacts' | 'preview' | 'senders' | 'settings'
