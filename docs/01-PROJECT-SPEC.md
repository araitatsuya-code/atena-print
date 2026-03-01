# Atena ラベル印刷 — プロジェクト仕様書

## 概要

日本の年賀状・はがき・封筒向けの **宛名ラベル印刷** デスクトップアプリ。
封筒への直接印刷ではなく、**糊付け用の宛名ラベルシール** を A4 用紙に複数面印刷するコンセプト。

- リポジトリ名: `atena-label`
- 表示名: Atena ラベル印刷
- 対象OS: Windows / macOS
- 技術スタック: **Wails v2 (Go) + React + TypeScript**

## コアコンセプト

1. **宛名ラベル印刷**: A4ラベルシール用紙に複数面の宛名ラベルを印刷、封筒に貼り付ける
2. **透かし画像**: ラベル背景に桜・波・竹等のプリセット or カスタム画像を透かし配置
3. **QRコード**: URL等をエンコードしたQRコードをラベル上に配置
4. **縦書き対応**: 日本語の縦書きレイアウトに完全対応

## 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| ランタイム | Wails | v2 |
| バックエンド | Go | 1.22+ |
| フロントエンド | React + TypeScript | React 18, TS 5 |
| ビルドツール | Vite | 5.x |
| 状態管理 | Zustand | 4.x |
| UI | shadcn/ui + Tailwind CSS | latest |
| ローカルDB | SQLite (go-sqlite3) | - |
| ORM/クエリ | sqlc | latest |
| PDF生成 | gofpdf | latest |
| QRコード | go-qrcode | latest |
| 画像処理 | Go image 標準パッケージ | - |
| テスト | Go testing + Vitest + Playwright | - |

## アーキテクチャ

### Clean Architecture (Go バックエンド)

```
internal/
├── entity/          # ドメインモデル (struct定義)
├── usecase/         # ビジネスロジック
├── repository/      # インターフェース定義
└── infrastructure/  # 実装 (SQLite, PDF, QR, Image, Printer)
```

### レイヤー図

```
┌──────────────────────────────────────────────┐
│  Frontend (React + TypeScript)               │
│  - UI Components (shadcn/ui)                 │
│  - Canvas Renderer (ラベルプレビュー)           │
│  - Watermark Layer (透かし描画)                │
│  - State Management (Zustand)                │
├─────── Wails Bindings (auto-generated) ──────┤
│  Go Backend (Clean Architecture)             │
│  ┌──────────────────────────────────────┐    │
│  │  Handler (app.go - Wailsバインド)     │    │
│  ├──────────────────────────────────────┤    │
│  │  UseCase Layer                       │    │
│  │  - ContactUseCase  - PrintUseCase    │    │
│  │  - QRCodeUseCase   - WatermarkUseCase│    │
│  ├──────────────────────────────────────┤    │
│  │  Entity Layer                        │    │
│  ├──────────────────────────────────────┤    │
│  │  Repository Interfaces               │    │
│  └──────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│  Infrastructure                              │
│  - SQLite (go-sqlite3)                       │
│  - PDF Generator (gofpdf + QR + watermark)   │
│  - QR Generator (go-qrcode)                  │
│  - Image Processor (Go image pkg)            │
│  - Print Bridge (OS native dialog)           │
└──────────────────────────────────────────────┘
```

### Wails バインディングの仕組み

Go の struct メソッドを自動的に TypeScript の型定義とバインディングに変換。
フロントエンドから型安全に Go の関数を呼び出せる。

```go
// Go側 (app.go)
func (a *App) GetContacts(groupID string) ([]entity.Contact, error) {
    return a.contactUseCase.List(groupID)
}
```

```typescript
// React側 (自動生成される)
import { GetContacts } from "../wailsjs/go/main/App"
const contacts = await GetContacts("family")
```

## ディレクトリ構成

```
atena-label/
├── main.go                    # Wailsエントリポイント
├── app.go                     # Wailsバインディング (Handler)
├── internal/
│   ├── entity/
│   │   ├── contact.go         # 連絡先
│   │   ├── sender.go          # 差出人
│   │   ├── template.go        # ラベルテンプレート
│   │   ├── watermark.go       # 透かし画像設定
│   │   ├── qr_config.go       # QRコード設定
│   │   └── label_layout.go    # ラベル面付けレイアウト
│   ├── usecase/
│   │   ├── contact_usecase.go
│   │   ├── print_usecase.go   # ラベル印刷フロー
│   │   ├── qrcode_usecase.go  # QR生成
│   │   ├── watermark_usecase.go # 透かし合成
│   │   └── csv_usecase.go
│   ├── repository/
│   │   ├── contact_repository.go
│   │   ├── sender_repository.go
│   │   └── template_repository.go
│   ├── infrastructure/
│   │   ├── sqlite/            # DB実装
│   │   ├── pdf/               # PDF生成 (gofpdf)
│   │   ├── qr/                # QR生成 (go-qrcode)
│   │   ├── image/             # 透かし画像処理
│   │   ├── csv/
│   │   └── printer/           # OS印刷ブリッジ
│   └── migration/
│       ├── 000001_create_contacts.up.sql
│       └── ...
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── address/       # 住所録UI
│   │   │   ├── preview/       # ラベルプレビュー
│   │   │   ├── decoration/    # 透かし・QR設定パネル
│   │   │   ├── label/         # ラベル設定
│   │   │   └── ui/            # shadcn/ui共通
│   │   ├── hooks/
│   │   ├── stores/            # Zustandストア
│   │   └── lib/               # ユーティリティ
│   └── wailsjs/               # 自動生成バインディング
├── assets/
│   ├── watermarks/            # プリセット透かし画像
│   └── fonts/                 # 埋め込みフォント
├── go.mod
├── go.sum
└── wails.json                 # Wails設定
```
