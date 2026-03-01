# Atena ラベル印刷 (atena-label)

日本語宛名ラベル印刷デスクトップアプリ。Wails v2 (Go) + React + TypeScript。

## コマンド

```bash
wails dev                              # 開発サーバー起動
wails build -platform windows/amd64    # Windowsビルド
wails build -platform darwin/universal # macOSビルド
cd frontend && npm run lint            # フロントエンドlint
cd frontend && npx vitest              # フロントエンドテスト
go test ./internal/...                 # Goテスト
```

## アーキテクチャ

- Go バックエンド: Clean Architecture (entity → usecase → repository → infrastructure)
- React フロントエンド: Zustand + shadcn/ui + Tailwind CSS
- Wails バインディング: Go public メソッド → 自動生成 TypeScript (`frontend/wailsjs/`)
- DB: SQLite (go-sqlite3) + golang-migrate

## ディレクトリ

- `app.go` — Wailsバインディング (Handler層)。全public メソッドにjsonタグ付きstruct
- `internal/entity/` — ドメインモデル。他レイヤーに依存しない
- `internal/usecase/` — ビジネスロジック。repositoryインターフェースに依存
- `internal/repository/` — インターフェース定義のみ
- `internal/infrastructure/` — 実装 (sqlite/, pdf/, qr/, image/, printer/)
- `frontend/src/components/` — React コンポーネント (address/, preview/, decoration/, label/)
- `frontend/src/stores/` — Zustand ストア

## 規約

- Go struct には必ず `json:"camelCase"` タグを付ける (Wailsバインディング生成に必須)
- IDは `github.com/google/uuid` で生成
- エラーは Go 側で適切にラップし、フロントには意味のあるメッセージを返す
- 依存方向: entity ← usecase ← infrastructure。逆方向の依存は禁止
- フロントエンドは `import { XxxFunc } from "../wailsjs/go/main/App"` で Go を呼ぶ

## 仕様ドキュメント

詳細な仕様は以下を参照（CLAUDE.md に全部書かない）:
- `docs/01-PROJECT-SPEC.md` — 技術スタック・アーキテクチャ詳細
- `docs/02-DATA-MODEL-API.md` — Entity定義・DBスキーマ・API一覧
- `docs/03-UI-SPEC.md` — 画面構成・Zustandストア設計
- `docs/04-TASK-LIST.md` — フェーズ別タスクリスト