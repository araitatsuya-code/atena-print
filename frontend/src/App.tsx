import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/shallow'
import type { View } from './types'
import ContactList from './components/address/ContactList'
import PreviewArea from './components/preview/PreviewArea'
import DecorationSidebar from './components/decoration/DecorationSidebar'
import LabelSettingsPanel from './components/label/LabelSettingsPanel'
import PrintConfirmDialog from './components/PrintConfirmDialog'
import SenderManager from './components/sender/SenderManager'
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
      {/* サイドバー */}
      <nav className="w-48 bg-white border-r border-gray-200 flex flex-col p-3 gap-1 shrink-0">
        <h1 className="text-sm font-bold px-2 py-3 text-gray-700">Atena ラベル印刷</h1>
        <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')}>
          ダッシュボード
        </NavButton>
        <NavButton active={view === 'workspace'} onClick={() => setView('workspace')}>
          ラベル印刷
        </NavButton>
        <NavButton active={view === 'senders'} onClick={() => setView('senders')}>
          差出人管理
        </NavButton>
        <NavButton active={view === 'settings'} onClick={() => setView('settings')}>
          設定
        </NavButton>
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
              {/* トップバー */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-1 mr-auto">
                  <SecondaryToggleButton
                    active={rightPanel === 'label'}
                    onClick={() => toggleRightPanel('label')}
                    icon={<LabelIcon />}
                    label="ラベル設定"
                  />
                  <SecondaryToggleButton
                    active={rightPanel === 'design'}
                    onClick={() => toggleRightPanel('design')}
                    icon={<DesignIcon />}
                    label="デザイン設定"
                  />
                </div>
                <button
                  onClick={() => setShowPrintDialog(true)}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <PrintIcon />
                  ラベル印刷
                  {selectedCount > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-white/20 text-white">
                      {selectedCount}
                    </span>
                  )}
                </button>
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
        {view === 'senders' && (
          <div className="flex-1 overflow-y-auto">
            <SenderManager />
          </div>
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
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function SecondaryToggleButton({
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs transition-colors ${
        active
          ? 'bg-gray-100 text-gray-800 ring-1 ring-gray-300'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className="text-gray-500" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
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

function PrintIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function LabelIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function DesignIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M3 12h18" />
    </svg>
  )
}

export default App
