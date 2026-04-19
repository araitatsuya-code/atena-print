// Go entity に対応する TypeScript 型定義

export interface Contact {
  id: string
  familyName: string
  givenName: string
  familyNameKana: string
  givenNameKana: string
  isPrintTarget: boolean
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
  offsetX: number // mm 印刷位置補正
  offsetY: number // mm 印刷位置補正
}

export interface PostalConfig {
  x: number
  y: number
  digitSpacing: number
  fontSize: number
  fontFamily?: 'serif' | 'sans-serif'
  bold?: boolean
}

export interface TextConfig {
  nameX: number
  nameY: number
  nameFont: number
  nameFontFamily?: 'serif' | 'sans-serif'
  nameBold?: boolean
  addressX: number
  addressY: number
  addressFont: number
  addressFontFamily?: 'serif' | 'sans-serif'
  addressBold?: boolean
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

export interface PrintHistory {
  id: string
  printedAt: string
  contactCount: number
  templateId: string
  watermarkId: string
  qrEnabled: boolean
}

export interface DashboardStats {
  contactCount: number
  groupCount: number
}

export type View = 'dashboard' | 'contacts' | 'preview' | 'senders' | 'settings'
