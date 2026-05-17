import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/shallow'
import type { View } from './types'
import ContactList from './components/address/ContactList'
import PreviewArea from './components/preview/PreviewArea'
import DecorationSidebar from './components/decoration/DecorationSidebar'
import LabelSettingsPanel from './components/label/LabelSettingsPanel'
import PrintConfirmDialog from './components/PrintConfirmDialog'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import { useContactStore } from './stores/contactStore'

type RightPanel = 'label' | 'design' | null

function App() {
  const minContactPaneWidth = 300
  const defaultContactPaneWidth = 360

  const [view, setView] = useState<View>('dashboard')
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [contactPaneWidth, setContactPaneWidth] = useState(defaultContactPaneWidth)
  const [isResizingContactPane, setIsResizingContactPane] = useState(false)
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)

  const contactPaneResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const toggleRightPanel = (next: Exclude<RightPanel, null>) => {
    setRightPanel((prev) => (prev === next ? null : next))
  }

  const {
    selectedCount,
    setSelectedIds,
    setCurrentGroupId,
    setSearchQuery,
    setFocusContactId,
  } = useContactStore(
    useShallow((s) => ({
      selectedCount: s.contacts.filter((c) => c.isPrintTarget).length,
      setSelectedIds: s.setSelectedIds,
      setCurrentGroupId: s.setCurrentGroupId,
      setSearchQuery: s.setSearchQuery,
      setFocusContactId: s.setFocusContactId,
    })),
  )

  useEffect(() => {
    const clampContactPaneWidth = () => {
      const maxWidth = Math.max(minContactPaneWidth, window.innerWidth - 520)
      setContactPaneWidth((prev) => Math.min(maxWidth, Math.max(minContactPaneWidth, prev)))
    }

    const handlePointerMove = (event: PointerEvent) => {
      const resizing = contactPaneResizeRef.current
      if (!resizing) return
      const rawNextWidth = resizing.startWidth + (event.clientX - resizing.startX)
      const maxWidth = Math.max(minContactPaneWidth, window.innerWidth - 520)
      const nextWidth = Math.min(maxWidth, Math.max(minContactPaneWidth, rawNextWidth))
      setContactPaneWidth(nextWidth)
    }
    const handlePointerUp = () => {
      contactPaneResizeRef.current = null
      setIsResizingContactPane(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    clampContactPaneWidth()
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('resize', clampContactPaneWidth)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('resize', clampContactPaneWidth)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const startContactPaneResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    contactPaneResizeRef.current = {
      startX: event.clientX,
      startWidth: contactPaneWidth,
    }
    setIsResizingContactPane(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleJumpToContact = (contactID: string) => {
    setShowPrintDialog(false)
    setView('workspace')
    setCurrentGroupId('')
    setSearchQuery('')
    setSelectedIds(new Set([contactID]))
    setFocusContactId(contactID)
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* サイドバー (アイコン化) */}
      <nav
        className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0"
        aria-label="メインナビゲーション"
      >
        <div
          className="w-9 h-9 mb-2 flex items-center justify-center rounded-md bg-blue-600 text-white font-bold text-sm"
          aria-label="Atena ラベル印刷"
          title="Atena ラベル印刷"
        >
          A
        </div>
        <NavButton
          active={view === 'dashboard'}
          onClick={() => setView('dashboard')}
          icon={<HomeIcon />}
          label="ダッシュボード"
        />
        <NavButton
          active={view === 'workspace'}
          onClick={() => setView('workspace')}
          icon={<PrinterIcon />}
          label="ラベル印刷"
        />
        <NavButton
          active={view === 'settings'}
          onClick={() => setView('settings')}
          icon={<SettingsIcon />}
          label="設定"
        />
      </nav>

      {/* メインコンテンツ */}
      <main className="flex-1 flex overflow-hidden">
        {view === 'dashboard' && (
          <Dashboard onNavigate={(v) => setView(v as View)} />
        )}
        {view === 'workspace' && (
          <>
            <div
              className="relative border-r border-gray-200 bg-white flex flex-col h-full shrink-0"
              style={{ width: contactPaneWidth, minWidth: minContactPaneWidth }}
            >
              <ContactList />
              <button
                type="button"
                onPointerDown={startContactPaneResize}
                className={`absolute right-0 top-0 z-30 h-full w-2 translate-x-1/2 cursor-col-resize touch-none ${
                  isResizingContactPane ? 'bg-blue-200/70' : 'hover:bg-blue-100/70'
                }`}
                aria-label="住所録パネルの幅を調整"
                title="ドラッグして住所録パネルを広げる"
              >
                <span className="mx-auto block h-full w-px bg-gray-300" />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* ワークフローステッパー */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
                <StepperItem
                  number={1}
                  label="印刷対象を選ぶ"
                  sub={selectedCount > 0 ? `${selectedCount} 件選択中` : '未選択'}
                  active={selectedCount === 0}
                  done={selectedCount > 0}
                />
                <StepperConnector />
                <StepperItem
                  number={2}
                  label="デザインを整える"
                  sub={
                    rightPanel === 'label'
                      ? 'ラベル設定を編集中'
                      : rightPanel === 'design'
                        ? 'デザイン設定を編集中'
                        : 'ラベル / デザイン設定'
                  }
                  active={rightPanel !== null}
                  onClick={() => setRightPanel((prev) => (prev ? null : 'label'))}
                />
                <StepperConnector />
                <StepperItem
                  number={3}
                  label="印刷"
                  sub={
                    selectedCount > 0
                      ? `${selectedCount} 件を印刷`
                      : '対象を選んでください'
                  }
                  primary
                  disabled={selectedCount === 0}
                  onClick={() => setShowPrintDialog(true)}
                />
              </div>
              <PreviewArea />
            </div>
            {rightPanel && (
              <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full shrink-0">
                <div className="flex items-stretch border-b border-gray-200">
                  <PanelTab
                    active={rightPanel === 'label'}
                    onClick={() => setRightPanel('label')}
                  >
                    ラベル設定
                  </PanelTab>
                  <PanelTab
                    active={rightPanel === 'design'}
                    onClick={() => setRightPanel('design')}
                  >
                    デザイン設定
                  </PanelTab>
                  <button
                    type="button"
                    onClick={() => setRightPanel(null)}
                    className="ml-auto px-3 text-gray-400 hover:text-gray-600"
                    aria-label="パネルを閉じる"
                    title="パネルを閉じる"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {rightPanel === 'label' ? (
                    <div className="p-4">
                      <LabelSettingsPanel />
                    </div>
                  ) : (
                    <DecorationSidebar />
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {view === 'settings' && <Settings />}
      </main>

      {showPrintDialog && (
        <PrintConfirmDialog
          onClose={() => setShowPrintDialog(false)}
          onJumpToContact={handleJumpToContact}
        />
      )}
    </div>
  )
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {icon}
    </button>
  )
}

function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

interface StepperItemProps {
  number: number
  label: string
  sub?: string
  active?: boolean
  done?: boolean
  primary?: boolean
  disabled?: boolean
  onClick?: () => void
}

function StepperItem({
  number,
  label,
  sub,
  active,
  done,
  primary,
  disabled,
  onClick,
}: StepperItemProps) {
  const interactive = !!onClick && !disabled

  let containerClass = 'text-gray-600'
  let circleClass = 'bg-gray-200 text-gray-600'
  let circleContent: React.ReactNode = number

  if (primary) {
    containerClass = disabled
      ? 'bg-blue-600/40 text-white cursor-not-allowed'
      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm'
    circleClass = 'bg-white/25 text-white'
  } else if (active) {
    containerClass = 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    circleClass = 'bg-blue-600 text-white'
  } else if (done) {
    containerClass = 'text-gray-700 hover:bg-gray-100'
    circleClass = 'bg-emerald-500 text-white'
    circleContent = '✓'
  } else if (interactive) {
    containerClass = 'text-gray-600 hover:bg-gray-100'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-current={active && !primary ? 'step' : undefined}
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-left disabled:cursor-default ${containerClass} ${
        !onClick ? 'disabled:opacity-100' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold ${circleClass}`}
      >
        {circleContent}
      </span>
      <span className="leading-tight">
        <span className="block text-xs font-medium">{label}</span>
        {sub && (
          <span className={`block text-[10px] ${primary ? 'opacity-90' : 'opacity-80'}`}>
            {sub}
          </span>
        )}
      </span>
    </button>
  )
}

function StepperConnector() {
  return (
    <span aria-hidden="true" className="self-center text-gray-300 text-sm select-none">
      →
    </span>
  )
}

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
        active
          ? 'text-blue-700 border-blue-600'
          : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

export default App
