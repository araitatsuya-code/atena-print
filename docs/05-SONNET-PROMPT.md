# Atena ラベル印刷 — Sonnet 実装指示書

## このドキュメントの使い方

このプロジェクトは以下のドキュメントで構成されています。
実装時は全ドキュメントを参照してください。

| ファイル | 内容 |
|---------|------|
| `01-PROJECT-SPEC.md` | プロジェクト概要・技術スタック・アーキテクチャ・ディレクトリ構成 |
| `02-DATA-MODEL-API.md` | Entity定義(Go struct)・DBスキーマ・Wails API一覧 |
| `03-UI-SPEC.md` | 画面構成・各コンポーネント仕様・Zustandストア設計 |
| `04-TASK-LIST.md` | フェーズ別タスクリスト・実装注意点 |
| `05-SONNET-PROMPT.md` | この指示書 |

## プロジェクト概要

**Atena ラベル印刷** (`atena-label`) は、日本の年賀状・はがき・封筒向けの宛名ラベル印刷デスクトップアプリ。

**コアコンセプト:**
- 封筒に糊付けする宛名ラベルシールをA4用紙に複数面印刷
- ラベル背景に好きな透かし画像を配置可能
- QRコードをラベル上に埋め込み可能
- 日本語縦書き対応

**技術スタック:** Wails v2 (Go) + React + TypeScript + SQLite

## 実装の進め方

`04-TASK-LIST.md` のPhaseを順番に実装してください。

### Phase 1 から始める場合の指示例:

```
Phase 1 (基盤構築) を実装してください。

1. wails init でプロジェクト作成
2. Go 依存関係の追加
3. internal/entity/ 配下の全 struct 定義
4. SQLite マイグレーション
5. Repository インターフェース + SQLite実装
6. ContactUseCase
7. app.go にWailsバインディング
8. フロントエンド基盤 (Tailwind + shadcn/ui + Zustand)

詳細は 02-DATA-MODEL-API.md の Entity 定義と DB スキーマを参照。
```

### 各フェーズの指示テンプレート:

```
[PROJECT CONTEXT]
atena-label プロジェクトの Phase N を実装してください。

[REFERENCE DOCS]
以下のドキュメントを参照:
- 01-PROJECT-SPEC.md: アーキテクチャ・ディレクトリ構成
- 02-DATA-MODEL-API.md: データモデル・API仕様
- 03-UI-SPEC.md: UI仕様
- 04-TASK-LIST.md: タスク詳細

[CURRENT STATE]
前のフェーズまでに実装済みの内容: (ここに記載)

[TASKS]
04-TASK-LIST.md の Phase N のタスクを順番に実装してください。

[CONSTRAINTS]
- Wails v2 のバインディング規約に従う
- Clean Architecture: entity → usecase → repository → infrastructure の依存方向
- Go の struct には json タグを必ず付ける (Wails バインディング生成に必要)
- フロントエンドは Zustand で状態管理
- UIは shadcn/ui + Tailwind CSS
```

## 重要な技術的注意事項

### 1. Wails バインディング

Go の public メソッドは自動的に TypeScript に変換される。
メソッドシグネチャの規約:

```go
// OK - Wails がバインドする
func (a *App) GetContacts(groupID string) ([]entity.Contact, error) { ... }

// NG - private メソッドはバインドされない
func (a *App) getContacts(groupID string) { ... }
```

### 2. DI の組み立て (main.go)

```go
func main() {
    db := sqlite.NewDB("atena.db")
    contactRepo := sqlite.NewContactRepo(db)
    contactUC := usecase.NewContactUseCase(contactRepo)
    
    app := &App{
        contactUseCase: contactUC,
        // ... 他のUseCaseも同様
    }
    
    wails.Run(&options.App{
        Title: "Atena ラベル印刷",
        Width: 1280, Height: 800,
        Bind: []interface{}{app},
        // ...
    })
}
```

### 3. フロントエンドからの呼び出し

```typescript
// frontend/src/wailsjs/go/main/App.ts は自動生成
import { GetContacts, SaveContact } from "../wailsjs/go/main/App"

// 呼び出し
const contacts = await GetContacts("")
await SaveContact(newContact)
```

### 4. 縦書きの実装ポイント

Canvas (プレビュー):
```typescript
// 1文字ずつ Y方向に配置
for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  const y = startY + i * letterSpacing;
  ctx.fillText(ch, x, y);
}
```

gofpdf (PDF生成):
```go
// 同じロジックを Go で実装
for i, ch := range text {
    y := startY + float64(i)*letterSpacing
    pdf.SetXY(x, y)
    pdf.CellFormat(0, 0, string(ch), "", 0, "", false, 0, "")
}
```

### 5. ラベル面付け計算

```go
func CalcLabelPositions(layout LabelLayout, count int) []struct{ Page, X, Y float64 } {
    labelsPerPage := layout.Columns * layout.Rows
    positions := make([]struct{ Page, X, Y float64 }, count)
    
    for i := 0; i < count; i++ {
        page := i / labelsPerPage
        idx := i % labelsPerPage
        col := idx % layout.Columns
        row := idx / layout.Columns
        
        x := layout.MarginLeft + float64(col)*(layout.LabelWidth+layout.GapX)
        y := layout.MarginTop + float64(row)*(layout.LabelHeight+layout.GapY)
        
        positions[i] = struct{ Page, X, Y float64 }{float64(page), x, y}
    }
    return positions
}
```
