# Atena ラベル印刷

日本の年賀状・はがき・封筒向けの **宛名ラベル印刷** デスクトップアプリ。
封筒への直接印刷ではなく、**糊付け用の宛名ラベルシール** を A4 用紙に複数面印刷するコンセプト。

- 対応OS: Windows / macOS
- 技術スタック: **Wails v2 (Go) + React + TypeScript**

## 機能

- **住所録管理**: 連絡先の登録・編集・削除・グループ分け・CSV インポート/エクスポート
- **郵便番号検索**: 7桁入力で都道府県・市区町村を自動補完
- **縦書きレイアウト**: 日本語縦書きに完全対応（拗音・長音符・句読点の位置調整）
- **透かし画像**: 桜・波・竹・富士山・鶴のプリセット、またはカスタム画像を背景に配置
- **QRコード**: URL 等をエンコードしたQRコードをラベル上に配置
- **ラベル面付け**: A4 用紙に複数面（8面/10面/12面）を自動配置して PDF 生成・印刷

## 次フェーズ優先項目 (2026-03-08 時点)

- [#30 ラベル横書き対応（プレビュー/PDF印刷の両対応）](https://github.com/araitatsuya-code/atena-print/issues/30)
- [#31 ラベル印刷位置のドラッグ微調整（オフセット保存）](https://github.com/araitatsuya-code/atena-print/issues/31)

## 技術スタック

|レイヤー|技術|
|---|---|
|ランタイム|Wails v2|
|バックエンド|Go 1.22+|
|フロントエンド|React 18 + TypeScript 5|
|ビルドツール|Vite 5.x|
|状態管理|Zustand 4.x|
|UI|shadcn/ui + Tailwind CSS|
|ローカルDB|SQLite (go-sqlite3) + golang-migrate|
|PDF生成|gofpdf|
|QRコード|go-qrcode|
|画像処理|Go image 標準パッケージ|

## セットアップ

### 必要環境

- [Go 1.22+](https://go.dev/)
- [Node.js 18+](https://nodejs.org/)
- [Wails v2](https://wails.io/) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### インストール

```bash
git clone https://github.com/your-org/atena-print.git
cd atena-print
go mod tidy
cd frontend && npm install && cd ..
```

## 開発

```bash
wails dev                              # 開発サーバー起動（ホットリロード有効）
```

ブラウザで確認する場合は `http://localhost:34115` にアクセス。

### テスト

```bash
go test ./internal/...                 # Go テスト
cd frontend && npx vitest              # フロントエンドテスト
cd frontend && npm run lint            # フロントエンド lint
```

## ビルド

```bash
wails build -platform windows/amd64    # Windows 向けビルド
wails build -platform darwin/universal # macOS 向けビルド（Intel + Apple Silicon）
```

成果物は `build/bin/` に出力されます。

## アーキテクチャ

### Clean Architecture (Go バックエンド)

```text
internal/
├── entity/          # ドメインモデル (struct定義)
├── usecase/         # ビジネスロジック
├── repository/      # インターフェース定義
└── infrastructure/  # 実装 (SQLite, PDF, QR, Image, Printer)
```

依存方向: `entity ← usecase ← infrastructure` (逆方向の依存は禁止)

### Wails バインディング

Go の public メソッドが自動的に TypeScript 型定義とバインディングに変換されます。

```go
// Go側 (app.go)
func (a *App) GetContacts(groupID string) ([]entity.Contact, error) {
    return a.contactUseCase.List(groupID)
}
```

```typescript
// React側 (自動生成)
import { GetContacts } from "../wailsjs/go/main/App"
const contacts = await GetContacts("family")
```

### ディレクトリ構成

```text
atena-print/
├── main.go                    # Wails エントリポイント
├── app.go                     # Wails バインディング (Handler)
├── internal/
│   ├── entity/                # ドメインモデル
│   ├── usecase/               # ビジネスロジック
│   ├── repository/            # インターフェース定義
│   └── infrastructure/
│       ├── sqlite/            # DB 実装
│       ├── pdf/               # PDF 生成 (gofpdf)
│       ├── qr/                # QR 生成 (go-qrcode)
│       ├── image/             # 透かし画像処理
│       ├── csv/               # CSV インポート/エクスポート
│       ├── postal/            # 郵便番号検索
│       └── printer/           # OS 印刷ブリッジ
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── address/       # 住所録 UI
│   │   │   ├── preview/       # ラベルプレビュー (Canvas)
│   │   │   ├── decoration/    # 透かし・QR 設定パネル
│   │   │   ├── label/         # ラベル設定
│   │   │   └── ui/            # shadcn/ui 共通コンポーネント
│   │   ├── stores/            # Zustand ストア
│   │   └── lib/               # ユーティリティ (縦書きエンジン等)
│   └── wailsjs/               # 自動生成バインディング (編集不要)
├── assets/
│   ├── watermarks/            # プリセット透かし画像
│   └── fonts/                 # 埋め込みフォント
├── docs/                      # 仕様ドキュメント
└── wails.json                 # Wails 設定
```

## 対応用紙プリセット

|用紙タイプ|面数|ラベルサイズ|
|---|---|---|
|A4 12面|12|86.4 × 42.3 mm|
|A4 10面|10|86.4 × 50.8 mm|
|A4 8面|8|96.5 × 67.7 mm|
|はがき|1|100 × 148 mm|
|カスタム|-|任意|

## ドキュメント

詳細仕様は `docs/` を参照してください。

|ファイル|内容|
|---|---|
|[01-PROJECT-SPEC.md](docs/01-PROJECT-SPEC.md)|技術スタック・アーキテクチャ詳細|
|[02-DATA-MODEL-API.md](docs/02-DATA-MODEL-API.md)|Entity 定義・DB スキーマ・API 一覧|
|[03-UI-SPEC.md](docs/03-UI-SPEC.md)|画面構成・Zustand ストア設計|
|[04-TASK-LIST.md](docs/04-TASK-LIST.md)|フェーズ別タスクリスト|
|[06-PRINT-PARITY-QA.md](docs/06-PRINT-PARITY-QA.md)|プレビュー一致性の回帰テスト・実機印刷チェックリスト・誤差許容範囲|
