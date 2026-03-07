import WatermarkPanel from './WatermarkPanel'
import QRPanel from './QRPanel'

export default function DecorationSidebar() {
  return (
    <div className="w-60 bg-white border-l border-gray-200 flex flex-col h-full shrink-0">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">デザイン設定</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <WatermarkPanel />
        <div className="border-t border-gray-100" />
        <QRPanel />
      </div>
    </div>
  )
}
