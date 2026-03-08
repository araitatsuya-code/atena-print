# Atena ラベル印刷 — 実装タスクリスト

> Sonnet への実装指示用。各フェーズを順番に実行する。
> 各タスクは依存関係順に並んでいるので上から順に実装すること。

---

## Phase 1: 基盤構築 ✅ 完了 (PR #1)

### 1.1 Wails プロジェクト初期化
- [x] `wails init -n atena-label -t react-ts` でプロジェクト作成
- [x] wails.json の設定 (appName: "Atena ラベル印刷", width: 1280, height: 800)
- [x] `wails dev` で起動確認

### 1.2 Go モジュール・依存関係
- [x] go.mod に依存を追加:
  - `github.com/mattn/go-sqlite3`
  - `github.com/google/uuid`
  - `github.com/golang-migrate/migrate/v4`
  - `github.com/jung-kurt/gofpdf`
  - `github.com/skip2/go-qrcode`
- [x] `go mod tidy`

### 1.3 Entity 定義
- [x] `internal/entity/contact.go` — Contact struct
- [x] `internal/entity/sender.go` — Sender struct
- [x] `internal/entity/group.go` — Group struct
- [x] `internal/entity/template.go` — Template, PostalConfig, TextConfig structs
- [x] `internal/entity/watermark.go` — Watermark struct
- [x] `internal/entity/qr_config.go` — QRConfig struct
- [x] `internal/entity/label_layout.go` — LabelLayout struct
- [x] `internal/entity/print_job.go` — PrintJob struct

> 詳細は `02-DATA-MODEL-API.md` を参照

### 1.4 DB スキーマ・マイグレーション

- [x] `internal/infrastructure/sqlite/migrations/000001_create_tables.up.sql` — 全テーブル作成 (contacts, groups, contact_groups, senders, custom_watermarks, print_history)
- [x] `internal/infrastructure/sqlite/migrations/000001_create_tables.down.sql`
- [x] `internal/infrastructure/sqlite/db.go` — DB初期化・マイグレーション実行関数
- [x] アプリ起動時に自動マイグレーション

### 1.5 Repository インターフェース
- [x] `internal/repository/contact_repository.go`
  - FindAll(groupID string) ([]Contact, error)
  - FindByID(id string) (*Contact, error)
  - Create(c *Contact) error
  - Update(c *Contact) error
  - Delete(id string) error
  - Search(query string) ([]Contact, error)
- [x] `internal/repository/sender_repository.go`
- [x] `internal/repository/group_repository.go`

### 1.6 SQLite Repository 実装
- [x] `internal/infrastructure/sqlite/contact_repo.go` — ContactRepository実装
- [x] `internal/infrastructure/sqlite/sender_repo.go`
- [x] `internal/infrastructure/sqlite/group_repo.go`

### 1.7 UseCase 実装 (Contact)
- [x] `internal/usecase/contact_usecase.go`
  - NewContactUseCase(repo) → コンストラクタ
  - List(groupID) / Get(id) / Create / Update / Delete / Search

### 1.8 Wails ハンドラー (app.go) — 住所録API
- [x] App struct に contactUseCase を保持
- [x] DI: main.go で DB → Repo → UseCase → App を組み立て
- [x] GetContacts / GetContact / SaveContact / DeleteContacts / SearchContacts をバインド
- [x] `wails dev` でバインディング自動生成を確認

### 1.9 フロントエンド基盤
- [x] Vite設定確認
- [x] Tailwind CSS + shadcn/ui セットアップ
- [x] App.tsx にルーティング基盤 (useState でビュー切替)
- [x] Zustandインストール・ストア骨格 (contactStore, previewStore, decorationStore, labelStore)

---

## Phase 2: 住所録 CRUD ✅ 完了 (PR #14, #15, #16, #17)

### 2.1 住所録一覧コンポーネント ✅ 完了 (PR #14)

- [x] `frontend/src/components/address/ContactList.tsx`
  - Wails バインディング経由で連絡先一覧取得
  - チェックボックス付きリスト表示
  - グループフィルター (タブUI)
  - 検索バー
  - 全選択/全解除ボタン

### 2.2 住所録編集モーダル ✅ 完了 (PR #14)

- [x] `frontend/src/components/address/ContactEditModal.tsx`
  - 新規追加/編集の両対応
  - フォームバリデーション
  - 保存 → Wails バインディング → DB

### 2.3 郵便番号検索 ✅ 完了 (PR #15)

- [x] `internal/infrastructure/postal/lookup.go` — 郵便番号→住所変換
  - 組み込みの郵便番号データ (JSON) または外部API
  - LookupPostal メソッドを app.go にバインド
- [x] フロントエンドで郵便番号入力時に自動補完

### 2.4 CSVインポート/エクスポート ✅ 完了 (PR #16)

- [x] `internal/usecase/csv_usecase.go`
- [x] `internal/infrastructure/csv/csv.go`
  - CSVカラムマッピング: 姓,名,姓（カナ）,名（カナ）,敬称,郵便番号,都道府県,市区町村,番地,建物名,会社名,部署名,メモ
- [x] ImportCSV / ExportCSV / OpenCSVFileDialog / SaveCSVFileDialog を app.go にバインド
- [x] フロントエンドにインポートボタン・エクスポートボタン (ファイル選択ダイアログ)

### 2.5 グループ管理 ✅ 完了 (PR #17)

- [x] `internal/usecase/group_usecase.go`
- [x] GetGroups / SaveGroup / DeleteGroup / SetContactGroups をバインド
- [x] 住所録編集モーダルにグループ選択UI

---

## Phase 3: ラベルレンダリング ✅ 完了 (PR #18, #19)

### 3.1 Canvas ベースラベルプレビュー ✅ 完了 (PR #18)

- [x] `frontend/src/components/preview/LabelCanvas.tsx`
  - Canvas API で宛名ラベルを描画
  - テンプレートJSONに従ったレイアウト
  - 郵便番号表示

### 3.2 縦書きエンジン (Canvas) ✅ 完了 (PR #18)

- [x] `frontend/src/lib/verticalText.ts`
  - 1文字ずつ縦方向に配置
  - 拗音・促音 (ゃ, っ) のオフセット
  - 長音符 (ー) の90度回転
  - 句読点の位置調整
  - 数字→漢数字変換オプション

### 3.3 透かし描画 (Canvas) ✅ 完了 (PR #19)

- [x] `frontend/src/components/preview/WatermarkLayer.tsx`
  - プリセット透かし: SVGパターンで描画
  - カスタム画像: img要素をCanvasに描画
  - 透明度スライダー連動

### 3.4 QRコード描画 (Canvas) ✅ 完了 (PR #19)

- [x] `frontend/src/components/preview/QROverlay.tsx`
  - プレビュー用: JSライブラリ (qrcode) でCanvas上に描画
  - 位置・サイズ設定連動

### 3.5 プレビュー統合 ✅ 完了 (PR #19)

- [x] `frontend/src/components/preview/PreviewArea.tsx`
  - LabelCanvas + WatermarkLayer + QROverlay を統合
  - ズーム機能
  - 複数選択時のサムネイルナビゲーション
  - テンプレート切替

---

## Phase 4: 透かし・QR バックエンド ✅ 完了 (PR #20, #21)

### 4.1 透かし画像処理 (Go) ✅ 完了 (PR #20)

- [x] `internal/usecase/watermark_usecase.go`
- [x] `internal/infrastructure/image/watermark.go`
  - プリセット画像の読み込み (assets/watermarks/)
  - カスタム画像のアップロード・保存
  - 透明度適用 (Go の image パッケージで alpha 調整)

### 4.2 QRコード生成 (Go) ✅ 完了 (PR #20)

- [x] `internal/usecase/qrcode_usecase.go`
- [x] `internal/infrastructure/qr/generator.go`
  - go-qrcode で QR画像 (PNG) を生成
  - サイズ指定対応
  - GenerateQRPreview をバインド

### 4.3 デザイン設定パネル ✅ 完了 (PR #21)

- [x] `frontend/src/components/decoration/WatermarkPanel.tsx` — 透かしプリセット選択 + 透明度 + アップロード
- [x] `frontend/src/components/decoration/QRPanel.tsx` — QR ON/OFF + コンテンツ入力 + プレビュー
- [x] `frontend/src/components/decoration/DecorationSidebar.tsx` — 上記を統合した右パネル

---

## Phase 5: ラベル印刷 (Week 10-11)

### 5.1 PDF生成エンジン (Go)
- [x] `internal/usecase/print_usecase.go`
- [x] `internal/infrastructure/pdf/label_pdf.go`
  - gofpdf で A4ページにラベルをグリッド配置
  - 各ラベル内に:
    - 縦書き宛名 (1文字ずつ SetXY で配置)
    - 郵便番号
    - 差出人情報
  - TrueTypeフォント埋め込み (明朝体)
  - LabelLayout に従った面付け計算

### 5.2 PDF内の透かし・QR合成
- [x] PDF生成時に透かし画像を背景としてImageで配置
- [x] PDF生成時にQR画像を指定位置にImageで配置

### 5.3 ラベル設定パネル
- [ ] `frontend/src/components/label/LabelSettingsPanel.tsx`
  - 用紙タイプ選択
  - ラベルサイズ入力
  - 余白入力
  - A4レイアウトミニプレビュー

### 5.4 印刷フロー
- [ ] `internal/infrastructure/printer/print.go`
  - Windows: `cmd /c start /wait "" "path.pdf"` で標準ビューア経由印刷
  - macOS: `lpr` コマンド or `open` で Preview.app 経由
- [ ] GenerateLabelPDF / PrintPDF をバインド
- [ ] フロントエンドの「ラベル印刷」ボタンからの一連のフロー実装

### 5.5 印刷確認ダイアログ
- [ ] `frontend/src/components/PrintConfirmDialog.tsx`
  - 印刷枚数・用紙タイプの確認
  - 「PDF保存」「印刷」の選択

---

## Phase 6: 仕上げ (Week 12-13)

### 6.1 差出人管理画面
- [ ] `frontend/src/components/sender/SenderManager.tsx`
  - 差出人CRUD
  - デフォルト差出人設定

### 6.2 ダッシュボード
- [ ] `frontend/src/components/Dashboard.tsx`
  - 最近の印刷履歴
  - クイックアクション (新規住所録, ラベル印刷)
  - 登録件数サマリー

### 6.3 設定画面
- [ ] `frontend/src/components/Settings.tsx`
  - フォント設定
  - データバックアップ/復元
  - バージョン情報

### 6.4 テスト
- [ ] Go ユニットテスト: usecase, infrastructure 各層
- [ ] Vitest: Zustand ストア, ユーティリティ関数
- [ ] 手動テスト: 実際のラベルシール用紙での印刷テスト

### 6.5 ビルド・配布準備
- [ ] Windows ビルド: `wails build -platform windows/amd64`
- [ ] macOS ビルド: `wails build -platform darwin/universal`
- [ ] README.md 作成
- [ ] GitHub Releases 設定

---

## 実装の注意点

### Wails 固有

1. **バインディング生成**: `wails dev` 実行中は Go メソッドを追加するたびに自動で TypeScript 型が `frontend/wailsjs/` に生成される
2. **コンテキスト**: Wails の runtime を使うメソッドは `context.Context` を受け取る。ファイルダイアログ等で必要
3. **イベント**: Go → フロントエンド方向の通知は Wails Events を使う

### 縦書き

1. Canvas (プレビュー) と gofpdf (印刷) の両方で同じレイアウト結果になるよう、テンプレートJSON を共通の信頼できるソースとする
2. 縦書きの文字間隔・位置はフォントサイズに依存するため、プレビューと印刷で同じ計算ロジックを使う

### ラベル印刷

1. A4用紙の面付け計算は Go 側で行い、PDF として出力
2. 宛先数 > 面数 の場合は複数ページのPDFを生成
3. 用紙プリセットの余白・ギャップ値は実際のラベルシール用紙に合わせて微調整が必要

### 透かし・QR

1. プレビュー (Canvas) と印刷 (PDF) で見た目が一致するよう注意
2. 透かし画像は解像度が低いとぼやけるので、最低 300dpi 相当で処理
3. QR のサイズは印刷時に読み取り可能な最小サイズ (15mm四方程度) を下限に設定
