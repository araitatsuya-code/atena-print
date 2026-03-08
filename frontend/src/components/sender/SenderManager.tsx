import { useEffect, useState } from 'react'
import { GetSenders, SaveSender, DeleteSender, SetDefaultSender } from '../../../wailsjs/go/main/App'
import { entity } from '../../../wailsjs/go/models'
import { useSenderStore } from '../../stores/senderStore'
import type { Sender } from '../../types'

const EMPTY_FORM: Sender = {
  id: '',
  familyName: '',
  givenName: '',
  postalCode: '',
  prefecture: '',
  city: '',
  street: '',
  building: '',
  company: '',
  isDefault: false,
}

export default function SenderManager() {
  const { senders, setSenders } = useSenderStore()
  const [editTarget, setEditTarget] = useState<Sender | null>(null)
  const [form, setForm] = useState<Sender>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const list = await GetSenders()
      setSenders(list ?? [])
    } catch (e) {
      setError(String(e))
    }
  }

  function startAdd() {
    setEditTarget(EMPTY_FORM)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function startEdit(s: Sender) {
    setEditTarget(s)
    setForm({ ...s })
    setError(null)
  }

  function cancelEdit() {
    setEditTarget(null)
    setError(null)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      const saved = await SaveSender(entity.Sender.createFrom(form))
      setSenders(
        form.id
          ? senders.map((s) => (s.id === saved.id ? saved : s))
          : [...senders, saved],
      )
      setEditTarget(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('この差出人を削除しますか？')) return
    setLoading(true)
    setError(null)
    try {
      await DeleteSender(id)
      setSenders(senders.filter((s) => s.id !== id))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSetDefault(id: string) {
    setLoading(true)
    setError(null)
    try {
      await SetDefaultSender(id)
      setSenders(senders.map((s) => ({ ...s, isDefault: s.id === id })))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">差出人管理</h2>
        <button
          onClick={startAdd}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          追加
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-3">{error}</p>
      )}

      {/* 差出人一覧 */}
      <div className="space-y-2 mb-6">
        {senders.length === 0 && (
          <p className="text-sm text-gray-400">差出人が登録されていません</p>
        )}
        {senders.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {s.familyName} {s.givenName}
                  {s.company && <span className="text-gray-500 ml-1">({s.company})</span>}
                </span>
                {s.isDefault && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    デフォルト
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                〒{s.postalCode} {s.prefecture}{s.city}{s.street}
                {s.building && ` ${s.building}`}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {!s.isDefault && (
                <button
                  onClick={() => handleSetDefault(s.id)}
                  disabled={loading}
                  className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-40"
                >
                  デフォルトに設定
                </button>
              )}
              <button
                onClick={() => startEdit(s)}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                編集
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={loading}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 編集フォーム */}
      {editTarget !== null && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {form.id ? '差出人を編集' : '差出人を追加'}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="姓"
              value={form.familyName}
              onChange={(v) => setForm({ ...form, familyName: v })}
            />
            <Field
              label="名"
              value={form.givenName}
              onChange={(v) => setForm({ ...form, givenName: v })}
            />
          </div>
          <Field
            label="会社名"
            value={form.company}
            onChange={(v) => setForm({ ...form, company: v })}
          />
          <Field
            label="郵便番号"
            value={form.postalCode}
            onChange={(v) => setForm({ ...form, postalCode: v })}
            placeholder="000-0000"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="都道府県"
              value={form.prefecture}
              onChange={(v) => setForm({ ...form, prefecture: v })}
            />
            <Field
              label="市区町村"
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
            />
          </div>
          <Field
            label="番地"
            value={form.street}
            onChange={(v) => setForm({ ...form, street: v })}
          />
          <Field
            label="建物名・部屋番号"
            value={form.building}
            onChange={(v) => setForm({ ...form, building: v })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded"
            />
            デフォルト差出人に設定
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={loading}
              className="px-4 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  )
}
