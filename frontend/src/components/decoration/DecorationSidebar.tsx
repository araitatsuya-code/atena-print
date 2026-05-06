import WatermarkPanel from './WatermarkPanel'
import QRPanel from './QRPanel'

export default function DecorationSidebar() {
  return (
    <div className="p-4 space-y-6">
      <WatermarkPanel />
      <div className="border-t border-gray-100" />
      <QRPanel />
    </div>
  )
}
