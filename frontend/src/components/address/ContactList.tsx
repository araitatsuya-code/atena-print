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
} from '../../../wailsjs/go/main/App'
import { useContactStore } from '../../stores/contactStore'
import type { Group } from '../../types'
import ContactEditModal from './ContactEditModal'
import type { Contact } from '../../types'

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

  const requestIdRef = useRef(0)

  // グループ一覧取得
  useEffect(() => {
    GetGroups().then(setGroups).catch(console.error)
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
          }}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* グループタブ */}
      <div className="flex overflow-x-auto border-b border-gray-200 px-2 pt-1 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setCurrentGroupId(tab.id)
              setSearchQuery('')
              clearSelection()
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
      </div>

      {/* 全選択/全解除 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 text-xs text-gray-500">
        <span>{selectedIds.size > 0 ? `${selectedIds.size} 件選択中` : `${contacts.length} 件`}</span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="hover:text-blue-600">全選択</button>
          <button onClick={clearSelection} className="hover:text-blue-600">解除</button>
        </div>
      </div>

      {/* 連絡先リスト */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-center py-8 text-sm text-gray-400">読み込み中...</div>
        )}
        {!loading && contacts.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            {searchQuery ? '検索結果がありません' : '連絡先がありません'}
          </div>
        )}
        {!loading && contacts.map((c) => (
          <div
            key={c.id}
            onDoubleClick={() => setEditTarget(c)}
            className={`flex items-start gap-2 px-3 py-2.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
              selectedIds.has(c.id) ? 'bg-blue-50' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(c.id)}
              onChange={() => toggleSelected(c.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-3.5 w-3.5 accent-blue-600"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-medium text-gray-800">
                  {c.familyName} {c.givenName}
                </span>
                <span className="text-xs text-gray-400">{c.honorific}</span>
              </div>
              {c.company && (
                <div className="text-xs text-gray-500 truncate">{c.company}</div>
              )}
              <div className="text-xs text-gray-400 truncate">
                {c.postalCode && `〒${c.postalCode} `}
                {c.prefecture}{c.city}{c.street}
              </div>
            </div>
          </div>
        ))}
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
    </div>
  )
}
