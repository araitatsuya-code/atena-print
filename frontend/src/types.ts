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

export interface CSVImportField {
  key: string
  label: string
  required: boolean
}

export interface CSVImportPlan {
  headers: string[]
  sampleRows: string[][]
  suggestedMapping: Record<string, number>
  fieldDefinitions: CSVImportField[]
  rowCount: number
  duplicateRule: string
}

export interface CSVContactSnapshot {
  id?: string
  displayName: string
  postalCode: string
  prefecture: string
  city: string
  street: string
  company: string
}

export interface CSVDuplicateCandidate {
  rowNumber: number
  incoming: CSVContactSnapshot
  existing: CSVContactSnapshot
  suggestedAction: 'new' | 'overwrite' | 'skip'
}

export interface CSVImportAnalysis {
  duplicateRule: string
  validRowCount: number
  errors: string[]
  duplicates: CSVDuplicateCandidate[]
}

export interface CSVDuplicateResolution {
  rowNumber: number
  action: 'new' | 'overwrite' | 'skip'
}

export interface CSVImportExecutionResult {
  totalRows: number
  created: number
  updated: number
  skipped: number
  duplicateResolved: number
  errors: string[]
}

export interface AddressNormalizationAddress {
  prefecture: string
  city: string
  street: string
}

export interface AddressNormalizationDiff {
  field: 'prefecture' | 'city' | 'street'
  before: string
  after: string
}

export interface AddressNormalizationCandidate {
  contactId: string
  displayName: string
  postalCode: string
  before: AddressNormalizationAddress
  after: AddressNormalizationAddress
  diffs: AddressNormalizationDiff[]
}

export interface AddressNormalizationPreview {
  totalContacts: number
  convertibleCount: number
  candidates: AddressNormalizationCandidate[]
  canRollback: boolean
  rollbackBatchId?: string
}

export interface AddressNormalizationSelection {
  contactId: string
  apply: boolean
}

export interface AddressNormalizationApplyResult {
  batchId?: string
  appliedCount: number
  skippedCount: number
  failedCount: number
  errors: string[]
  canRollback: boolean
}

export interface AddressNormalizationRollbackResult {
  batchId?: string
  restoredCount: number
  failedCount: number
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

export interface BackupTimingSettings {
  onStartup: boolean
  onShutdown: boolean
  intervalMinutes: number
}

export interface BackupSettings {
  timing: BackupTimingSettings
  maxGenerations: number
}

export interface BackupGeneration {
  id: string
  createdAt: string
  contactCount: number
  trigger: string
}

export interface RestoreBackupResult {
  restored: boolean
  backupId: string
  preservedBackupId: string
  restartRequired: boolean
}

export type View = 'workspace' | 'settings'
