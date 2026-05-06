import type { Contact, Template } from '../types'

export type PreprintWarningKind = 'required' | 'overflow' | 'unsupported'

export interface PreprintWarning {
  id: string
  kind: PreprintWarningKind
  contactId: string
  contactName: string
  message: string
}

interface UnsupportedCharacterWarningLike {
  contactId: string
  contactName: string
  characters: string[]
}

const JOINT_NAME_SEPARATOR = /[・･/／&＆]/
const PT_TO_MM = 25.4 / 72
const EPSILON = 1e-6

const RULES = {
  horizontalMinFontPt: 7,
  horizontalSplitThresholdChars: 12,
  horizontalLineHeight: 1.35,
  horizontalRightPaddingMm: 2,
  horizontalBottomPaddingMm: 2,
  horizontalAddressGapMm: 1.2,
  horizontalGlyphWidthRatio: 0.95,
  verticalMinFontPt: 6,
  verticalBottomPaddingMm: 2,
  verticalLeftPaddingMm: 2,
  verticalAddressGapMm: 1.2,
  verticalColumnGapRatio: 0.2,
  verticalCharHeightRatio: 1.05,
  maxVerticalColumns: 3,
} as const

function ptToMm(valuePt: number): number {
  return valuePt * PT_TO_MM
}

function contactName(contact: Contact): string {
  const fullName = `${contact.familyName}${contact.givenName}`.trim()
  return fullName || contact.id
}

function estimateTextUnits(text: string): number {
  let units = 0
  for (const ch of [...text]) {
    if (ch === ' ' || ch === '\u3000') {
      units += 0.55
    } else if (/^[\u0020-\u007E\uFF61-\uFF9F]$/.test(ch)) {
      units += 0.55
    } else if (ch === 'ー' || ch === 'ｰ' || ch === '-') {
      units += 0.8
    } else {
      units += 1
    }
  }
  return units
}

function estimateLineWidthMm(text: string, fontPt: number): number {
  return estimateTextUnits(text) * ptToMm(fontPt) * RULES.horizontalGlyphWidthRatio
}

function listFontCandidates(basePt: number, minPt: number): number[] {
  const floor = Math.min(basePt, minPt)
  if (basePt <= floor + EPSILON) return [basePt]

  const out: number[] = []
  for (let pt = basePt; pt >= floor - EPSILON; pt -= 0.5) {
    out.push(Math.round(pt * 10) / 10)
  }
  if (Math.abs(out[out.length - 1] - floor) > EPSILON) {
    out.push(floor)
  }
  return [...new Set(out)]
}

function splitEvenly(text: string, pieces: number): string[] {
  const chars = [...text]
  if (pieces <= 1 || chars.length <= 1) return [text]

  const bucketCount = Math.min(pieces, chars.length)
  const out: string[] = []
  let index = 0
  for (let i = 0; i < bucketCount; i++) {
    const remainingChars = chars.length - index
    const remainingBuckets = bucketCount - i
    const take = Math.ceil(remainingChars / remainingBuckets)
    out.push(chars.slice(index, index + take).join(''))
    index += take
  }
  return out.filter(Boolean)
}

function splitJointNameBody(nameBody: string): string[] {
  const out: string[] = []
  let buf = ''
  for (const ch of [...nameBody]) {
    if (JOINT_NAME_SEPARATOR.test(ch)) {
      if (buf) {
        out.push(`${buf}${ch}`)
        buf = ''
      }
      continue
    }
    buf += ch
  }
  if (buf) out.push(buf)
  return out.length >= 2 ? out : []
}

function buildHorizontalNameCandidates(contact: Contact, honorific: string): string[][] {
  const nameBody = `${contact.familyName}${contact.givenName}`
  const defaultNameLine = `${nameBody}\u3000${honorific}`
  const company = contact.company.trim()
  const department = contact.department.trim()
  const orgLines = [company, department].filter(Boolean)

  let splitNameLines: string[] = [defaultNameLine]
  const jointParts = splitJointNameBody(nameBody)
  if (jointParts.length >= 2) {
    splitNameLines = [...jointParts]
    splitNameLines[splitNameLines.length - 1] = `${splitNameLines[splitNameLines.length - 1]}\u3000${honorific}`
  } else if ([...nameBody].length >= RULES.horizontalSplitThresholdChars) {
    const [first, second] = splitEvenly(nameBody, 2)
    if (first && second) {
      splitNameLines = [first, `${second}\u3000${honorific}`]
    }
  }

  const mergedOrgLines = orgLines.length > 1 ? [orgLines.join(' ')] : orgLines
  const keys = new Set<string>()
  const candidates: string[][] = []
  const add = (lines: string[]) => {
    const normalized = lines.filter(Boolean)
    if (normalized.length === 0) return
    const key = normalized.join('\n')
    if (keys.has(key)) return
    keys.add(key)
    candidates.push(normalized)
  }

  add([...orgLines, defaultNameLine])
  add([...orgLines, ...splitNameLines])
  add([...mergedOrgLines, defaultNameLine])
  add([...mergedOrgLines, ...splitNameLines])
  add([defaultNameLine])
  add(splitNameLines)

  return candidates
}

function hasHorizontalNameOverflow(contact: Contact, template: Template): boolean {
  const recipient = template.recipient
  const honorific = contact.honorific || '様'
  const candidates = buildHorizontalNameCandidates(contact, honorific)
  const baseFontPt = recipient.nameFont
  const minFontPt = Math.min(baseFontPt, RULES.horizontalMinFontPt)

  const availableWidthMm = Math.max(10, template.labelWidth - recipient.nameX - RULES.horizontalRightPaddingMm)
  let availableHeightMm = template.labelHeight - recipient.nameY - RULES.horizontalBottomPaddingMm
  if (recipient.addressY > recipient.nameY) {
    availableHeightMm = Math.min(
      availableHeightMm,
      recipient.addressY - recipient.nameY - RULES.horizontalAddressGapMm,
    )
  }
  availableHeightMm = Math.max(availableHeightMm, ptToMm(minFontPt) * RULES.horizontalLineHeight)

  const fontCandidates = listFontCandidates(baseFontPt, minFontPt)
  for (const lines of candidates) {
    for (const fontPt of fontCandidates) {
      const lineHeightMm = ptToMm(fontPt) * RULES.horizontalLineHeight
      const requiredHeightMm = lineHeightMm * lines.length
      if (requiredHeightMm > availableHeightMm + EPSILON) continue

      const maxLineWidthMm = lines.reduce((max, line) => Math.max(max, estimateLineWidthMm(line, fontPt)), 0)
      if (maxLineWidthMm <= availableWidthMm + EPSILON) {
        return false
      }
    }
  }

  return true
}

function buildVerticalNameCandidates(nameBody: string, honorific: string): string[][] {
  const fullName = `${nameBody}${honorific}`
  const keys = new Set<string>()
  const candidates: string[][] = []
  const add = (columns: string[]) => {
    const normalized = columns.filter(Boolean)
    if (normalized.length === 0) return
    const key = normalized.join('\n')
    if (keys.has(key)) return
    keys.add(key)
    candidates.push(normalized)
  }

  add([fullName])

  const jointParts = splitJointNameBody(nameBody)
  if (jointParts.length >= 2) {
    const columns = [...jointParts].slice(0, RULES.maxVerticalColumns)
    if (jointParts.length > RULES.maxVerticalColumns) {
      columns[columns.length - 1] += jointParts.slice(RULES.maxVerticalColumns).join('')
    }
    columns[columns.length - 1] = `${columns[columns.length - 1]}${honorific}`
    add(columns)
  }

  for (let cols = 2; cols <= RULES.maxVerticalColumns; cols++) {
    const columns = splitEvenly(nameBody, cols)
    if (columns.length <= 1) continue
    columns[columns.length - 1] = `${columns[columns.length - 1]}${honorific}`
    add(columns)
  }
  return candidates
}

function hasVerticalNameOverflow(contact: Contact, template: Template): boolean {
  const recipient = template.recipient
  const honorific = contact.honorific || '様'
  const nameBody = `${contact.familyName}${contact.givenName}`
  const candidates = buildVerticalNameCandidates(nameBody, honorific)
  const baseFontPt = recipient.nameFont
  const minFontPt = Math.min(baseFontPt, RULES.verticalMinFontPt)
  const fontCandidates = listFontCandidates(baseFontPt, minFontPt)

  const availableHeightMm = Math.max(
    ptToMm(minFontPt) * RULES.verticalCharHeightRatio,
    template.labelHeight - recipient.nameY - RULES.verticalBottomPaddingMm,
  )
  let leftLimitMm: number = RULES.verticalLeftPaddingMm
  if (recipient.addressX > 0 && recipient.addressX < recipient.nameX) {
    leftLimitMm = Math.max(
      leftLimitMm,
      recipient.addressX + ptToMm(recipient.addressFont) * 1.2 + RULES.verticalAddressGapMm,
    )
  }
  const availableWidthMm = Math.max(ptToMm(minFontPt), recipient.nameX - leftLimitMm)

  for (const columns of candidates) {
    const maxChars = columns.reduce((max, value) => Math.max(max, [...value].length), 0)
    if (maxChars <= 0) continue

    for (const fontPt of fontCandidates) {
      const fontMm = ptToMm(fontPt)
      const colGap = fontMm * RULES.verticalColumnGapRatio
      const requiredWidthMm = fontMm * columns.length + colGap * (columns.length - 1)
      const requiredHeightMm = maxChars * fontMm * RULES.verticalCharHeightRatio
      if (requiredWidthMm <= availableWidthMm + EPSILON && requiredHeightMm <= availableHeightMm + EPSILON) {
        return false
      }
    }
  }
  return true
}

function hasHorizontalAddressOverflow(contact: Contact, template: Template): boolean {
  const recipient = template.recipient
  const lines = [
    `${contact.prefecture}${contact.city}`,
    `${contact.street}${contact.building ? `　${contact.building}` : ''}`,
  ].filter(Boolean)
  if (lines.length === 0) return false

  const fontMm = ptToMm(recipient.addressFont)
  const lineHeightMm = fontMm * 1.5
  const availableWidthMm = Math.max(8, template.labelWidth - recipient.addressX - 2)
  const availableHeightMm = Math.max(lineHeightMm, template.labelHeight - recipient.addressY - 2)
  const requiredHeightMm = lineHeightMm * lines.length
  if (requiredHeightMm > availableHeightMm + EPSILON) return true

  return lines.some((line) => estimateLineWidthMm(line, recipient.addressFont) > availableWidthMm + EPSILON)
}

function hasVerticalAddressOverflow(contact: Contact, template: Template): boolean {
  const recipient = template.recipient
  const lines = [
    `${contact.prefecture}${contact.city}`,
    `${contact.street}${contact.building ? `　${contact.building}` : ''}`,
  ].filter(Boolean)
  if (lines.length === 0) return false

  const fontMm = ptToMm(recipient.addressFont)
  const colGap = fontMm * RULES.verticalColumnGapRatio
  const requiredWidthMm = fontMm * lines.length + colGap * (lines.length - 1)
  const availableWidthMm = Math.max(fontMm, recipient.addressX - RULES.verticalLeftPaddingMm)
  if (requiredWidthMm > availableWidthMm + EPSILON) return true

  const maxChars = lines.reduce((max, line) => Math.max(max, [...line].length), 0)
  const requiredHeightMm = maxChars * fontMm * RULES.verticalCharHeightRatio
  const availableHeightMm = Math.max(
    fontMm * RULES.verticalCharHeightRatio,
    template.labelHeight - recipient.addressY - RULES.verticalBottomPaddingMm,
  )
  return requiredHeightMm > availableHeightMm + EPSILON
}

function hasOverflowRisk(contact: Contact, template: Template): boolean {
  if (template.orientation === 'horizontal') {
    return hasHorizontalNameOverflow(contact, template) || hasHorizontalAddressOverflow(contact, template)
  }
  return hasVerticalNameOverflow(contact, template) || hasVerticalAddressOverflow(contact, template)
}

function buildRequiredFieldWarning(contact: Contact): PreprintWarning | null {
  const missingFields: string[] = []
  if (!contact.familyName.trim()) missingFields.push('姓')
  if (!contact.givenName.trim()) missingFields.push('名')
  if (!contact.prefecture.trim()) missingFields.push('都道府県')
  if (!contact.city.trim()) missingFields.push('市区町村')
  if (!contact.street.trim()) missingFields.push('番地')
  if (!contact.postalCode.replace(/\D/g, '')) missingFields.push('郵便番号')

  if (missingFields.length === 0) return null
  return {
    id: `required:${contact.id}`,
    kind: 'required',
    contactId: contact.id,
    contactName: contactName(contact),
    message: `必須項目不足: ${missingFields.join(' / ')}`,
  }
}

function buildOverflowWarning(contact: Contact, template: Template): PreprintWarning | null {
  if (!hasOverflowRisk(contact, template)) return null
  return {
    id: `overflow:${contact.id}`,
    kind: 'overflow',
    contactId: contact.id,
    contactName: contactName(contact),
    message: '文字がはみ出す可能性があります',
  }
}

function buildUnsupportedWarnings(
  unsupportedWarnings: UnsupportedCharacterWarningLike[],
  contactByID: Map<string, Contact>,
): PreprintWarning[] {
  return unsupportedWarnings.map((warning) => {
    const matchedContact = contactByID.get(warning.contactId)
    const name = warning.contactName || (matchedContact ? contactName(matchedContact) : warning.contactId)
    return {
      id: `unsupported:${warning.contactId}:${warning.characters.join('')}`,
      kind: 'unsupported',
      contactId: warning.contactId,
      contactName: name,
      message: `未対応文字: ${warning.characters.join(' ')}`,
    }
  })
}

export function buildPreprintWarnings(
  contacts: Contact[],
  template: Template,
  unsupportedWarnings: UnsupportedCharacterWarningLike[],
): PreprintWarning[] {
  const warnings: PreprintWarning[] = []
  const contactByID = new Map(contacts.map((contact) => [contact.id, contact]))

  for (const contact of contacts) {
    const requiredWarning = buildRequiredFieldWarning(contact)
    if (requiredWarning) {
      warnings.push(requiredWarning)
    }
    const overflowWarning = buildOverflowWarning(contact, template)
    if (overflowWarning) {
      warnings.push(overflowWarning)
    }
  }

  warnings.push(...buildUnsupportedWarnings(unsupportedWarnings, contactByID))

  const priority: Record<PreprintWarningKind, number> = {
    required: 0,
    overflow: 1,
    unsupported: 2,
  }
  warnings.sort((a, b) => {
    if (priority[a.kind] !== priority[b.kind]) {
      return priority[a.kind] - priority[b.kind]
    }
    if (a.contactName !== b.contactName) {
      return a.contactName.localeCompare(b.contactName, 'ja')
    }
    return a.message.localeCompare(b.message, 'ja')
  })

  return warnings
}
