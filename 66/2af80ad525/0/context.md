# Session Context

## User Prompts

### Prompt 1

.github/pull_request_template.mdを使用してこのブランチからmainへのPRのコメントを作成して

### Prompt 2

コピペしやすい形式で出して欲しい

### Prompt 3

動作確認に書いた内容でテストできますか？

### Prompt 4

指定されたパッケージ/コンポーネントのテストを書いてください。

Go:
- table-driven test スタイル
- モックは repository インターフェースに対して作成
- `go test -v ./internal/...` で実行

React:
- Vitest + React Testing Library
- Zustand ストアのテストは act() でラップ
- `cd frontend && npx vitest --run` で実行

対象:

