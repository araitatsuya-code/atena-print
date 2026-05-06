import { describe, expect, it } from 'vitest'
import type { Contact, Template } from '../types'
import { buildPreprintWarnings } from './printPreflight'

const baseContact: Contact = {
  id: 'c1',
  familyName: '山田',
  givenName: '太郎',
  familyNameKana: '',
  givenNameKana: '',
  isPrintTarget: true,
  honorific: '様',
  postalCode: '1000001',
  prefecture: '東京都',
  city: '千代田区',
  street: '1-2-3',
  building: 'テストビル',
  company: '',
  department: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
}

const baseTemplate: Template = {
  id: 'tmpl',
  name: 'test',
  orientation: 'horizontal',
  labelWidth: 86.4,
  labelHeight: 42.3,
  recipient: {
    nameX: 8,
    nameY: 8,
    nameFont: 13,
    addressX: 8,
    addressY: 20,
    addressFont: 8.5,
  },
  sender: {
    nameX: 16,
    nameY: 24,
    nameFont: 6.5,
    addressX: 8,
    addressY: 24,
    addressFont: 5.5,
  },
}

describe('buildPreprintWarnings', () => {
  it('必須項目不足を検知する', () => {
    const warnings = buildPreprintWarnings(
      [{ ...baseContact, familyName: '', postalCode: '' }],
      baseTemplate,
      [],
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].kind).toBe('required')
    expect(warnings[0].message).toContain('姓')
    expect(warnings[0].message).toContain('郵便番号')
  })

  it('未対応文字警告を取り込む', () => {
    const warnings = buildPreprintWarnings(
      [baseContact],
      baseTemplate,
      [{ contactId: 'c1', contactName: '山田太郎', characters: ['髙'] }],
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].kind).toBe('unsupported')
    expect(warnings[0].message).toContain('髙')
  })

  it('狭いラベルで文字はみ出し疑いを検知する', () => {
    const warnings = buildPreprintWarnings(
      [
        {
          ...baseContact,
          familyName: '山田太郎次郎三郎四郎五郎六郎七郎八郎九郎十郎',
          givenName: '',
          street: '千代田区千代田1-1-1皇居外苑超長い住所テキスト',
        },
      ],
      {
        ...baseTemplate,
        labelWidth: 24,
        labelHeight: 24,
        recipient: {
          ...baseTemplate.recipient,
          nameX: 5,
          nameY: 4,
          addressX: 5,
          addressY: 13,
        },
      },
      [],
    )

    expect(warnings.some((warning) => warning.kind === 'overflow')).toBe(true)
  })
})
