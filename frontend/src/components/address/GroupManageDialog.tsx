import { useEffect, useRef, useState } from 'react'
import { GetGroups, SaveGroup, DeleteGroup } from '../../../wailsjs/go/main/App'
import type { Group } from '../../types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog'

interface Props {
  onClose: () => void
  onChanged: () => void
}

export default function GroupManageDialog({ onClose, onChanged }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const result = await GetGroups()
    setGroups(result)
  }

  useEffect(() => {
    refresh().catch(console.error)
  }, [])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setError(null)
    try {
      await SaveGroup({ id: '', name })
      setNewName('')
      await refresh()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'グループの追加に失敗しました')
    }
  }

  const handleEditStart = (g: Group) => {
    setEditingId(g.id)
    setEditingName(g.name)
    setError(null)
  }

  const handleEditSave = async (id: string) => {
    const name = editingName.trim()
    if (!name) return
    setError(null)
    try {
      await SaveGroup({ id, name })
      setEditingId(null)
      await refresh()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'グループの更新に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await DeleteGroup(id)
      await refresh()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'グループの削除に失敗しました')
    }
  }

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') handleEditSave(id)
    if (e.key === 'Escape') setEditingId(null)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>グループ管理</DialogTitle>
          <DialogClose
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </DialogClose>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* グループ一覧 */}
          <ul className="space-y-1">
            {groups.length === 0 && (
              <li className="text-sm text-gray-400 py-2 text-center">グループがありません</li>
            )}
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50">
                {editingId === g.id ? (
                  <>
                    <input
                      ref={inputRef}
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, g.id)}
                      className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleEditSave(g.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-xs text-gray-500 border border-gray-300 rounded-md hover:bg-gray-100"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-800">{g.name}</span>
                    <button
                      onClick={() => handleEditStart(g)}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-600"
                    >
                      削除
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* 新規追加 */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="新しいグループ名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleNewKeyDown}
              className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
            >
              追加
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
