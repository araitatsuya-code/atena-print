# Atena ラベル印刷 — UI仕様

## 画面構成

3ペイン + サイドバーのレイアウト。

```
┌─────┬─────────────┬──────────────────────┬──────────┐
│     │             │                      │          │
│ Nav │ 住所録リスト  │   ラベルプレビュー      │ デザイン   │
│     │             │                      │ 設定     │
│ 220 │   300px     │      flex: 1         │ 240px    │
│ px  │             │                      │(トグル)   │
│     │             │                      │          │
└─────┴─────────────┴──────────────────────┴──────────┘
```

## 各画面詳細

### サイドバー (220px)

- ロゴ: 「宛」アイコン + "Atena ラベル印刷"
- ナビゲーション:
  - ダッシュボード
  - 住所録
  - 宛名プレビュー (メイン画面)
  - テンプレート
  - 差出人管理
  - 設定

### トップバー (50px)

- 左: 画面タイトル + 選択件数バッジ + 「ラベル印刷モード」表示
- 右: 「デザイン設定」トグルボタン / 「CSVインポート」ボタン / 「ラベル印刷」ボタン(Primary)

### 住所録パネル (300px)

- 検索バー
- グループフィルター: タブ形式 (すべて / 家族 / 友人 / 仕事)
- 連絡先リスト: チェックボックス付き、名前+郵便番号+住所を表示、グループバッジ
- 下部: 「新規追加」ボタン / 「全選択/全解除」ボタン

### プレビューエリア (flex: 1)

- テンプレートバー: テンプレート選択ドロップダウン + ラベルサイズ表示 + ズーム操作
- キャンバス: チェッカーパターン背景にラベルプレビューを表示
  - ラベルにはCanvas APIで描画: 宛名(縦書き) + 郵便番号 + 差出人 + 透かし + QR
  - 点線の切り取り線表示
- ページナビゲーション: 複数選択時にサムネイル付きでページ切替

### デザイン設定パネル (240px, トグル開閉)

3セクション構成:

#### セクション1: 透かし画像
- プリセットグリッド (3列): なし / 🌸桜 / 🌊波 / 🎋竹 / 🗻富士山 / 🦢鶴 / 📷カスタム
- 透明度スライダー (10%-100%)
- カスタム選択時: 「画像をアップロード」ボタン

#### セクション2: QRコード
- ON/OFFトグルスイッチ
- QRコンテンツ入力フィールド (URL, テキスト)
- QRプレビュー表示 (実物サイズ)

#### セクション3: ラベル設定
- 用紙タイプ選択: A4 12面/10面/8面/はがき/カスタム
- ラベルサイズ入力: 幅×高さ (mm)
- 余白入力 (mm)
- A4用紙レイアウトミニプレビュー: グリッドで各面の割り当て状況を表示

## 画面遷移

| 遷移元 | 操作 | 遷移先 |
|--------|------|--------|
| 任意 | サイドバークリック | 各画面 |
| 住所録一覧 | 「新規追加」 | 住所録編集(モーダル) |
| 住所録一覧 | 連絡先ダブルクリック | 住所録編集(モーダル) |
| プレビュー | 「ラベル印刷」 | 印刷確認ダイアログ → OS印刷ダイアログ |
| プレビュー | 「デザイン設定」 | 右パネルトグル |

## 住所録編集モーダル

フォームフィールド:

| フィールド | 型 | 必須 | 備考 |
|-----------|---|------|------|
| 姓 | text | ○ | |
| 名 | text | ○ | |
| 姓(かな) | text | | |
| 名(かな) | text | | |
| 敬称 | select | ○ | 様/殿/御中/先生 デフォルト: 様 |
| 郵便番号 | text | | 7桁入力で住所自動補完 |
| 都道府県 | text | | 郵便番号から自動入力 |
| 市区町村 | text | | 郵便番号から自動入力 |
| 番地 | text | | |
| 建物名 | text | | |
| 会社名 | text | | |
| 部署名 | text | | |
| グループ | multi-select | | |
| メモ | textarea | | |

## Zustand ストア設計

```typescript
// stores/contactStore.ts
interface ContactStore {
  contacts: Contact[]
  selectedIds: string[]
  searchQuery: string
  selectedGroup: string
  loading: boolean
  fetchContacts: () => Promise<void>
  toggleSelect: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  setSearchQuery: (q: string) => void
  setSelectedGroup: (g: string) => void
}

// stores/previewStore.ts
interface PreviewStore {
  previewIndex: number
  selectedTemplate: string
  zoom: number
  setPreviewIndex: (i: number) => void
  setTemplate: (id: string) => void
  setZoom: (z: number) => void
}

// stores/decorationStore.ts
interface DecorationStore {
  watermark: string          // preset ID or "custom"
  watermarkOpacity: number   // 0.0 - 1.0
  customWatermarkPath: string
  showQR: boolean
  qrContent: string
  showDecoPanel: boolean
  setWatermark: (id: string) => void
  setWatermarkOpacity: (v: number) => void
  setShowQR: (v: boolean) => void
  setQrContent: (v: string) => void
  toggleDecoPanel: () => void
}

// stores/labelStore.ts
interface LabelStore {
  paperType: string          // "a4-12" | "a4-10" | "a4-8" | "hagaki" | "custom"
  labelWidth: number         // mm
  labelHeight: number        // mm
  margin: number             // mm
  setPaperType: (t: string) => void
  setLabelSize: (w: number, h: number) => void
  setMargin: (m: number) => void
}
```
