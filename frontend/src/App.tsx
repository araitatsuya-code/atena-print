import { useState } from 'react'
import type { View } from './types'
import ContactList from './components/address/ContactList'

function App() {
  const [view, setView] = useState<View>('contacts')

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* サイドバー */}
      <nav className="w-48 bg-white border-r border-gray-200 flex flex-col p-3 gap-1 shrink-0">
        <h1 className="text-sm font-bold px-2 py-3 text-gray-700">Atena ラベル印刷</h1>
        <NavButton active={view === 'contacts'} onClick={() => setView('contacts')}>
          住所録
        </NavButton>
        <NavButton active={view === 'preview'} onClick={() => setView('preview')}>
          ラベルプレビュー
        </NavButton>
        <NavButton active={view === 'settings'} onClick={() => setView('settings')}>
          設定
        </NavButton>
      </nav>

      {/* メインコンテンツ */}
      <main className="flex-1 flex overflow-hidden">
        {view === 'contacts' && (
          <div className="w-72 border-r border-gray-200 bg-white flex flex-col h-full">
            <ContactList />
          </div>
        )}
        {view === 'contacts' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">連絡先を選択するとプレビューが表示されます</p>
          </div>
        )}
        {view === 'preview' && (
          <div className="flex-1 p-6">
            <h2 className="text-xl font-semibold mb-4">ラベルプレビュー</h2>
            <p className="text-gray-500">Phase 3 で実装予定</p>
          </div>
        )}
        {view === 'settings' && (
          <div className="flex-1 p-6">
            <h2 className="text-xl font-semibold mb-4">設定</h2>
            <p className="text-gray-500">Phase 6 で実装予定</p>
          </div>
        )}
      </main>
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

export default App
