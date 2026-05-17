import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  GetContacts,
  GetGroups,
  DeleteContacts,
  SearchContacts,
  ExportCSV,
  OpenCSVFileDialog,
  SaveCSVFileDialog,
  SaveContact,
  GetContactYearStatuses,
  SaveContactYearStatus,
} from '../../../wailsjs/go/main/App'
import { useContactStore } from '../../stores/contactStore'
import type { Contact, ContactYearStatus, Group } from '../../types'
import ContactEditModal from './ContactEditModal'
import GroupManageDialog from './GroupManageDialog'
import CSVImportWizard from './CSVImportWizard'
import AddressNormalizationDialog from './AddressNormalizationDialog'

type EditableField = 'familyName' | 'givenName' | 'honorific' | 'postalCode' | 'prefecture' | 'city' | 'street'
type NavigationMode = 'none' | 'enter' | 'tab'
type AnnualStatusField = 'sent' | 'received' | 'mourning'

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

interface ColumnResizeState {
  key: string
  minWidth: number
  startX: number
  startWidth: number
}

const editableColumns: Array<{
  field: EditableField
  label: string
  defaultWidth: number
  minWidth: number
  placeholder?: string
}> = [
  { field: 'familyName', label: '姓', defaultWidth: 110, minWidth: 100, placeholder: '姓' },
  { field: 'givenName', label: '名', defaultWidth: 110, minWidth: 100, placeholder: '名' },
  { field: 'honorific', label: '敬称', defaultWidth: 96, minWidth: 90, placeholder: '様' },
  { field: 'postalCode', label: '郵便番号', defaultWidth: 130, minWidth: 120, placeholder: '1000001' },
  { field: 'prefecture', label: '都道府県', defaultWidth: 130, minWidth: 120, placeholder: '東京都' },
  { field: 'city', label: '市区町村', defaultWidth: 140, minWidth: 130, placeholder: '千代田区' },
  { field: 'street', label: '番地', defaultWidth: 180, minWidth: 160, placeholder: '1-1-1' },
]

export default function ContactList() {
  const summaryColumnKey = 'summary'
  const detailColumnKey = 'detail'
  const defaultSummaryColumnWidth = 260
  const minSummaryColumnWidth = 220
  const defaultDetailColumnWidth = 80
  const minDetailColumnWidth = 64

  const {
    contacts,
    selectedIds,
    focusContactId,
    currentGroupId,
    searchQuery,
    annualStatusYear,
    annualStatuses,
    annualStatusesLoadedYear,
    annualStatusesLoading,
    setContacts,
    setSelectedIds,
    clearFocusContactId,
    toggleSelected,
    clearSelection,
    setCurrentGroupId,
    setSearchQuery,
    setAnnualStatusYear,
    setAnnualStatusesLoading,
    setAnnualStatuses,
    upsertAnnualStatuses,
  } = useContactStore()

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<Contact | null | undefined>(undefined)
  // undefined = モーダル非表示, null = 新規作成, Contact = 編集
  const [showGroupManage, setShowGroupManage] = useState(false)
  const [importWizardFilePath, setImportWizardFilePath] = useState<string | null>(null)
  const [showAddressNormalization, setShowAddressNormalization] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [inlineSaveError, setInlineSaveError] = useState<string | null>(null)
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null)
  const [showPrintTargetOnly, setShowPrintTargetOnly] = useState(false)
  const [bulkUpdatingPrintTargets, setBulkUpdatingPrintTargets] = useState(false)
  const [updatingPrintTargetIds, setUpdatingPrintTargetIds] = useState<Set<string>>(new Set())
  const [bulkUpdatingAnnualStatus, setBulkUpdatingAnnualStatus] = useState(false)
  const [updatingAnnualStatusKeys, setUpdatingAnnualStatusKeys] = useState<Set<string>>(new Set())
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {
      [summaryColumnKey]: defaultSummaryColumnWidth,
      [detailColumnKey]: defaultDetailColumnWidth,
    }
    editableColumns.forEach((col) => {
      widths[col.field] = col.defaultWidth
    })
    return widths
  })
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const editingCellRef = useRef<EditingCell | null>(null)
  const committingRef = useRef(false)
  const resizingRef = useRef<ColumnResizeState | null>(null)
  const skipBlurRef = useRef(false)
  const skipBlurResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [focusedRowId, setFocusedRowID] = useState<string | null>(null)

  const getCellKey = (contactId: string, field: EditableField) => `${contactId}:${field}`

  const getFieldValue = (contact: Contact, field: EditableField) => contact[field] ?? ''
  const getDisplayName = (contact: Contact) => {
    const fullName = `${contact.familyName}${contact.givenName}`.trim()
    if (fullName) return fullName
    const company = contact.company.trim()
    if (company) return company
    return '名称未設定'
  }
  const getDisplayAddress = (contact: Contact) => {
    const address = `${contact.prefecture}${contact.city}${contact.street}${contact.building}`.trim()
    if (address) return address
    if (contact.postalCode.trim()) return `〒${contact.postalCode}`
    return '住所未設定'
  }
  const displayContacts = showPrintTargetOnly
    ? contacts.filter((c) => c.isPrintTarget)
    : contacts
  const selectedVisibleCount = displayContacts.filter((c) => selectedIds.has(c.id)).length
  const selectedVisibleContacts = displayContacts.filter((c) => selectedIds.has(c.id))
  const printTargetCount = contacts.filter((c) => c.isPrintTarget).length
  const annualStatusesReady = annualStatusesLoadedYear === annualStatusYear && !annualStatusesLoading
  const annualStatusActionsDisabled = bulkUpdatingAnnualStatus || !annualStatusesReady

  const getDefaultAnnualStatus = (contactID: string): ContactYearStatus => ({
    contactId: contactID,
    year: annualStatusYear,
    sent: false,
    received: false,
    mourning: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const getAnnualStatus = (contactID: string): ContactYearStatus =>
    annualStatuses[contactID] ?? getDefaultAnnualStatus(contactID)

  const buildAnnualStatusPayload = (
    contactID: string,
    patch: Partial<Pick<ContactYearStatus, AnnualStatusField>>,
    requestYear: number,
  ): Parameters<typeof SaveContactYearStatus>[0] => {
    const current = getAnnualStatus(contactID)
    const now = new Date().toISOString()
    const createdAt = current.createdAt?.trim() ? current.createdAt : now
    return {
      ...current,
      ...patch,
      year: requestYear,
      createdAt,
      updatedAt: now,
    } as Parameters<typeof SaveContactYearStatus>[0]
  }

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
    let active = true
    const requestYear = annualStatusYear
    setAnnualStatusesLoading(true)
    GetContactYearStatuses(requestYear)
      .then((list) => {
        if (!active) return
        setAnnualStatuses(requestYear, list ?? [])
      })
      .catch((err) => {
        console.error(err)
        if (active) {
          setInlineSaveError('年次ステータスの取得に失敗しました。再度お試しください。')
          if (useContactStore.getState().annualStatusYear === requestYear) {
            setAnnualStatusesLoading(false)
          }
        }
      })
    return () => {
      active = false
      if (useContactStore.getState().annualStatusYear === requestYear) {
        setAnnualStatusesLoading(false)
      }
    }
  }, [annualStatusYear])

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
    const handlePointerMove = (event: PointerEvent) => {
      const resizing = resizingRef.current
      if (!resizing) return
      const nextWidth = Math.max(resizing.minWidth, resizing.startWidth + (event.clientX - resizing.startX))
      setColumnWidths((prev) => {
        if (prev[resizing.key] === nextWidth) return prev
        return { ...prev, [resizing.key]: nextWidth }
      })
    }
    const handlePointerUp = () => {
      resizingRef.current = null
      setResizingColumnKey(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  useEffect(() => {
    if (!editingCell) return
    const exists = displayContacts.some((c) => c.id === editingCell.contactId)
    if (!exists) {
      setEditingCell(null)
    }
  }, [displayContacts, editingCell])

  useEffect(() => {
    if (!focusContactId) return
    if (showPrintTargetOnly) {
      setShowPrintTargetOnly(false)
      return
    }
    if (searchQuery) {
      setSearchQuery('')
      return
    }
    if (currentGroupId) {
      setCurrentGroupId('')
      return
    }
    if (loading) return
    if (!displayContacts.some((contact) => contact.id === focusContactId)) return

    setSelectedIds(new Set([focusContactId]))
    setFocusedRowID(focusContactId)
    clearFocusContactId()

    const row = rowRefs.current.get(focusContactId)
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })

    const timer = setTimeout(() => {
      setFocusedRowID((current) => (current === focusContactId ? null : current))
    }, 2500)
    return () => clearTimeout(timer)
  }, [
    focusContactId,
    showPrintTargetOnly,
    searchQuery,
    currentGroupId,
    loading,
    displayContacts,
    setSelectedIds,
    clearFocusContactId,
    setSearchQuery,
    setCurrentGroupId,
  ])

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
      setImportWizardFilePath(filePath)
    } catch (err) {
      alert(`インポートに失敗しました: ${err}`)
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

  const applySavedContacts = (savedList: Contact[]) => {
    const savedByID = new Map(savedList.map((c) => [c.id, c]))
    const latest = useContactStore.getState().contacts
    setContacts(latest.map((item) => savedByID.get(item.id) ?? item))
  }

  const togglePrintTarget = async (contact: Contact) => {
    if (bulkUpdatingPrintTargets) return
    setInlineSaveError(null)
    setUpdatingPrintTargetIds((prev) => {
      const next = new Set(prev)
      next.add(contact.id)
      return next
    })
    try {
      const saved = await SaveContact({
        ...contact,
        isPrintTarget: !contact.isPrintTarget,
      } as Parameters<typeof SaveContact>[0])
      applySavedContacts([saved])
    } catch (err) {
      console.error(err)
      setInlineSaveError('印刷対象の更新に失敗しました。再度お試しください。')
    } finally {
      setUpdatingPrintTargetIds((prev) => {
        const next = new Set(prev)
        next.delete(contact.id)
        return next
      })
    }
  }

  const setPrintTargetForVisibleContacts = async (value: boolean) => {
    if (displayContacts.length === 0 || bulkUpdatingPrintTargets) return
    setInlineSaveError(null)
    setBulkUpdatingPrintTargets(true)
    try {
      const results = await Promise.allSettled(
        displayContacts.map((contact) =>
          SaveContact({
            ...contact,
            isPrintTarget: value,
          } as Parameters<typeof SaveContact>[0]),
        ),
      )
      const savedList = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      const failed = results.filter((result) => result.status === 'rejected')
      failed.forEach((result) => console.error(result.reason))

      if (savedList.length > 0) {
        applySavedContacts(savedList)
      }
      if (failed.length > 0) {
        setInlineSaveError(`印刷対象の一括更新に失敗しました（${failed.length}件）。再度お試しください。`)
      }
    } finally {
      setBulkUpdatingPrintTargets(false)
    }
  }

  const toggleAnnualStatus = async (contactID: string, field: AnnualStatusField) => {
    if (annualStatusActionsDisabled) return
    const requestYear = annualStatusYear
    const updatingKey = `${contactID}:${field}`
    setInlineSaveError(null)
    setUpdatingAnnualStatusKeys((prev) => {
      const next = new Set(prev)
      next.add(updatingKey)
      return next
    })
    try {
      const current = getAnnualStatus(contactID)
      const saved = await SaveContactYearStatus(
        buildAnnualStatusPayload(contactID, { [field]: !current[field] }, requestYear),
      )
      if (useContactStore.getState().annualStatusYear === requestYear) {
        upsertAnnualStatuses([saved])
      }
    } catch (err) {
      console.error(err)
      setInlineSaveError('年次ステータスの更新に失敗しました。再度お試しください。')
    } finally {
      setUpdatingAnnualStatusKeys((prev) => {
        const next = new Set(prev)
        next.delete(updatingKey)
        return next
      })
    }
  }

  const setAnnualStatusForSelectedContacts = async (patch: Partial<Pick<ContactYearStatus, AnnualStatusField>>) => {
    if (selectedVisibleContacts.length === 0 || annualStatusActionsDisabled) return
    const requestYear = annualStatusYear
    setInlineSaveError(null)
    setBulkUpdatingAnnualStatus(true)
    try {
      const results = await Promise.allSettled(
        selectedVisibleContacts.map((contact) =>
          SaveContactYearStatus(buildAnnualStatusPayload(contact.id, patch, requestYear)),
        ),
      )
      const savedList = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      const failed = results.filter((result) => result.status === 'rejected')
      failed.forEach((result) => console.error(result.reason))

      if (savedList.length > 0) {
        if (useContactStore.getState().annualStatusYear === requestYear) {
          upsertAnnualStatuses(savedList.filter((status) => status.year === requestYear))
        }
      }
      if (failed.length > 0) {
        setInlineSaveError(`年次ステータスの一括更新に失敗しました（${failed.length}件）。再度お試しください。`)
      }
    } finally {
      setBulkUpdatingAnnualStatus(false)
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
    const rowIndex = displayContacts.findIndex((c) => c.id === cell.contactId)
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
    if (nextRow < 0 || nextRow >= displayContacts.length) return null

    return {
      contactId: displayContacts[nextRow].id,
      field: editableColumns[nextCol].field,
    }
  }

  const getEnterTarget = (cell: EditingCell): CellTarget | null => {
    const rowIndex = displayContacts.findIndex((c) => c.id === cell.contactId)
    if (rowIndex < 0 || rowIndex + 1 >= displayContacts.length) return null
    return {
      contactId: displayContacts[rowIndex + 1].id,
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

  const startColumnResize = (key: string, minWidth: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    resizingRef.current = {
      key,
      minWidth,
      startX: event.clientX,
      startWidth: columnWidths[key] ?? minWidth,
    }
    setResizingColumnKey(key)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const renderResizeHandle = (key: string, minWidth: number) => (
    <button
      type="button"
      onMouseDown={(e) => startColumnResize(key, minWidth, e)}
      className={`absolute right-0 top-0 z-20 h-full w-3 cursor-col-resize touch-none ${
        resizingColumnKey === key ? 'bg-blue-200' : 'hover:bg-blue-100'
      }`}
      aria-label="列幅を調整"
      title="ドラッグして列幅を変更"
    >
      <span className="mx-auto block h-full w-px bg-gray-300" />
    </button>
  )

  const tabs = [{ id: '', name: 'すべて' }, ...groups]
  const currentYear = new Date().getFullYear()
  const minYear = currentYear - 10
  const maxYear = currentYear + 10

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

      {/* セクション1: 件数表示 + 表示フィルタ */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            <span className="text-gray-700 font-medium">{displayContacts.length}</span> 件表示
          </span>
          <span className="text-gray-300">/</span>
          <span>
            印刷対象 <span className="text-emerald-700 font-medium">{printTargetCount}</span> 件
          </span>
          {selectedVisibleCount > 0 && (
            <>
              <span className="text-gray-300">/</span>
              <span>
                選択 <span className="text-blue-700 font-medium">{selectedVisibleCount}</span> 件
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => {
            setShowPrintTargetOnly((prev) => !prev)
            clearSelection()
            setEditingCell(null)
          }}
          className={`px-2 py-0.5 rounded border transition-colors ${
            showPrintTargetOnly
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {showPrintTargetOnly ? '全件表示' : '対象のみ表示'}
        </button>
      </div>

      {/* セクション2: 表示中スコープのアクション */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-gray-100 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 shrink-0">
          表示中 {displayContacts.length} 件
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedIds(new Set(displayContacts.map((c) => c.id)))}
            className="px-1.5 py-0.5 rounded text-gray-600 hover:text-blue-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={displayContacts.length === 0}
          >
            全選択
          </button>
          <button
            onClick={clearSelection}
            className="px-1.5 py-0.5 rounded text-gray-600 hover:text-blue-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={selectedIds.size === 0}
          >
            選択解除
          </button>
        </div>
        <span className="hidden sm:inline-block w-px h-4 bg-gray-200" aria-hidden="true" />
        <div className="flex items-center gap-1">
          <span className="text-gray-500">印刷対象:</span>
          <button
            onClick={() => void setPrintTargetForVisibleContacts(true)}
            className="px-1.5 py-0.5 rounded text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={displayContacts.length === 0 || bulkUpdatingPrintTargets}
          >
            ON
          </button>
          <button
            onClick={() => void setPrintTargetForVisibleContacts(false)}
            className="px-1.5 py-0.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={displayContacts.length === 0 || bulkUpdatingPrintTargets}
          >
            OFF
          </button>
        </div>
      </div>

      {/* セクション3: 選択中スコープの年次ステータスアクション */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-gray-100 text-xs">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 shrink-0">
          選択中 {selectedVisibleCount} 件 を
        </span>
        <label className="flex items-center gap-1 text-gray-500">
          <input
            type="number"
            min={minYear}
            max={maxYear}
            value={annualStatusYear}
            onChange={(e) => {
              const nextYear = Number(e.target.value)
              if (Number.isInteger(nextYear) && nextYear >= 1900 && nextYear <= 3000) {
                setAnnualStatusYear(nextYear)
              }
            }}
            className="w-20 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="年次ステータスの対象年"
          />
          <span>年に</span>
        </label>
        <div
          className={`inline-flex rounded-md border border-gray-300 overflow-hidden divide-x divide-gray-300 ${
            selectedVisibleContacts.length === 0 || annualStatusActionsDisabled ? 'opacity-50' : ''
          }`}
        >
          <button
            onClick={() => void setAnnualStatusForSelectedContacts({ sent: true })}
            className="px-2 py-0.5 text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed"
            disabled={selectedVisibleContacts.length === 0 || annualStatusActionsDisabled}
            title="送付済にする"
          >
            送付済
          </button>
          <button
            onClick={() => void setAnnualStatusForSelectedContacts({ received: true })}
            className="px-2 py-0.5 text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed"
            disabled={selectedVisibleContacts.length === 0 || annualStatusActionsDisabled}
            title="受取済にする"
          >
            受取
          </button>
          <button
            onClick={() => void setAnnualStatusForSelectedContacts({ mourning: true })}
            className="px-2 py-0.5 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed"
            disabled={selectedVisibleContacts.length === 0 || annualStatusActionsDisabled}
            title="喪中にする"
          >
            喪中
          </button>
          <button
            onClick={() =>
              void setAnnualStatusForSelectedContacts({ sent: false, received: false, mourning: false })
            }
            className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed"
            disabled={selectedVisibleContacts.length === 0 || annualStatusActionsDisabled}
            title="送付済・受取・喪中をすべてリセット"
          >
            リセット
          </button>
        </div>
        {selectedVisibleContacts.length === 0 && (
          <span className="text-[11px] text-gray-400">
            行のチェックボックスで対象を選んでください
          </span>
        )}
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
        {!loading && contacts.length > 0 && displayContacts.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            印刷対象の連絡先がありません
          </div>
        )}
        {!loading && displayContacts.length > 0 && (
          <table className="w-full min-w-[1220px] table-fixed border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="w-10 px-2 py-2 border-b border-gray-200 text-center text-[11px] text-gray-400 font-normal">
                  選択
                </th>
                <th
                  className="relative px-2 py-2 border-b border-gray-200 text-left font-medium select-none"
                  style={{
                    width: columnWidths[summaryColumnKey],
                    minWidth: minSummaryColumnWidth,
                  }}
                >
                  宛先
                  {renderResizeHandle(summaryColumnKey, minSummaryColumnWidth)}
                </th>
                <th className="w-20 px-2 py-2 border-b border-gray-200 text-left">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    印刷
                  </span>
                </th>
                <th className="w-16 px-2 py-2 border-b border-gray-200 text-left">{annualStatusYear}送付</th>
                <th className="w-16 px-2 py-2 border-b border-gray-200 text-left">{annualStatusYear}受取</th>
                <th className="w-16 px-2 py-2 border-b border-gray-200 text-left">{annualStatusYear}喪中</th>
                {editableColumns.map((col) => (
                  <th
                    key={col.field}
                    className="relative px-2 py-2 border-b border-gray-200 text-left font-medium select-none"
                    style={{
                      width: columnWidths[col.field],
                      minWidth: col.minWidth,
                    }}
                  >
                    {col.label}
                    {renderResizeHandle(col.field, col.minWidth)}
                  </th>
                ))}
                <th
                  className="relative px-2 py-2 border-b border-gray-200 text-left font-medium select-none"
                  style={{
                    width: columnWidths[detailColumnKey],
                    minWidth: minDetailColumnWidth,
                  }}
                >
                  詳細
                  {renderResizeHandle(detailColumnKey, minDetailColumnWidth)}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayContacts.map((c) => {
                const annual = getAnnualStatus(c.id)
                return (
                  <tr
                    key={c.id}
                    ref={(el) => {
                      if (el) {
                        rowRefs.current.set(c.id, el)
                      } else {
                        rowRefs.current.delete(c.id)
                      }
                    }}
                    className={`hover:bg-gray-50 ${
                      focusedRowId === c.id
                        ? 'bg-amber-100'
                        : selectedIds.has(c.id)
                          ? 'bg-blue-50/70'
                          : ''
                    }`}
                    onDoubleClick={() => setEditTarget(c)}
                  >
                    <td className="px-2 py-1.5 border-b border-gray-100 align-top text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelected(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-3.5 w-3.5 accent-blue-600"
                        aria-label="行を選択"
                      />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                      <div
                        style={{
                          width: columnWidths[summaryColumnKey],
                          minWidth: minSummaryColumnWidth,
                        }}
                      >
                        <p className="truncate text-sm font-medium text-gray-800">{getDisplayName(c)}</p>
                        <p className="truncate text-xs text-gray-500">{getDisplayAddress(c)}</p>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                      <PrintTargetSwitch
                        on={c.isPrintTarget}
                        disabled={bulkUpdatingPrintTargets || updatingPrintTargetIds.has(c.id)}
                        onToggle={() => void togglePrintTarget(c)}
                      />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                      <input
                        type="checkbox"
                        checked={annual.sent}
                        disabled={annualStatusActionsDisabled || updatingAnnualStatusKeys.has(`${c.id}:sent`)}
                        onChange={() => void toggleAnnualStatus(c.id, 'sent')}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-3.5 w-3.5 accent-blue-600 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                      <input
                        type="checkbox"
                        checked={annual.received}
                        disabled={annualStatusActionsDisabled || updatingAnnualStatusKeys.has(`${c.id}:received`)}
                        onChange={() => void toggleAnnualStatus(c.id, 'received')}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-3.5 w-3.5 accent-indigo-600 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100 align-top">
                      <input
                        type="checkbox"
                        checked={annual.mourning}
                        disabled={annualStatusActionsDisabled || updatingAnnualStatusKeys.has(`${c.id}:mourning`)}
                        onChange={() => void toggleAnnualStatus(c.id, 'mourning')}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-3.5 w-3.5 accent-rose-600 disabled:opacity-40"
                      />
                    </td>
                    {editableColumns.map((col) => (
                      <td
                        key={col.field}
                        className="px-2 py-1.5 border-b border-gray-100 align-top"
                        style={{
                          width: columnWidths[col.field],
                          minWidth: col.minWidth,
                        }}
                      >
                        {renderEditableCell(c, col.field, col.placeholder)}
                      </td>
                    ))}
                    <td
                      className="px-2 py-1.5 border-b border-gray-100 align-top"
                      style={{
                        width: columnWidths[detailColumnKey],
                        minWidth: minDetailColumnWidth,
                      }}
                    >
                      <button
                        onClick={() => setEditTarget(c)}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                )
              })}
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
          onClick={() => setShowAddressNormalization(true)}
          className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
        >
          住所正規化
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

      {importWizardFilePath && (
        <CSVImportWizard
          filePath={importWizardFilePath}
          onClose={() => setImportWizardFilePath(null)}
          onCompleted={refreshContacts}
        />
      )}

      {showAddressNormalization && (
        <AddressNormalizationDialog
          onClose={() => setShowAddressNormalization(false)}
          onCompleted={refreshContacts}
        />
      )}
    </div>
  )
}

interface PrintTargetSwitchProps {
  on: boolean
  disabled?: boolean
  onToggle: () => void
}

function PrintTargetSwitch({ on, disabled, onToggle }: PrintTargetSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? '印刷対象 ON (クリックでOFF)' : '印刷対象 OFF (クリックでON)'}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
        on ? 'bg-emerald-500 focus-visible:ring-emerald-500' : 'bg-gray-300 focus-visible:ring-gray-400'
      }`}
      title={on ? '印刷対象です。クリックで除外' : '除外中。クリックで印刷対象に'}
    >
      <span className="sr-only">{on ? 'ON' : 'OFF'}</span>
      <span
        aria-hidden="true"
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
