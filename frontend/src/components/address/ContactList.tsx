import { useEffect, useRef, useState } from 'react'
import {
  GetContacts,
  GetGroups,
  DeleteContacts,
  SearchContacts,
  ImportCSV,
  ExportCSV,
  OpenCSVFileDialog,
  SaveCSVFileDialog,
  SaveContact,
} from '../../../wailsjs/go/main/App'
import { useContactStore } from '../../stores/contactStore'
import type { Contact, Group } from '../../types'
import ContactEditModal from './ContactEditModal'
import GroupManageDialog from './GroupManageDialog'

type EditableField = 'familyName' | 'givenName' | 'honorific' | 'postalCode' | 'prefecture' | 'city' | 'street'
type NavigationMode = 'none' | 'enter' | 'tab'

interface EditingCell {
  contactId: string
  field: EditableField
  value: string
  originalValue: string
}

interface CellTarget {
  contactId: string
  field: EditableField
}

const editableColumns: Array<{
  field: EditableField
  label: string
  widthClass: string
  placeholder?: string
}> = [
  { field: 'familyName', label: '姓', widthClass: 'min-w-[100px]', placeholder: '姓' },
  { field: 'givenName', label: '名', widthClass: 'min-w-[100px]', placeholder: '名' },
  { field: 'honorific', label: '敬称', widthClass: 'min-w-[90px]', placeholder: '様' },
  { field: 'postalCode', label: '郵便番号', widthClass: 'min-w-[120px]', placeholder: '1000001' },
  { field: 'prefecture', label: '都道府県', widthClass: 'min-w-[120px]', placeholder: '東京都' },
  { field: 'city', label: '市区町村', widthClass: 'min-w-[130px]', placeholder: '千代田区' },
  { field: 'street', label: '番地', widthClass: 'min-w-[160px]', placeholder: '1-1-1' },
]

export default function ContactList() {
  const {
    contacts,
    selectedIds,
    currentGroupId,
    searchQuery,
    setContacts,
    toggleSelected,
    selectAll,
    clearSelection,
    setCurrentGroupId,
    setSearchQuery,
  } = useContactStore()

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<Contact | null | undefined>(undefined)
  // undefined = モーダル非表示, null = 新規作成, Contact = 編集
  const [showGroupManage, setShowGroupManage] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [inlineSaveError, setInlineSaveError] = useState<string | null>(null)
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const editingCellRef = useRef<EditingCell | null>(null)
  const committingRef = useRef(false)
  const skipBlurRef = useRef(false)
  const skipBlurResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getCellKey = (contactId: string, field: EditableField) => `${contactId}:${field}`

  const getFieldValue = (contact: Contact, field: EditableField) => contact[field] ?? ''

  const refreshGroups = () => {
    GetGroups().then(setGroups).catch(console.error)
  }

  // グループ一覧取得
  useEffect(() => {
    refreshGroups()
  }, [])

  // 連絡先一覧取得 (競合状態を防ぐためリクエストIDで管理)
  useEffect(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const fetch = searchQuery
      ? SearchContacts(searchQuery)
      : GetContacts(currentGroupId)
    fetch
      .then((result) => {
        if (requestId === requestIdRef.current) {
          setContacts(result)
        }
      })
      .catch(console.error)
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      })
  }, [currentGroupId, searchQuery])

  useEffect(() => {
    editingCellRef.current = editingCell
  }, [editingCell])

  useEffect(() => {
    return () => {
      if (skipBlurResetTimerRef.current) {
        clearTimeout(skipBlurResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editingCell) return
    const exists = contacts.some((c) => c.id === editingCell.contactId)
    if (!exists) {
      setEditingCell(null)
    }
  }, [contacts, editingCell])

  const refreshContacts = async () => {
    const result = searchQuery
      ? await SearchContacts(searchQuery)
      : await GetContacts(currentGroupId)
    setContacts(result)
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await DeleteContacts(ids)
    clearSelection()
    await refreshContacts()
  }

  const handleSaved = async () => {
    setEditTarget(undefined)
    setEditingCell(null)
    clearSelection()
    await refreshContacts()
  }

  const handleImport = async () => {
    try {
      const filePath = await OpenCSVFileDialog()
      if (!filePath) return
      const result = await ImportCSV(filePath)
      const msg = `インポート完了: ${result.imported} 件`
      if (result.errors && result.errors.length > 0) {
        alert(`${msg}\n\nエラー:\n${result.errors.join('\n')}`)
      } else {
        alert(msg)
      }
    } catch (err) {
      alert(`インポートに失敗しました: ${err}`)
    } finally {
      await refreshContacts()
    }
  }

  const handleExport = async () => {
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : []
      const defaultName = ids.length > 0 ? 'contacts_selected.csv' : 'contacts_all.csv'
      const filePath = await SaveCSVFileDialog(defaultName)
      if (!filePath) return
      await ExportCSV(ids, filePath)
      alert('エクスポート完了')
    } catch (err) {
      alert(`エクスポートに失敗しました: ${err}`)
    }
  }

  const beginEditing = (contact: Contact, field: EditableField) => {
    setInlineSaveError(null)
    const value = getFieldValue(contact, field)
    setEditingCell({
      contactId: contact.id,
      field,
      value,
      originalValue: value,
    })
  }

  const scheduleSkipBlurReset = () => {
    if (skipBlurResetTimerRef.current) {
      clearTimeout(skipBlurResetTimerRef.current)
    }
    skipBlurResetTimerRef.current = setTimeout(() => {
      skipBlurRef.current = false
      skipBlurResetTimerRef.current = null
    }, 0)
  }

  const setEditingFromTarget = (target: CellTarget | null) => {
    if (!target) {
      setEditingCell(null)
      return
    }
    const targetContact = useContactStore.getState().contacts.find((c) => c.id === target.contactId)
    if (!targetContact) {
      setEditingCell(null)
      return
    }
    const value = getFieldValue(targetContact, target.field)
    setEditingCell({
      contactId: targetContact.id,
      field: target.field,
      value,
      originalValue: value,
    })
  }

  const getTabTarget = (cell: EditingCell, direction: 1 | -1): CellTarget | null => {
    const rowIndex = contacts.findIndex((c) => c.id === cell.contactId)
    const colIndex = editableColumns.findIndex((col) => col.field === cell.field)
    if (rowIndex < 0 || colIndex < 0) return null

    let nextRow = rowIndex
    let nextCol = colIndex + direction
    if (nextCol >= editableColumns.length) {
      nextCol = 0
      nextRow += 1
    } else if (nextCol < 0) {
      nextCol = editableColumns.length - 1
      nextRow -= 1
    }
    if (nextRow < 0 || nextRow >= contacts.length) return null

    return {
      contactId: contacts[nextRow].id,
      field: editableColumns[nextCol].field,
    }
  }

  const getEnterTarget = (cell: EditingCell): CellTarget | null => {
    const rowIndex = contacts.findIndex((c) => c.id === cell.contactId)
    if (rowIndex < 0 || rowIndex + 1 >= contacts.length) return null
    return {
      contactId: contacts[rowIndex + 1].id,
      field: cell.field,
    }
  }

  const commitEditing = async (mode: NavigationMode, tabDirection: 1 | -1 = 1) => {
    const active = editingCellRef.current
    if (!active || committingRef.current) return

    const contact = contacts.find((c) => c.id === active.contactId)
    if (!contact) {
      setEditingCell(null)
      return
    }

    const nextTarget =
      mode === 'tab'
        ? getTabTarget(active, tabDirection)
        : mode === 'enter'
          ? getEnterTarget(active)
          : null

    const isCurrentCell = () => {
      const current = editingCellRef.current
      return current?.contactId === active.contactId && current?.field === active.field
    }

    if (active.value === active.originalValue) {
      if (!isCurrentCell()) return
      setEditingFromTarget(nextTarget)
      return
    }

    const trimmedValue = active.value.trim()
    if (active.field === 'familyName' && !trimmedValue) {
      setInlineSaveError('姓は必須です。')
      return
    }
    if (active.field === 'givenName' && !trimmedValue) {
      setInlineSaveError('名は必須です。')
      return
    }
    if (active.field === 'postalCode' && !/^\d{7}$/.test(trimmedValue)) {
      setInlineSaveError('郵便番号はハイフンなし7桁の数字で入力してください。')
      return
    }

    committingRef.current = true
    setSavingCellKey(getCellKey(active.contactId, active.field))
    setInlineSaveError(null)

    try {
      const saved = await SaveContact({
        ...contact,
        [active.field]: active.field === 'postalCode' ? trimmedValue : active.value,
      } as Parameters<typeof SaveContact>[0])

      const latest = useContactStore.getState().contacts
      setContacts(latest.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)))

      if (!isCurrentCell()) return
      setEditingFromTarget(nextTarget)
    } catch (err) {
      console.error(err)
      setInlineSaveError('セル保存に失敗しました。再度お試しください。')
    } finally {
      committingRef.current = false
      setSavingCellKey(null)
    }
  }

  const renderEditableCell = (contact: Contact, field: EditableField, placeholder?: string) => {
    const cellKey = getCellKey(contact.id, field)
    const isEditing = editingCell?.contactId === contact.id && editingCell.field === field
    const isSaving = savingCellKey === cellKey

    if (isEditing && editingCell) {
      return (
        <input
          autoFocus
          type="text"
          value={editingCell.value}
          disabled={isSaving}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const nextValue = e.target.value
            setEditingCell((prev) => {
              if (!prev || prev.contactId !== contact.id || prev.field !== field) return prev
              return { ...prev, value: nextValue }
            })
          }}
          onBlur={() => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false
              return
            }
            const current = editingCellRef.current
            if (!current || current.contactId !== contact.id || current.field !== field) {
              return
            }
            void commitEditing('none')
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) {
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              skipBlurRef.current = true
              scheduleSkipBlurReset()
              void commitEditing('enter')
              return
            }
            if (e.key === 'Tab') {
              e.preventDefault()
              e.stopPropagation()
              skipBlurRef.current = true
              scheduleSkipBlurReset()
              void commitEditing('tab', e.shiftKey ? -1 : 1)
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              skipBlurRef.current = true
              scheduleSkipBlurReset()
              setInlineSaveError(null)
              setEditingCell(null)
            }
          }}
          className="w-full rounded border border-blue-500 bg-white px-1.5 py-1 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
        />
      )
    }

    const displayValue = getFieldValue(contact, field)
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          beginEditing(contact, field)
        }}
        className="w-full rounded px-1.5 py-1 text-left text-sm text-gray-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {displayValue || <span className="text-gray-300">{placeholder ?? '未入力'}</span>}
      </button>
    )
  }

  const tabs = [{ id: '', name: 'すべて' }, ...groups]

  return (
    <div className="flex flex-col h-full">
      {/* 検索バー */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="検索..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            clearSelection()
            setEditingCell(null)
          }}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* グループタブ */}
      <div className="flex items-end overflow-x-auto border-b border-gray-200 px-2 pt-1 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setCurrentGroupId(tab.id)
              setSearchQuery('')
              clearSelection()
              setEditingCell(null)
            }}
            className={`px-3 py-1.5 text-xs rounded-t-md whitespace-nowrap transition-colors ${
              currentGroupId === tab.id && !searchQuery
                ? 'bg-blue-50 text-blue-700 font-medium border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
        <button
          onClick={() => setShowGroupManage(true)}
          className="ml-auto px-2 py-1 text-xs text-gray-400 hover:text-blue-600 whitespace-nowrap"
          title="グループを管理"
        >
          ＋グループ
        </button>
      </div>

      {/* 全選択/全解除 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 text-xs text-gray-500">
        <span>{selectedIds.size > 0 ? `${selectedIds.size} 件選択中` : `${contacts.length} 件`}</span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="hover:text-blue-600">全選択</button>
          <button onClick={clearSelection} className="hover:text-blue-600">解除</button>
        </div>
      </div>
      {inlineSaveError && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
          {inlineSaveError}
        </div>
      )}

      {/* 連絡先リスト */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="text-center py-8 text-sm text-gray-400">読み込み中...</div>
        )}
        {!loading && contacts.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            {searchQuery ? '検索結果がありません' : '連絡先がありません'}
          </div>
        )}
        {!loading && contacts.length > 0 && (
          <table className="w-full min-w-[960px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="w-10 px-2 py-2 border-b border-gray-200 text-left">選択</th>
                {editableColumns.map((col) => (
                  <th
                    key={col.field}
                    className={`${col.widthClass} px-2 py-2 border-b border-gray-200 text-left font-medium`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-16 px-2 py-2 border-b border-gray-200 text-left font-medium">詳細</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className={`hover:bg-gray-50 ${selectedIds.has(c.id) ? 'bg-blue-50/70' : ''}`}
                  onDoubleClick={() => setEditTarget(c)}
                >
                  <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelected(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-3.5 w-3.5 accent-blue-600"
                    />
                  </td>
                  {editableColumns.map((col) => (
                    <td key={col.field} className="px-2 py-1.5 border-b border-gray-100 align-top">
                      {renderEditableCell(c, col.field, col.placeholder)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                    <button
                      onClick={() => setEditTarget(c)}
                      className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* フッターボタン */}
      <div className="p-2 border-t border-gray-200 flex flex-wrap gap-2">
        <button
          onClick={() => setEditTarget(null)}
          className="flex-1 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + 新規追加
        </button>
        <button
          onClick={handleImport}
          className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
        >
          CSV取込
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
        >
          CSV出力{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
          >
            削除 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* 編集モーダル */}
      {editTarget !== undefined && (
        <ContactEditModal
          contact={editTarget ?? undefined}
          onClose={() => setEditTarget(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* グループ管理ダイアログ */}
      {showGroupManage && (
        <GroupManageDialog
          onClose={() => setShowGroupManage(false)}
          onChanged={refreshGroups}
        />
      )}
    </div>
  )
}
