import { useCallback, useState } from 'react'
import { LookupPostal, SaveContact } from '../../../wailsjs/go/main/App'
import type { Contact } from '../../types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog'

interface Props {
  contact?: Contact  // undefined = 新規作成
  onClose: () => void
  onSaved: () => void
}

const HONORIFICS = ['様', '殿', '御中', '先生']

function emptyContact(): Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    familyName: '',
    givenName: '',
    familyNameKana: '',
    givenNameKana: '',
    honorific: '様',
    postalCode: '',
    prefecture: '',
    city: '',
    street: '',
    building: '',
    company: '',
    department: '',
    notes: '',
  }
}

export default function ContactEditModal({ contact, onClose, onSaved }: Props) {
  const isNew = !contact
  const [form, setForm] = useState<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>(
    contact
      ? {
          familyName: contact.familyName,
          givenName: contact.givenName,
          familyNameKana: contact.familyNameKana,
          givenNameKana: contact.givenNameKana,
          honorific: contact.honorific,
          postalCode: contact.postalCode,
          prefecture: contact.prefecture,
          city: contact.city,
          street: contact.street,
          building: contact.building,
          company: contact.company,
          department: contact.department,
          notes: contact.notes,
        }
      : emptyContact()
  )
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [postalLookupError, setPostalLookupError] = useState<string | null>(null)

  const handlePostalChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setForm((prev) => ({ ...prev, postalCode: raw }))
    setErrors((prev) => ({ ...prev, postalCode: undefined }))
    setPostalLookupError(null)

    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 7) return

    try {
      const addr = await LookupPostal(digits)
      // addr.town (町域名) は Contact.street (番地) とは異なるため自動入力しない。
      // ユーザーが番地を手動入力する想定。
      setForm((prev) => ({
        ...prev,
        prefecture: addr.prefecture,
        city: addr.city,
      }))
    } catch {
      setPostalLookupError('郵便番号が見つかりませんでした')
    }
  }, [])

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const errs: typeof errors = {}
    if (!form.familyName.trim()) errs.familyName = '姓は必須です'
    if (!form.givenName.trim()) errs.givenName = '名は必須です'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await SaveContact({
        id: contact?.id ?? '',
        createdAt: contact?.createdAt ?? null,
        updatedAt: contact?.updatedAt ?? null,
        ...form,
      } as Parameters<typeof SaveContact>[0])
      onSaved()
    } catch (err) {
      console.error(err)
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        {/* ヘッダー */}
        <DialogHeader>
          <DialogTitle>
            {isNew ? '連絡先を追加' : '連絡先を編集'}
          </DialogTitle>
          <DialogClose
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </DialogClose>
        </DialogHeader>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 氏名 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓" required error={errors.familyName}>
              <input
                type="text"
                value={form.familyName}
                onChange={set('familyName')}
                className={inputCls(!!errors.familyName)}
                placeholder="田中"
              />
            </Field>
            <Field label="名" required error={errors.givenName}>
              <input
                type="text"
                value={form.givenName}
                onChange={set('givenName')}
                className={inputCls(!!errors.givenName)}
                placeholder="太郎"
              />
            </Field>
          </div>

          {/* 氏名かな */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓（かな）">
              <input type="text" value={form.familyNameKana} onChange={set('familyNameKana')} className={inputCls()} placeholder="たなか" />
            </Field>
            <Field label="名（かな）">
              <input type="text" value={form.givenNameKana} onChange={set('givenNameKana')} className={inputCls()} placeholder="たろう" />
            </Field>
          </div>

          {/* 敬称 */}
          <Field label="敬称" required>
            <select value={form.honorific} onChange={set('honorific')} className={inputCls()}>
              {HONORIFICS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </Field>

          {/* 郵便番号 */}
          <Field label="郵便番号" error={postalLookupError ?? undefined}>
            <input
              type="text"
              value={form.postalCode}
              onChange={handlePostalChange}
              className={inputCls(!!postalLookupError)}
              placeholder="1000001"
              maxLength={8}
            />
          </Field>

          {/* 都道府県・市区町村 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="都道府県">
              <input type="text" value={form.prefecture} onChange={set('prefecture')} className={inputCls()} placeholder="東京都" />
            </Field>
            <Field label="市区町村">
              <input type="text" value={form.city} onChange={set('city')} className={inputCls()} placeholder="千代田区" />
            </Field>
          </div>

          {/* 番地 */}
          <Field label="番地">
            <input type="text" value={form.street} onChange={set('street')} className={inputCls()} placeholder="1-1-1" />
          </Field>

          {/* 建物名 */}
          <Field label="建物名">
            <input type="text" value={form.building} onChange={set('building')} className={inputCls()} placeholder="○○ビル 101" />
          </Field>

          {/* 会社名・部署 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="会社名">
              <input type="text" value={form.company} onChange={set('company')} className={inputCls()} />
            </Field>
            <Field label="部署名">
              <input type="text" value={form.department} onChange={set('department')} className={inputCls()} />
            </Field>
          </div>

          {/* メモ */}
          <Field label="メモ">
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              className={`${inputCls()} resize-none`}
            />
          </Field>

          {/* 保存エラー */}
          {saveError && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {saveError}
            </p>
          )}

          {/* ボタン */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function inputCls(hasError = false) {
  return `w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-red-400' : 'border-gray-300'
  }`
}
