指定されたパッケージ/コンポーネントのテストを書いてください。

Go:
- table-driven test スタイル
- モックは repository インターフェースに対して作成
- `go test -v ./internal/...` で実行

React:
- Vitest + React Testing Library
- Zustand ストアのテストは act() でラップ
- `cd frontend && npx vitest --run` で実行

対象: $ARGUMENTS